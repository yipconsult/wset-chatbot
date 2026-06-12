# WSET Chatbot — Development Log

> **Purpose**: Single source of truth for development progress. Each entry records what was done, what decision was made, and what's next.
>
> **How to use**: Claude and the developer both update this file. After each coding session, add an entry. Mark completed to-dos with `[x]`.

---

## Current State

**Phase**: Phases 1-5 complete
**Last Updated**: 2026-06-09
**Status**: All core features working — MCQ, Exam, AI Tutor, Progress Dashboard, Spaced Repetition, Syllabus Browser

---

## To-Do List

### Phase 0: Project Scaffold
- [x] Initialize FastAPI project structure
- [x] Initialize React + Vite + Tailwind project
- [x] Docker Compose with PostgreSQL + ChromaDB
- [x] User model + Alembic migration
- [x] Auth endpoints (register, login, JWT)
- [x] React app shell (login, register, protected routes)
- [x] CI pipeline (lint, type-check, test)

### Phase 1: MCQ Engine
- [x] Seed 50+ WSET questions from provided materials (241 questions parsed)
- [x] Question model + CRUD
- [x] MCQ API endpoints
- [x] MCQ UI component
- [x] MCQ Practice page
- [x] Topic filter
- [x] Basic progress tracking

### Phase 2: AI Tutor
- [x] Document ingestion pipeline
- [x] RAG retrieval endpoints
- [x] Streaming chat API
- [x] Chat UI with markdown rendering
- [x] Thread persistence

### Phase 3: Exam Mode
- [x] Exam session model + endpoints
- [x] Exam config (question count, time limit)
- [x] Exam UI with timer
- [x] Exam results screen
- [x] Mode switcher (Study | Exam)

### Phase 4: Progress Dashboard & Spaced Repetition
- [x] Dashboard stats API (per-topic breakdown)
- [x] Dashboard UI (topic progress bars, weak areas, review CTA)
- [x] Weak areas detection (topics below 60% with 3+ answers)
- [x] Spaced repetition engine (SM-2-lite algorithm)
- [x] Review queue UI (Review page with SR-filtered questions)

### Phase 5: Syllabus Browser & Polish
- [x] Syllabus tree API
- [x] Syllabus navigation UI
- [x] Topic detail page (key facts from RAG)
- [x] Report wrong answer mechanism
- [x] Error boundary component
- [ ] Guest mode (deferred — not requested)
- [ ] Mobile responsive polish (deferred — Tailwind responsive classes in place)
- [ ] Production deployment config (deferred — no Docker on this machine)

---

## Development Log

### 2026-06-05 — Project Initialization

**Actions**:
- Created project directory at `WSET Chatbot/`
- Created documentation structure:
  - `docs/requirements.md` — functional & non-functional requirements
  - `docs/technical-spec.md` — architecture, stack, data model, API design
  - `docs/design-guidelines.md` — color palette, typography, component patterns
  - `docs/execution-plan.md` — 6-phase development plan with milestones
  - `DEVLOG.md` — this file
  - `CLAUDE.md` — project guidance for Claude

**Decisions**:
- New project directory, separate from existing "History Pasting" wine fair app
- Reuse FastAPI + React + Vite stack pattern from previous project
- Phase 1 (MCQ) and Phase 2 (AI Tutor) are parallelizable after scaffold phase

**Next**: Begin Phase 0 — initialize backend and frontend project scaffolds.

---

### 2026-06-05 — Source Materials Uploaded

**Actions**:
- User uploaded all WSET source materials to `data/raw/`:
  - **Booklets**: WSET1.pdf, WSET2.pdf, WSET2 Notes.pdf, WSET3.pdf
  - **Exam Papers**: WSET1 Q&A.pdf, WSET2 Exam Paper.pdf, WSET2 Q&A.pdf, WSET3 Exam Paper 2526.pdf
