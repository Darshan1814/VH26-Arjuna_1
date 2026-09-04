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
Groq LLM (strict evidence-only prompt)
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
| LLM       | Groq (llama-3.1-70b-versatile)   |
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
│   │   │   ├── llm/        # Groq client, prompt templates
│   │   │   └── citations/  # Citation builder
│   │   └── rag/            # Pipeline orchestrator
│   └── tests/              # Pytest tests
│
├── database/               # SQL scripts
│   ├── schema.sql          # Full Supabase schema (paste in SQL Editor)
│   ├── seed.sql            # Demo data
│   └── migrations/         # Future schema migrations
│
├── manuals/                # PDF manual uploads
├── docker-compose.yml      # Docker Compose services
├── .env.example            # Environment variable template
├── Makefile                # Convenience commands
└── README.md               # This file
```

## Requirements

- **Docker** (Docker Desktop or CLI with Docker Compose)
- **Groq API Key** (free tier available)
- **Supabase Project** (free tier available)

## Quick Start

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env with your credentials (see below)
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the contents of `database/schema.sql`
3. Click **Run** to create all tables and indexes
4. Optionally run `database/seed.sql` for demo data
5. Create a storage bucket named `manuals`:
   - Go to **Storage** → **New Bucket** → Name: `manuals` → Public: No

### 3. Get credentials

Copy these values into your `.env` file:

| Variable | Where to find it |
|----------|-----------------|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API → `service_role` key (secret) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → `anon` key (public) |
| `DATABASE_URL` | Supabase → Settings → Database → Connection string → URI |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_PUBLISHABLE_KEY |

### 4. Start the application

```bash
docker compose up --build
```

Or use the Makefile:

```bash
make up
```

Services:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

> **Note:** First startup will be slow as Docker builds images and downloads
> ML models (~2-3 GB). Subsequent starts use cached layers and models.

## Environment Variables

```bash
# Required
GROQ_API_KEY=          # Groq API key
SUPABASE_URL=          # Supabase project URL
SUPABASE_SECRET_KEY=   # Service role key (NEVER expose to frontend)
DATABASE_URL=          # PostgreSQL connection string

# Optional (have defaults)
GROQ_MODEL=llama-3.1-70b-versatile
EMBEDDING_MODEL=BAAI/bge-m3
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
SUPABASE_STORAGE_BUCKET=manuals
LOG_LEVEL=info
```

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

### Example API Calls

**Health check:**
```bash
curl http://localhost:8000/health
```

**Upload a manual:**
```bash
curl -X POST http://localhost:8000/api/manuals/upload \
  -F "file=@./manuals/CNC-X100_Manual.pdf" \
  -F "machine_id=11111111-1111-1111-1111-111111111111" \
  -F "title=CNC-X100 Service Manual"
```

**RAG query:**
```bash
curl -X POST http://localhost:8000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What does error E101 mean on CNC-X100?", "machine_id": "11111111-1111-1111-1111-111111111111"}'
```

**Ambiguous query (no machine specified):**
```bash
curl -X POST http://localhost:8000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What does E101 mean?"}'
```

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
2. Insufficient evidence → explicit "I don't know" response
3. Context assembled with manual/section/page metadata
4. Groq LLM generates structured JSON with strict evidence-only prompt
5. Citations built from retrieved chunk metadata

### Hallucination Prevention
- LLM prompt explicitly prohibits answers not supported by retrieved evidence
- Retrieval confidence threshold prevents generation on weak evidence
- Ambiguity detection for error codes appearing in multiple machine manuals

## How to Obtain Credentials

### Groq API Key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up / Sign in
3. Navigate to **API Keys**
4. Click **Create API Key**
5. Copy the key into `GROQ_API_KEY` in `.env`

### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project** → Sign in with GitHub
3. Create a new project (choose a region, set a database password)
4. Wait for the project to finish setting up
5. Go to **Settings → API**:
   - Copy **Project URL** → `SUPABASE_URL`
   - Copy **anon public** key → `SUPABASE_PUBLISHABLE_KEY`
   - Copy **service_role secret** key → `SUPABASE_SECRET_KEY`
6. Go to **Settings → Database**:
   - Copy **Connection string (URI)** → `DATABASE_URL`
   - Replace `[YOUR-PASSWORD]` with your database password

## Future Architecture

The project is structured to support future deployment with:

- **AWS** (ECS/EKS for container orchestration)
- **Kubernetes** (frontend, backend, and worker services)
- **Jenkins** (CI/CD pipeline)
- **Nginx/Ingress** (reverse proxy and TLS termination)
- **Worker Service** (async PDF ingestion and embedding generation)

These files are **not included yet** and will be added in a future phase.

## License

Private — All rights reserved.
