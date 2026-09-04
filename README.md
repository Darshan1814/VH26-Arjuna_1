# Machine Troubleshooter

AI-powered machine troubleshooting system using Retrieval-Augmented Generation (RAG) with source citations from service manuals.

## Architecture

```
User Query
    ↓
Query Analysis (error codes, machine detection)
    ↓
Hybrid Retrieval (exact match + vector search + metadata filtering)
    ↓
Reranking (BGE cross-encoder)
    ↓
Evidence Check (hallucination prevention)
    ↓
Context-Verified Generation (strict evidence-only prompt)
    ↓
Structured Response + Citations
```

### Tech Stack

| Layer     | Technology                       |
|-----------|----------------------------------|
| Frontend  | Next.js 14, TypeScript, Tailwind CSS |
| Backend   | Python 3.11, FastAPI             |
| Database  | Supabase PostgreSQL + pgvector   |
| Storage   | Supabase Storage (PDF manuals)   |
| Embeddings| BAAI/bge-m3 (local, 1024-dim)    |
| Reranker  | BAAI/bge-reranker-v2-m3 (local)  |
| Model     | Azure OpenAI                     |
| OCR       | Tesseract                        |
| PDF       | PyMuPDF                          |
| DevOps    | Docker Compose                   |

## Folder Structure

```
machine-troubleshooter/
├── frontend/               # Next.js application
│   ├── app/                # App Router pages
│   │   ├── chat/           # Chatbot interface
│   │   └── process-flow/   # RAG pipeline visualization
│   ├── components/         # Reusable UI components
│   │   ├── chat/           # Chat-specific components
│   │   ├── layout/         # Navbar, layout components
│   │   └── theme/          # Theme provider
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # API client, utilities
│   └── types/              # TypeScript type definitions
│
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── api/            # REST API routes
│   │   ├── core/           # Config, database, logging
│   │   ├── models/         # Data models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # RAG pipeline services
│   │   │   ├── ingestion/  # PDF processing, OCR, chunking
│   │   │   ├── embeddings/ # BGE-M3 embedding generation
│   │   │   ├── retrieval/  # Query analysis, hybrid search
│   │   │   ├── reranking/  # Cross-encoder reranking
│   │   │   ├── generation.py # Response generator
│   │   │   └── citations/  # Citation builder
│   │   └── rag/            # Pipeline orchestrator
│
├── database/               # SQL scripts
│   ├── schema.sql          # Full Supabase schema (paste in SQL Editor)
│   └── migrations/         # Schema migrations
│
├── manuals/                # PDF manual uploads
├── docker-compose.yml      # Docker Compose services
├── .env.example            # Environment variable template
├── Makefile                # Convenience commands
└── README.md               # Documentation
```

## Quick Start

### 1. Configure environment

Credentials are configured in `.env`.

### 2. Set up Supabase Database

1. Open your Supabase Project Dashboard
2. Navigate to **SQL Editor**
3. Paste and run `database/schema.sql` to initialize tables, pgvector, indexes, and search functions.
4. Ensure the `manuals` storage bucket is present in Supabase Storage.

### 3. Start the application

```bash
docker compose up --build
```

Services:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/health` | Health check |
| GET    | `/api/machines` | List machines |
| GET    | `/api/manuals` | List manuals |
| POST   | `/api/manuals/upload` | Upload a PDF manual |
| POST   | `/api/rag/query` | Troubleshooting query |
| POST   | `/api/conversations` | Create conversation |
| GET    | `/api/conversations/{id}` | Get conversation |
| GET    | `/api/conversations/{id}/messages` | List messages |
| POST   | `/api/conversations/{id}/messages` | Add message |

## RAG Pipeline

### Ingestion
1. PDF uploaded via API → stored in Supabase Storage
2. PyMuPDF extracts text per page, detects sections/headings
3. Tesseract OCR runs on scanned pages (low text density)
4. Text split into overlapping chunks (~512 tokens) with metadata
5. Error codes extracted via regex (E101, ERR-42, etc.)
6. BGE-M3 generates 1024-dim embeddings per chunk
7. Chunks + embeddings stored in Supabase PostgreSQL + pgvector

### Retrieval
1. **Query Analysis**: Detect error codes, machine references, query type
2. **Exact Match**: Error codes matched against `error_codes[]` column
3. **Vector Search**: Query embedded → cosine similarity via pgvector
4. **Metadata Filter**: Machine ID filter prevents cross-manual confusion
5. **Reranking**: BGE cross-encoder rescores top results for precision

### Generation
1. Evidence sufficiency check (minimum chunks + minimum score)
2. Insufficient evidence → explicit informative response
3. Context assembled with manual/section/page metadata
4. Structured JSON generated with strict evidence-only prompt
5. Citations built from retrieved chunk metadata
