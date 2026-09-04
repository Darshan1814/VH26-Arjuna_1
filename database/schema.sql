-- =============================================================================
-- Machine Troubleshooter — Database Schema
-- =============================================================================
-- Run this entire script in the Supabase SQL Editor to set up all tables,
-- extensions, indexes, and functions.
--
-- Prerequisites:
--   1. A Supabase project with PostgreSQL
--   2. pgvector extension (enabled below)
-- =============================================================================

-- ========================
-- Extensions
-- ========================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ========================
-- Tables
-- ========================

-- Machines: registered machine models
CREATE TABLE IF NOT EXISTS machines (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    model_number TEXT NOT NULL UNIQUE,
    manufacturer TEXT,
    category    TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manuals: uploaded PDF service manuals
CREATE TABLE IF NOT EXISTS manuals (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id   UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    filename     TEXT NOT NULL,
    storage_path TEXT,
    total_pages  INT,
    status       TEXT NOT NULL DEFAULT 'uploaded'
                 CHECK (status IN ('uploaded', 'processing', 'ready', 'error')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document chunks: indexed text segments from manuals
-- Embedding dimension = 1024 (BGE-M3)
CREATE TABLE IF NOT EXISTS document_chunks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id     UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    machine_id    UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    page_number   INT NOT NULL,
    section       TEXT NOT NULL DEFAULT 'General',
    chunk_index   INT NOT NULL DEFAULT 0,
    content       TEXT NOT NULL,
    content_type  TEXT NOT NULL DEFAULT 'text'
                  CHECK (content_type IN ('text', 'table', 'heading', 'image_description')),
    error_codes   TEXT[] DEFAULT '{}',
    metadata      JSONB DEFAULT '{}',
    embedding     vector(1024),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations: troubleshooting chat sessions
CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id  UUID REFERENCES machines(id) ON DELETE SET NULL,
    title       TEXT DEFAULT 'New Conversation',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages: individual messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content          TEXT NOT NULL,
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Citations: source references attached to assistant messages
CREATE TABLE IF NOT EXISTS citations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id    UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    manual_id   UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    machine_id  UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    section     TEXT,
    page_number INT,
    relevance_score FLOAT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ========================
-- Indexes
-- ========================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_manuals_machine_id ON manuals(machine_id);
CREATE INDEX IF NOT EXISTS idx_chunks_manual_id ON document_chunks(manual_id);
CREATE INDEX IF NOT EXISTS idx_chunks_machine_id ON document_chunks(machine_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_citations_message_id ON citations(message_id);

-- Error code search (GIN index for array containment queries)
CREATE INDEX IF NOT EXISTS idx_chunks_error_codes ON document_chunks USING GIN(error_codes);

-- Metadata search (GIN for JSONB queries)
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON document_chunks USING GIN(metadata);

-- Timestamp indexes for ordering
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Section/page index for filtering
CREATE INDEX IF NOT EXISTS idx_chunks_section ON document_chunks(section);
CREATE INDEX IF NOT EXISTS idx_chunks_page ON document_chunks(page_number);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor)
-- HNSW is preferred over IVFFlat for better recall and no training requirement
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);


-- ========================
-- Functions
-- ========================

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


-- ========================
-- Row Level Security (RLS)
-- ========================
-- Disabled for now since there is no authentication.
-- Enable RLS on these tables when Supabase Auth is added.

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;

-- Temporary: allow all access via service role key (backend only)
CREATE POLICY "Service role full access" ON machines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON manuals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON document_chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON citations FOR ALL USING (true) WITH CHECK (true);
