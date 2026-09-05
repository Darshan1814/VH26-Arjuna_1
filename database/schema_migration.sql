-- =============================================================================
-- Machine Troubleshooter — Idempotent Supabase Schema Migration
-- =============================================================================
-- This script is SAFE to run multiple times. It will:
--   1. Enable required extensions (uuid-ossp, vector)
--   2. Create all tables IF NOT EXISTS
--   3. Create all indexes IF NOT EXISTS
--   4. Create/replace all RPC functions
--   5. Enable RLS and create policies IDEMPOTENTLY
--   6. Add audit_log table for pipeline traceability
--
-- Run in: Supabase SQL Editor → New Query → Paste & Run
-- =============================================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Machines: registered industrial machine models
CREATE TABLE IF NOT EXISTS machines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    model_number    TEXT NOT NULL UNIQUE,
    manufacturer    TEXT,
    category        TEXT,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manuals: uploaded PDF/DOCX service manuals
CREATE TABLE IF NOT EXISTS manuals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id      UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    filename        TEXT NOT NULL,
    storage_path    TEXT,
    total_pages     INT,
    status          TEXT NOT NULL DEFAULT 'uploaded'
                    CHECK (status IN ('uploaded', 'processing', 'ready', 'error')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document chunks: indexed text segments with 1024-dim BGE-M3 embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id       UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    machine_id      UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    page_number     INT NOT NULL,
    section         TEXT NOT NULL DEFAULT 'General',
    chunk_index     INT NOT NULL DEFAULT 0,
    content         TEXT NOT NULL,
    content_type    TEXT NOT NULL DEFAULT 'text'
                    CHECK (content_type IN ('text', 'table', 'heading', 'image_description')),
    error_codes     TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    embedding       vector(1024),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations: troubleshooting chat sessions
CREATE TABLE IF NOT EXISTS conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id      UUID REFERENCES machines(id) ON DELETE SET NULL,
    title           TEXT DEFAULT 'New Conversation',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages: individual messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Citations: source references attached to assistant messages
CREATE TABLE IF NOT EXISTS citations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id        UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    manual_id       UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    machine_id      UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    section         TEXT,
    page_number     INT,
    relevance_score FLOAT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports: generated professional troubleshooting reports
CREATE TABLE IF NOT EXISTS reports (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title                   TEXT NOT NULL,
    query                   TEXT NOT NULL,
    machine_id              UUID REFERENCES machines(id) ON DELETE SET NULL,
    machine_model           TEXT,
    error_code              TEXT,
    diagnosis               TEXT,
    probable_causes         JSONB DEFAULT '[]',
    recommended_solutions   JSONB DEFAULT '[]',
    confidence              FLOAT DEFAULT 0.0,
    confidence_level        TEXT DEFAULT 'MEDIUM',
    evidence                JSONB DEFAULT '[]',
    html_content            TEXT,
    pdf_path                TEXT,
    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log: CI/CD pipeline and system event traceability
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type      TEXT NOT NULL,
    event_source    TEXT NOT NULL DEFAULT 'system',
    actor           TEXT,
    details         JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- Foreign key indexes for join performance
CREATE INDEX IF NOT EXISTS idx_manuals_machine_id       ON manuals(machine_id);
CREATE INDEX IF NOT EXISTS idx_chunks_manual_id         ON document_chunks(manual_id);
CREATE INDEX IF NOT EXISTS idx_chunks_machine_id        ON document_chunks(machine_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_citations_message_id     ON citations(message_id);

-- Error code search (GIN index for array containment: @> operator)
CREATE INDEX IF NOT EXISTS idx_chunks_error_codes ON document_chunks USING GIN(error_codes);

-- Metadata search (GIN for JSONB containment queries)
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON document_chunks USING GIN(metadata);

-- Timestamp indexes for ordering
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created      ON messages(created_at);

-- Section/page index for filtered retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_section ON document_chunks(section);
CREATE INDEX IF NOT EXISTS idx_chunks_page    ON document_chunks(page_number);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);

-- Vector similarity search index (HNSW — better recall than IVFFlat, no training)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);


-- ============================================================
-- 4. FUNCTIONS (RPC)
-- ============================================================

-- Similarity search function for the RAG retrieval pipeline.
-- Called via Supabase RPC: client.rpc('match_document_chunks', {...})
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(1024),
    match_count INT DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.3,
    filter_machine_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    page_number INT,
    section TEXT,
    chunk_index INT,
    error_codes TEXT[],
    manual_id UUID,
    machine_id UUID,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        dc.page_number,
        dc.section,
        dc.chunk_index,
        dc.error_codes,
        dc.manual_id,
        dc.machine_id,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE
        dc.embedding IS NOT NULL
        AND (filter_machine_id IS NULL OR dc.machine_id = filter_machine_id)
        AND 1 - (dc.embedding <=> query_embedding) > similarity_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Utility: log an audit event
CREATE OR REPLACE FUNCTION log_audit_event(
    p_event_type TEXT,
    p_event_source TEXT DEFAULT 'system',
    p_actor TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO audit_log (event_type, event_source, actor, details)
    VALUES (p_event_type, p_event_source, p_actor, p_details)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$;

-- Utility: update conversation timestamp on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

-- Create trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_update_conversation_ts ON messages;
CREATE TRIGGER trg_update_conversation_ts
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();


-- ============================================================
-- 5. ROW LEVEL SECURITY (Idempotent)
-- ============================================================
-- RLS is enabled but open (no auth yet). Policies allow all access
-- via service role key. When Supabase Auth is added, restrict these.

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation: DROP IF EXISTS + CREATE
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'machines', 'manuals', 'document_chunks',
        'conversations', 'messages', 'citations',
        'reports', 'audit_log'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Drop existing policy if present (makes this block re-runnable)
        EXECUTE format(
            'DROP POLICY IF EXISTS "allow_all_access" ON %I', tbl
        );
        -- Create open policy for service role access
        EXECUTE format(
            'CREATE POLICY "allow_all_access" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl
        );
    END LOOP;
END;
$$;


-- ============================================================
-- 6. SEED: Insert initial audit event
-- ============================================================

INSERT INTO audit_log (event_type, event_source, actor, details)
VALUES (
    'schema_migration',
    'database',
    'migration_script',
    jsonb_build_object(
        'version', '1.0.0',
        'description', 'Initial schema setup with pgvector, RLS, and audit logging',
        'executed_at', NOW()::TEXT
    )
);

-- ============================================================
-- Migration complete. All tables, indexes, functions, and
-- policies have been created/updated idempotently.
-- ============================================================