- Noted: WSET Level 1 materials now available — scope expanded to include L1 support
- `.gitignore` created, `data/` directory confirmed excluded from git

**Decisions**:
- Support all three levels (L1, L2, L3) since materials are available
- L1 will be treated as a separate difficulty tier in the Question model

---

### 2026-06-05 — Phase 0 Complete: Project Scaffold

**Actions**:
- **Backend** (`backend/`):
  - FastAPI app with CORS, health check, modular structure (routers, services, models, schemas, middleware)
  - Async SQLAlchemy 2.0 + PostgreSQL via pgvector/pgvector:pg15 image
  - User model: id (UUID), email, password_hash (bcrypt), wset_level (L1/L2/L3 enum), timestamps
  - Alembic configured for async migrations (env.py, alembic.ini, script.py.mako)
  - Auth service: JWT access + refresh tokens (python-jose), bcrypt hashing (passlib), HTTPBearer dependency
  - Auth router: POST /register, POST /login, GET /me, POST /refresh
  - JWT middleware: `get_current_user` dependency extracts + validates token, returns User
  - Tests: 7 async tests covering register, duplicate, login success, wrong password, me endpoint, no token, invalid token
  - pyproject.toml with ruff, mypy, pytest config

- **Frontend** (`frontend/`):
  - React 18 + TypeScript + Vite scaffolded via `create-vite`
  - Tailwind CSS 4 with `@tailwindcss/vite` plugin, Inter + Playfair Display fonts
  - Auth context: login, register, logout, fetchUser, auto-restore from localStorage
  - API client (axios): base URL from env var, auto-attach JWT, 401 interceptor → redirect to login
  - Pages: Login, Register, Dashboard (level-aware header with sign-out)
  - App.tsx: BrowserRouter with ProtectedRoute (redirects to /login) and PublicRoute (redirects to /) wrappers
  - TypeScript compiles clean (`tsc --noEmit` passes)

- **Infrastructure**:
  - Docker Compose: db (pgvector:pg15), chroma (chromadb/chroma), backend (FastAPI), frontend (Vite dev server)
  - All services networked, backend waits for db healthy + chroma started
  - Frontend Dockerfile (node:20-alpine), Backend Dockerfile (python:3.11-slim)

- **CI/CD** (`.github/workflows/ci.yml`):
  - Backend job: install deps, ruff lint, mypy type-check, pytest with PostgreSQL service container
  - Frontend job: install deps, tsc type-check, eslint, vite build

**Decisions**:
- pgvector image used from day 1 (not plain PostgreSQL) to avoid migration later for RAG embeddings
- JWT access token = 24h, refresh = 7d — stateless, no blacklist for MVP
- No email verification in Phase 0 — can add in Phase 5 polish
- ChromaDB pinned to `chromadb/chroma:latest` — will pin version when stable

**Next**: Begin Phase 1 — MCQ Engine. Start by parsing exam papers to create the question seed CSV.

---

### 2026-06-07 — Phase 1 Complete: MCQ Engine

**Actions**:
- Extracted text from all 4 exam PDFs using pdf-parse → `data/processed/*.txt`
- Parsed 241 WSET Level 2 questions with correct answers from WSET2 Q&A into `data/processed/questions-wset2.json`
- Built Node.js Express API server (`server.js`) replacing the mock:
  - `GET /api/questions` — paginated list (25 per page), 241 total
  - `GET /api/questions/:id` — single question
  - `POST /api/questions/:id/answer` — submit answer, returns correct/incorrect + explanation + correct answer
  - `GET /api/progress/overview` — score %, questions answered, correct/incorrect counts
  - Auth endpoints (register, login, me) preserved
- Built MCQ frontend:
  - `McqCard` component — question display, 4-clickable options, correct/incorrect reveal with green/red styling, explanation box, prev/next navigation, progress bar
  - `Practice` page — loads 25 questions, tracks position, shows live score in header
  - `Dashboard` page — stat cards (score %, questions, attempts), correct/incorrect bar, "Start Practice" CTA
  - API client (`api.ts`) — typed functions for questions, answer submission, progress
