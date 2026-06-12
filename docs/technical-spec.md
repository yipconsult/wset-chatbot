# WSET Chatbot — Technical Specification

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)            │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐ │
│  │ MCQ Panel│ │ AI Chat  │ │Dashboard│ │Syllabus   │ │
│  │          │ │ Widget   │ │         │ │ Navigator │ │
│  └──────────┘ └──────────┘ └────────┘ └───────────┘ │
└──────────────────────┬───────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────┴───────────────────────────────┐
│                   Backend (FastAPI)                    │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐ │
│  │ MCQ      │ │ Chat/    │ │Progress│ │Auth       │ │
│  │ Engine   │ │ RAG Svc  │ │Tracker │ │Service    │ │
│  └──────────┘ └──────────┘ └────────┘ └───────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │              Data Layer (SQLAlchemy)              │ │
│  └──────────────────────────────────────────────────┘ │
└──────┬──────────────┬──────────────┬──────────────────┘
       │              │              │
┌──────┴──────┐ ┌─────┴─────┐ ┌─────┴──────┐
│  PostgreSQL │ │ ChromaDB  │ │ File Store │
│  (user data,│ │ (vectors) │ │ (PDFs,     │
│   MCQs,     │ │           │ │  images)   │
│   progress) │ │           │ │            │
└─────────────┘ └───────────┘ └────────────┘
```

## Technology Stack

### Backend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | FastAPI (Python 3.11+) | Async support, OpenAPI auto-docs, good ecosystem |
| ORM | SQLAlchemy 2.0 + Alembic | Mature, async support |
| Database | PostgreSQL 15 | JSON fields, full-text search, pgvector support |
| Vector DB | ChromaDB (dev) → pgvector (prod) | Lightweight for local dev; pgvector for production |
| Auth | python-jose (JWT) + passlib | Stateless auth, industry standard |
| LLM | Anthropic Claude API (primary) | RAG grounding, citation support |
| Embeddings | text-embedding-3-small (OpenAI) or voyage-2 | Cost-effective for document chunking |
| Task Queue | Celery + Redis (future phase) | Document ingestion, batch processing |
| Caching | Redis | LLM response cache, rate limiting |

### Frontend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | React 18 + TypeScript | Strong typing, component ecosystem |
| Build Tool | Vite | Fast HMR, ESBuild-based |
| Styling | Tailwind CSS | Utility-first, rapid UI development |
| State Mgmt | React Context + useReducer | Sufficient for this app's complexity |
| HTTP Client | Axios | Interceptors for auth tokens |
| Markdown | react-markdown | Render AI tutor responses |
| Charts | Recharts | Dashboard visualizations |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx (production) |
| CI/CD | GitHub Actions |
| Hosting | Hetzner / Railway / Fly.io (TBD) |

## Data Model

### Core Entities

```
User
├── id: UUID
├── email: str (unique)
├── password_hash: str
├── wset_level: enum(L2, L3)
├── created_at: datetime
└── updated_at: datetime

Question
├── id: UUID
├── text: str (the question stem)
├── options: JSON (array of 4 strings)
├── correct_index: int (0-3)
├── explanation: str (why correct, why distractors wrong)
├── topic: str (e.g., "france.bordeaux")
├── sub_topic: str (nullable, e.g., "france.bordeaux.classifications")
├── difficulty: enum(L1, L2, L3)
├── source_ref: str (nullable, e.g., "WSET L3 Textbook, Ch. 15")
├── image_url: str (nullable)
├── is_active: bool
├── created_at: datetime
└── updated_at: datetime

UserAnswer
├── id: UUID
├── user_id: FK → User
├── question_id: FK → Question
├── selected_index: int
├── is_correct: bool
├── mode: enum(study, exam)
├── session_id: UUID (group answers from same session)
├── time_spent_ms: int (nullable)
├── created_at: datetime

ChatThread
├── id: UUID
├── user_id: FK → User
├── title: str (auto-generated from first message)
├── created_at: datetime
└── updated_at: datetime

ChatMessage
├── id: UUID
├── thread_id: FK → ChatThread
├── role: enum(user, assistant)
├── content: str (markdown)
├── citations: JSON (nullable, array of source references)
├── created_at: datetime

UserTopicProgress (materialized / computed)
├── user_id: FK → User
├── topic: str
├── total_answered: int
├── correct_count: int
├── last_practiced_at: datetime
└── mastery_level: float (0.0 - 1.0)

