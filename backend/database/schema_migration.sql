-- ==============================================================================
-- INDUSTRIAL MACHINE TROUBLESHOOTING SYSTEM (RAG KNOWLEDGE BASE & VECTOR STORE)
-- Schema Definition & Column Generation Query for Chunks, Metadata & Vectors
-- Compatible with SQLite and Supabase PostgreSQL / pgvector
-- ==============================================================================

-- 1. Core Chunks Table with all Problem Statement (PS) required columns & Vector Storage
CREATE TABLE IF NOT EXISTS chunks (
    -- Unique chunk identifier
    id TEXT PRIMARY KEY,
    
    -- Document & Session traceability
    document_id TEXT,
    session_id TEXT,
    filename TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    
    -- Problem Statement Metadata Columns
    machine TEXT,                                 -- Machine Name (e.g., 'CNC-X', 'Machine-A', 'Press-Z')
    model TEXT,                                   -- Machine Model (e.g., 'X200', 'RC10')
    machine_model TEXT,                           -- Full combined equipment identifier
    error_code TEXT,                              -- Primary exact error code (e.g., 'E101', 'FAULT_204')
    error_codes TEXT,                             -- JSON array of all detected error codes in chunk
    section TEXT,                                 -- Manual section (e.g., 'Troubleshooting', 'Wiring Diagram')
    page_number INTEGER,                          -- Physical manual page number for direct citation
    
    -- Technical Diagnostic Content
    symptom TEXT,                                 -- Physical symptom (e.g., 'chattering noise', 'overheating')
    probable_cause TEXT,                          -- Probable root cause from OEM manual
    corrective_action TEXT,                       -- Step-by-step resolution procedure
    content TEXT NOT NULL,                        -- Raw text / table / layout extracted content
    
    -- 1024-Dimensional Dense Vector Storage
    vector_dim INTEGER DEFAULT 1024,              -- Embedding dimension size
    embedding_stored INTEGER DEFAULT 0,           -- Boolean flag (1 if vector embedding is stored)
    embedding BLOB,                               -- Binary vector representation (IEEE 754 float32 array)
    embedding_json TEXT,                          -- JSON array of 1024 float embeddings for fast similarity
    
    -- Extensible JSON Metadata & Timestamps
    metadata TEXT,                                -- Extended metadata (subsystems, warning flags, layout)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Performance & Multi-Manual Query Indices
CREATE INDEX IF NOT EXISTS idx_chunks_machine ON chunks(machine);
CREATE INDEX IF NOT EXISTS idx_chunks_model ON chunks(model);
CREATE INDEX IF NOT EXISTS idx_chunks_error_code ON chunks(error_code);
CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks(section);
CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks(page_number);
CREATE INDEX IF NOT EXISTS idx_chunks_filename ON chunks(filename);
CREATE INDEX IF NOT EXISTS idx_chunks_session ON chunks(session_id);

-- 3. In-Place Migration Query for Existing Tables (Adds any missing columns dynamically)
-- SQLite / Postgres conditional column verification:
-- ALTER TABLE chunks ADD COLUMN machine TEXT;
-- ALTER TABLE chunks ADD COLUMN model TEXT;
-- ALTER TABLE chunks ADD COLUMN error_code TEXT;
-- ALTER TABLE chunks ADD COLUMN symptom TEXT;
-- ALTER TABLE chunks ADD COLUMN probable_cause TEXT;
-- ALTER TABLE chunks ADD COLUMN corrective_action TEXT;
-- ALTER TABLE chunks ADD COLUMN vector_dim INTEGER DEFAULT 1024;
-- ALTER TABLE chunks ADD COLUMN embedding_stored INTEGER DEFAULT 0;