- Integration tested: register → load questions → answer → progress updates correctly

**Decisions**:
- Backend built in Node.js/Express instead of Python/FastAPI due to Python 3.6 being the only local Python (too old for FastAPI/SQLAlchemy 2.0). API contract is identical to the Python spec.
- Questions stored as JSON file loaded at startup (simple, fast, no DB dependency). Will migrate to PostgreSQL when Docker is available.
- 241 questions from WSET2 — L1 and L3 papers not yet parsed (have answer keys but different format).
- Topic tagging deferred — all 241 questions currently tagged as "general". Chapter structure exists in source; can add topic mapping later.

**Next**: Phase 2 (AI Tutor) or Phase 3 (Exam Mode). Recommend Exam Mode next since it builds directly on MCQ engine.

---

### 2026-06-08 — Phase 3 Complete: Exam Mode

**Actions**:
- Backend exam endpoints in `server.js`:
  - `POST /api/exam/start` — shuffle questions, create session, return questions without answers
  - `POST /api/exam/:sessionId/answer` — record selected index silently (no correctness revealed)
  - `POST /api/exam/:sessionId/finish` — grade all answers, record in history, return score + per-question review
  - In-memory exam session store with userId, questions, answers map, timer config, finished flag
  - Auth helper refactor (`requireUser`) to reduce token-parsing duplication
- Frontend Exam page (`Exam.tsx`) — three states:
  - **Config**: question count selector (10/25/50), time limit selector (15/30/45/60 min), "Start Exam" button
  - **Running**: question card (no feedback on selection), timer bar (turns red at <60s), progress bar, "Finish Exam" button on last question, auto-finish when timer hits 0
  - **Finished**: large score %, correct/incorrect/skipped breakdown, per-question review (correct answer shown, your wrong answer shown in red, skipped flagged)
- Mode switcher links:
  - Dashboard: "Study Mode" (solid) and "Exam Mode" (outlined) side by side
  - Practice page header: "Exam Mode" link in gold
  - Exam config: links to Study Mode and Dashboard
- Cleaned up unused imports in Practice.tsx

**Decisions**:
- Exam answers not revealed until finish — matches real WSET exam conditions
- Timer runs client-side with `setInterval`; auto-submits on timeout
- Results stored in same `userAnswers` history as study mode (tagged `mode: 'exam'`)
- Questions shuffled randomly per exam session for variety

**Next**: Phase 2 (AI Tutor with RAG) or Phase 4 (Progress Dashboard + Spaced Repetition). Dashboard currently shows basic stats; Phase 4 would add per-topic tracking, weak areas, and spaced repetition.

---

### 2026-06-08 — Phase 2 Complete: AI Tutor (RAG + DeepSeek)

**Actions**:
- **Knowledge base ingestion** (`rag.js` loadKnowledgeBase):
  - Extracted 17 text chunks from WSET2 Notes (29K chars of extractable text)
  - Loaded 241 Q&A pairs as knowledge chunks (Q: question text, A: correct answer)
  - Loaded exam paper text chunks (WSET2 Q&A, WSET2 Exam Paper, WSET3 Exam Paper)
  - 339 total knowledge chunks with source attribution and topic detection
  - WSET1, WSET2, WSET3 main textbooks are scanned/image-based — text extraction returns empty
- **RAG pipeline** (`rag.js`):
  - Simple paragraph-based chunking (max 800 chars, splits on paragraph boundaries)
  - Keyword search with scoring: term frequency + phrase match bonus + topic match bonus
  - Topic detection across 25+ wine topics (regions, varieties, styles, spirits)
  - System prompt builder: injects top-5 relevant chunks as reference context
  - DeepSeek API integration: OpenAI-compatible streaming chat via `fetch()` + SSE
  - Model: `deepseek-chat`, temperature 0.3, max 1500 tokens