DocumentChunk (for RAG)
├── id: UUID
├── document_name: str
├── chunk_index: int
├── content: str
├── embedding: vector(1536)
├── topic_tags: JSON (array of topic strings)
└── metadata: JSON
```

## API Design (REST)

### Auth
```
POST   /api/auth/register          # Create account
POST   /api/auth/login             # Get JWT token
POST   /api/auth/refresh           # Refresh token
GET    /api/auth/me                # Current user info
```

### MCQ Engine
```
GET    /api/questions              # List questions (paginated, filterable by topic/difficulty)
GET    /api/questions/:id          # Get single question
POST   /api/questions/:id/answer   # Submit answer → returns correct/incorrect + explanation
GET    /api/questions/review       # Get questions for spaced repetition review
GET    /api/questions/weak-areas   # Get questions from weak topics
```

### AI Tutor
```
POST   /api/chat/threads           # Create new chat thread
GET    /api/chat/threads           # List user's threads
GET    /api/chat/threads/:id       # Get thread with messages
POST   /api/chat/threads/:id/messages  # Send message → stream SSE response
DELETE /api/chat/threads/:id       # Delete thread
```

### Progress & Analytics
```
GET    /api/progress/overview      # Dashboard summary stats
GET    /api/progress/topics        # Per-topic breakdown
GET    /api/progress/history       # Answer history (paginated)
GET    /api/progress/sessions      # Session history
```

### Exam Mode
```
POST   /api/exam/start             # Start exam session (returns question set)
POST   /api/exam/:session_id/answer # Submit answer (no feedback until end)
POST   /api/exam/:session_id/finish # End exam, get score + review
```

### Syllabus
```
GET    /api/syllabus               # Get full topic tree
GET    /api/syllabus/:topic        # Get topic details with stats
```

## RAG Pipeline

```
1. Document Ingestion (offline / admin)
   PDF/Word → text extraction → chunking (512 tokens, 64 overlap)
   → embedding (voyage-2 or text-embedding-3-small)
   → store in ChromaDB/pgvector with metadata

2. Query Time (online)
   User question → embed query → similarity search (top-k=5)
   → rerank by relevance → build prompt context
   → LLM generates answer with citations → stream to client

3. Caching
   Cache common query embeddings and responses (Redis)
   TTL-based invalidation; manual invalidation on content update
```

## Source Materials Storage

WSET materials are copyrighted. They are stored outside the git repo and never committed.

```
data/                          ← gitignored
├── raw/                       ← user uploads (original PDFs, DOCs)
│   ├── booklets/
│   │   ├── wset-l2-textbook.pdf
│   │   └── wset-l3-textbook.pdf
│   └── exam-papers/
│       ├── l2-paper-1.pdf
│       ├── l2-answers-1.pdf
│       └── ...
└── processed/                 ← extraction output, ready for import
    ├── questions.csv          ← curated questions for DB import
    └── chunks/                ← chunked text for embedding
```

### Ingestion Scripts

Located in `backend/scripts/`:

| Script | Input | Output | When to Run |
|--------|-------|--------|-------------|
| `ingest_questions.py` | CSV with columns: text, option_a, option_b, option_c, option_d, correct_index, explanation, topic, difficulty, source_ref | Inserts into `questions` table | Before Phase 1, and whenever new exam papers are added |
| `ingest_documents.py` | PDF files from `data/raw/booklets/` | Chunks + embeds → ChromaDB | Before Phase 2, and whenever booklets are updated |

### CSV Format for Question Import

```csv
text,option_a,option_b,option_c,option_d,correct_index,explanation,topic,difficulty,source_ref
"Which commune is on the Right Bank?","Pauillac","Saint-Émilion","Margaux","Pessac-Léognan",1,"Saint-Émilion is in the Libournais on the Right Bank. The others are Left Bank.","france.bordeaux",L3,"WSET L3 Textbook Ch.15"
```

## Security

- Passwords: bcrypt hashed
- JWT: RS256, 24h access / 7d refresh, stored in httpOnly cookie or Authorization header
- Rate limiting: 20 req/min for AI chat, 60 req/min for MCQ
- Input validation: Pydantic models on all endpoints
- CORS: restricted to frontend origin
- No WSET copyrighted content served unauthenticated