- **Backend chat endpoints** (`server.js`):
  - `POST /api/chat/threads` — create thread, auto-titled from first message
  - `GET /api/chat/threads` — list user's threads sorted by recent activity
  - `GET /api/chat/threads/:id` — get full thread with messages
  - `POST /api/chat/threads/:id/messages` — send message, SSE stream response, save to thread
  - `DELETE /api/chat/threads/:id` — delete thread
  - Last 10 messages sent as conversation history to DeepSeek
  - Assistant response captured from stream and saved with citations
- **Frontend Chat UI** (`Chat.tsx`):
  - Collapsible thread sidebar with create/select/delete
  - Full ReactMarkdown rendering for assistant messages with prose styling
  - Real-time SSE streaming display with typing indicator
  - Prompt suggestion chips for wine topics
  - Empty state with welcome message and quick prompts
  - Auto-scroll to latest message
  - Enter to send, Shift+Enter for newline
- **Routing** (`App.tsx`): `/chat` route added with ProtectedRoute wrapper
- **Dashboard**: "AI Tutor" button (gold outline) added alongside Study/Exam mode buttons

**Decisions**:
- Keyword search over embeddings: no Docker/ChromaDB needed for MVP, works well for factoid WSET content
- In-memory thread store matches existing user/answer/exam stores — simple and sufficient for local dev
- Assistant message captured by monkey-patching `res.write` to accumulate full response text
- Citations deduplicated from top-5 search results before saving
- react-markdown used for rendering (already in the stack from Phase 0)
- Scanned textbook PDFs deferred — would need tesseract.js OCR; 339 chunks from WSET2 Notes + Q&A + exam papers provide usable coverage

**Next**: Phase 4 — Progress Dashboard improvements (per-topic tracking, weak areas detection) and Spaced Repetition engine.

---

### 2026-06-09 — Phase 5 Complete: Syllabus Browser & Polish

**Actions**:
- **Syllabus tree API** (`GET /api/syllabus`):
  - Static syllabus tree covering 10 WSET L2 sections: Tasting & Pairing, White Grapes, Black Grapes, France, Italy/Spain/Portugal, Old World, New World, Sparkling, Fortified, Spirits, General
  - Each section has sub-topics mapped to auto-tagged question topics
  - Per-topic stats merged from user's answer history: question count, score %, mastery level
  - Sections with no tagged questions are excluded dynamically
  - 9 active sections rendered (Germany and Spirits have 0 tagged questions currently)
- **Syllabus Browser page** (`Syllabus.tsx`):
  - Expandable accordion UI — click section to reveal sub-topics
  - Each sub-topic shows: name, question count, progress bar, mastery badge, score %
  - Click sub-topic → navigates to `/topic/:id`
  - Empty/loading states
- **Topic Detail page** (`TopicDetail.tsx`):
  - Header with topic name, question count, mastery badge, progress bar
  - "Practise This Topic" button → `/practice?topic=X`
  - Key Facts section: 3 relevant knowledge chunks from rag.js via `GET /api/topics/:id`
  - ReactMarkdown rendering for fact content
  - Error/not-found states
- **Report wrong answer** (McqCard + `POST /api/questions/:id/report`):
  - "Report an issue" link appears after answer reveal in feedback box
  - POSTs to server with optional note
  - Server logs report to console and stores in `reportedQuestions` array
  - Button changes to "✓ Reported — thank you" after submission
- **Error boundary** (`ErrorBoundary.tsx`):
  - Class component wrapping every protected route
  - Catches render errors, shows friendly message + "Reload Page" button
  - Integrated into `ProtectedRoute` in App.tsx
- **Navigation**: Syllabus button added to Dashboard (gray outline), `/syllabus` and `/topic/:topicId` routes in App.tsx

**Decisions**:
- Syllabus tree is static JSON — no migration needed, maps existing auto-tagged topics to curriculum structure
- Topic detail uses `searchChunks(topic, 3)` from rag.js for key facts (same keyword search as AI Tutor)
- Report button is in-feedback-box — only visible after answering, keeps UI clean
- Error boundary wraps ProtectedRoute (not individual pages) — catches errors in all auth-protected pages
- Guest mode, production Docker config deferred — not needed for local dev

**Next**: Phase 6 — Content expansion (more questions, OCR for scanned textbooks), analytics, and continuous improvement.

---

### 2026-06-08 — Phase 4 Complete: Progress Dashboard & Spaced Repetition

**Actions**:
- **Auto-tagging**: Questions now tagged at server startup using `detectTopic()` from `rag.js`. 125/241 questions tagged with specific wine topics (sparkling, port, chardonnay, cabernet sauvignon, etc.), remainder tagged "general".
- **Per-topic progress** (`GET /api/progress/topics`):
  - Returns all topics with question counts, answered counts, score %, and mastery level
  - Mastery levels: beginner (<60%), developing (60-79%), proficient (80-94%), mastered (95%+)
  - Weak areas: topics with score <60% and 3+ answers
- **Enhanced progress overview** (`GET /api/progress/overview`):
  - Added `weak_areas` field — list of topics needing attention
  - Computed from latest answer per question, aggregated by topic
- **Spaced Repetition engine** (SM-2-lite):
  - New `reviewState` Map: userId → Map(questionId → SR data)
  - Algorithm: correct → double interval (1→6→×EF), wrong → reset to 1 day
  - `updateReviewState()` called on every answer (study mode + exam finish)
  - `GET /api/questions/review` returns due questions in priority order: overdue → wrong but not due → unseen
- **Dashboard enhancements** (`Dashboard.tsx`):
  - Topic breakdown section with per-topic progress bars colored by mastery level
  - Weak areas alert with "Focus areas" chips linking to practice by topic
  - "Review Due (N)" CTA button (red, appears when SR items overdue)
  - Fetches topics and review stats on mount
- **Review Queue page** (`Review.tsx`):
  - Patterned after Practice.tsx but fetches from `/api/questions/review`
  - Header shows "Review Queue — N due, M new"
  - Empty state: "All caught up!" with link to Study Mode
  - After answering, SR state updates and questions leave the queue
- **Routing**: `/review` route added to App.tsx

**Decisions**:
- Auto-tagging via keyword matching (same `detectTopic` from RAG module) — no manual tagging needed
- SM-2-lite over full SM-2: simplified ease factor adjustment (fixed -0.2 on wrong, no quality-of-response dimension)
- Review endpoint placed before `GET /api/questions/:id` to avoid route conflict ("review" matching as :id)
- Topic links on Dashboard navigate to `/practice?topic=X` — Practice page already supports topic param via `fetchQuestions({ topic })`
- SR state is in-memory (matches other stores) — will need migration to persistent storage eventually

**Next**: Phase 5 — Syllabus Browser, UI polish, mobile responsiveness, and production deployment config.

---

## Change Log

| Date | File | Change |
|------|------|--------|
| 2026-06-05 | All docs | Initial creation |
| 2026-06-05 | DEVLOG.md | Recorded source materials upload |
| 2026-06-05 | All backend, frontend, infra | Phase 0 scaffold complete |
| 2026-06-07 | server.js, frontend MCQ | Phase 1 MCQ Engine complete |
| 2026-06-08 | server.js, frontend Exam | Phase 3 Exam Mode complete |
| 2026-06-08 | rag.js, server.js, frontend Chat | Phase 2 AI Tutor complete |
| 2026-06-08 | server.js, frontend Dashboard/Review | Phase 4 Progress Dashboard & Spaced Repetition complete |
| 2026-06-09 | server.js, frontend Syllabus/TopicDetail/McqCard | Phase 5 Syllabus Browser & Polish complete |
