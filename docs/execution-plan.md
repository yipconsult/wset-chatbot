# WSET Chatbot — Execution Plan

## Development Phases

Each phase is designed to produce a stable, working increment. No phase depends on speculative future work.

---

## Phase 0: Project Scaffold (Week 1)

**Goal**: Bootable backend + frontend with auth, ready to accept features.

### Tasks
- [ ] Initialize FastAPI project structure (`backend/`)
- [ ] Initialize React + Vite + Tailwind project (`frontend/`)
- [ ] Set up PostgreSQL + ChromaDB in Docker Compose
- [ ] Implement User model + migration (Alembic)
- [ ] Implement `/api/auth/register` and `/api/auth/login`
- [ ] JWT middleware on protected routes
- [ ] Basic React app shell: login/register pages, protected routes
- [ ] CI pipeline (lint, type-check, test on PR)

### Deliverables
- Docker Compose spins up backend + frontend + DB
- User can register, log in, see a blank dashboard
- All API calls require valid JWT

### Stop & Validate
- Run `docker compose up`, register a user via frontend, confirm JWT in dev tools
- Run backend tests

---

## Phase 1: MCQ Engine (Week 2–3)

**Goal**: Answer MCQs with immediate feedback. Core loop working end-to-end.

### Tasks
- [ ] Seed database with 50+ WSET questions (hand-curated from provided materials)
- [ ] Implement Question model + CRUD
- [ ] `GET /api/questions` with topic/difficulty filters, pagination
- [ ] `POST /api/questions/:id/answer` — validate, save UserAnswer, return feedback
- [ ] MCQ UI component: question card, option selection, reveal animation
- [ ] MCQ Practice page: fetch questions, navigate between them
- [ ] Topic filter dropdown on practice page
- [ ] Basic progress: questions answered count, correct %

### Deliverables
- User picks a topic → sees MCQs → answers → gets feedback
- Answers persisted to DB

### Stop & Validate
- Answer 20 questions across 3 topics. Confirm feedback correctness.
- Check answers appear in DB. Check progress count updates.

---

## Phase 2: AI Tutor (Week 4–5)

**Goal**: Natural language Q&A grounded in WSET materials.

### Tasks
- [ ] Document ingestion script: chunk PDFs → embed → store in ChromaDB
- [ ] Chat API: `POST /api/chat/threads/:id/messages` with SSE streaming
- [ ] RAG pipeline: embed query → retrieve top-5 chunks → build prompt → stream LLM response
- [ ] Chat UI component: message list, streaming text, markdown rendering
- [ ] Chat page with thread list sidebar
- [ ] Thread persistence (create, list, delete)
- [ ] LLM response caching for identical/similar queries

### Deliverables
- User asks a wine question → gets AI response grounded in WSET materials
- Chat history saved and retrievable

### Stop & Validate
- Ask 10 questions covering different topics. Verify factual accuracy against WSET materials.
- Verify citations appear and are correct.
- Close and reopen app — threads persist.

---

## Phase 3: Exam Mode (Week 6)

**Goal**: Timed exam simulation with score-at-end model.

### Tasks
- [ ] Exam session model + endpoints (`POST /api/exam/start`, `.../answer`, `.../finish`)
- [ ] Exam config: question count (25/50), time limit
- [ ] Exam UI: question counter, timer countdown, no feedback per-question
- [ ] Exam results screen: score, per-question review (shows correct/incorrect after)
- [ ] Mode switcher (Study | Exam) on practice page

### Deliverables
- User starts exam → answers under time pressure → sees score at end → reviews mistakes

### Stop & Validate
- Run a full 25-question timed exam. Confirm timer works, no feedback leaks, score is accurate.
- Test edge cases: timeout before finish, browser refresh during exam.

---

## Phase 4: Progress Dashboard & Spaced Repetition (Week 7–8)

**Goal**: Users can see their performance and review weak areas efficiently.

### Tasks
- [ ] `GET /api/progress/overview` — aggregated stats endpoint
- [ ] `GET /api/progress/topics` — per-topic breakdown
- [ ] Dashboard UI: stat cards, topic progress bars, recent activity
- [ ] Weak areas detection algorithm (topics below 60% correct)
- [ ] Spaced repetition: `GET /api/questions/review` returns due-for-review questions
- [ ] Review queue UI: "Review Weak Areas" button, spaced repetition schedule display
- [ ] Topic mastery calculation and visual indicator

### Deliverables
- Dashboard shows meaningful stats
- User clicks "Review Weak Areas" → gets personalized question set
- Previously wrong questions re-surface on schedule

### Stop & Validate
- Answer questions incorrectly in specific topics → confirm dashboard flags those topics
- Wait 1 day → confirm review queue surfaces them
- Dashboard stats match raw DB counts

---

## Phase 5: Syllabus Browser & Polish (Week 9–10)

**Goal**: Browseable syllabus, UI polish, and production readiness.

### Tasks
- [ ] `GET /api/syllabus` — full topic tree with per-topic stats
- [ ] Syllabus navigation page: expandable tree, click to start practice by topic
- [ ] Topic detail page: key facts + "Practice This Topic" CTA
- [ ] Guest mode (localStorage-only, no account)
- [ ] Responsive polish: test on mobile, tablet, desktop
- [ ] Error boundaries, loading states, empty states for all components
- [ ] Rate limiting, input sanitization audit
- [ ] Production Dockerfile + deployment config
- [ ] User feedback: in-app "Report wrong answer" button

### Deliverables
- Complete, polished app ready for beta users
- Deployable to production

### Stop & Validate
- Full walkthrough on mobile: register → practice → chat → exam → review dashboard
- Production build passes all checks
- Load test: 50 concurrent users, MCQ endpoint < 500ms p95

---

## Phase 6: Content Expansion & Continuous Improvement

**Goal**: Expand question bank to all three WSET levels, unlock scanned textbook content via OCR, add content management tools, and continuously improve AI accuracy.

Phase 6 is broken into 4 sub-phases that can be tackled in parallel or sequentially.

---

### Phase 6a: OCR & Knowledge Base Expansion (Week 1–2)

**Goal**: Extract text from scanned WSET textbooks to dramatically enrich the AI Tutor's knowledge base.

**Current state**: WSET1/2/3 textbooks are image-based PDFs — pdf-parse returned only 72-428 bytes. Only the WSET2 Notes cheat sheet (30KB) is usable.

**Tasks**:
- [ ] Install tesseract.js or sharp+ocr backend for image-based PDF processing
- [ ] Extract page images from WSET2.pdf, WSET3.pdf, WSET1.pdf
- [ ] Run OCR on each page, output to `data/processed/WSET2-ocr.txt`, etc.
- [ ] Clean OCR output (remove artifacts, fix common wine-term errors)
- [ ] Chunk OCR text and integrate into `rag.js` knowledge base
- [ ] Re-test AI Tutor with enriched knowledge — verify answers draw from textbook content
- [ ] Add source differentiation: "WSET2 Textbook", "WSET3 Textbook" vs "Exam Papers"

**Success criteria**:
- AI Tutor answers improve in depth and accuracy for complex topics (e.g., vinification, regional detail, appellation systems)
- Knowledge base grows from 339 chunks to 500+ chunks
- Citations correctly identify textbook vs exam paper sources

---

### Phase 6b: Question Bank Expansion (Week 1–2, parallel with 6a)

**Goal**: Parse WSET Level 1 and Level 3 questions to cover all three levels.

**Current state**: 241 WSET Level 2 questions parsed. WSET1 Q&A (100 questions) and WSET3 Exam Paper (100+ MCQs with explanations) are raw text, ready to parse.

**Tasks**:
- [ ] Parse `WSET1 Q&A.txt` → `questions-wset1.json` (~100 MCQs with topic sections)
- [ ] Parse `WSET3 Exam Paper 2526.txt` → `questions-wset3.json` (~100 MCQs with answers + detailed explanations)
- [ ] Parse any additional WSET2 Exam Paper questions not already in the bank
- [ ] Add `level` field (L1/L2/L3) to all question records
- [ ] Add `difficulty` field based on level (L1=easy, L2=medium, L3=hard)
- [ ] Create `questions-wset2.json` with properly mapped topic tags (not just auto-tagged at runtime)
- [ ] Update server to load all 3 question banks and serve level-filtered queries
- [ ] Update MCQ UI to show question level badge (L1/L2/L3)

**Success criteria**:
- Question bank: 100+ L1, 241 L2, 100+ L3 ≈ 440+ total questions
- Users can filter by level in Study Mode
- L3 questions have detailed explanations

---

### Phase 6c: Content Management Tools (Week 3)

**Goal**: Admin interface for reviewing and managing questions.

**Tasks**:
- [ ] Admin page: list all questions with search/filter by topic, level, status
- [ ] Question editor: edit text, options, correct answer, explanation, topic, difficulty
- [ ] Review reported questions: dashboard showing reported questions with notes, mark as resolved
- [ ] Bulk import: accept CSV upload, validate, merge into question bank
- [ ] Export: download question bank as JSON/CSV
- [ ] Add `PUT /api/questions/:id` and `GET /api/admin/reports` endpoints
- [ ] Simple admin auth (password-protected, no separate user system needed)

**Success criteria**:
- Can edit a question's explanation and see the change in the app
- Reported questions appear in admin panel with user notes
- CSV import creates valid questions

---

### Phase 6d: AI Tutor Quality & Analytics (Week 3–4)

**Goal**: Measure and improve AI answer quality, add usage analytics.

**Tasks**:
- [ ] Track most-asked topics in AI Tutor (aggregate chat message topics)
- [ ] Track most-missed questions (already have answer data — add endpoints)
- [ ] Analytics dashboard: top 10 missed questions, topic heatmap, usage trends
- [ ] A/B test prompt variations: store 2-3 system prompt variants, randomly assign per thread, compare answer quality
- [ ] Add feedback buttons to AI responses (thumbs up/down)
- [ ] Improve citation accuracy — ensure every factual claim links to a source chunk
- [ ] Add L2 vs L3 content differentiation in syllabus view and AI Tutor responses
- [ ] Image-based question support: add optional image URL field to Question model, render in McqCard

**Success criteria**:
- Analytics show which topics users struggle with most
- AI responses include source citations for every factual claim
- Level differentiation visible in answers ("For L2, the key point is X. At L3, you'd also need to know Y.")

---

### Dependency Graph (Phase 6)

```
Phase 5 (Syllabus + Polish)
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Phase 6a (OCR)    Phase 6b (Q Bank)   Phase 6c (Admin)
    │                  │                  │
    └──────────────────┼──────────────────┘
                       ▼
              Phase 6d (Quality & Analytics)
```

6a, 6b, and 6c are all independent after Phase 5 — they can be developed in any order or in parallel.
6d depends on having the enriched knowledge base (6a) and expanded questions (6b) to measure quality meaningfully.

---

### Raw Materials Audit

| Source | Size | Status | Phase 6 Use |
|--------|------|--------|-------------|
| WSET1.pdf | 7.2 MB | Scanned, 72B extracted | **6a**: OCR → textbook knowledge |
| WSET2.pdf | 12.7 MB | Scanned, 236B extracted | **6a**: OCR → textbook knowledge |
| WSET3.pdf | 41.2 MB | Scanned, 428B extracted | **6a**: OCR → textbook knowledge |
| WSET2 Notes.pdf | 288 KB | Text, 30KB extracted | Already in RAG |
| WSET1 Q&A.pdf | 361 KB | Text, 26KB extracted | **6b**: Parse 100 L1 questions |
| WSET2 Q&A.pdf | 596 KB | Text, 241 questions parsed | Done |
| WSET2 Exam Paper.pdf | 350 KB | Text, 23KB extracted | **6b**: Parse additional L2 questions |
| WSET3 Exam Paper 2526.pdf | 297 KB | Text, 40KB extracted | **6b**: Parse 100+ L3 questions with explanations |

---

### Key Milestones

| Milestone | Phase | Success Criteria |
|-----------|-------|-----------------|
| M1: Core MCQ Working | End of Phase 1 | 50 questions answerable with feedback |
| M2: AI Tutor Live | End of Phase 2 | RAG responses with citations |
| M3: Exam Simulation | End of Phase 3 | Timed exam with score-at-end |
| M4: Personalized Learning | End of Phase 4 | Spaced repetition + weak areas |
| M5: Beta Launch | End of Phase 5 | Full feature set, mobile-responsive |
| M6: Full Content Coverage | End of Phase 6b | 440+ questions across L1/L2/L3 |
| M7: Textbook-Grade AI | End of Phase 6a | AI Tutor draws from full textbook content |
| M8: Production Ready | End of Phase 6d | Analytics, quality metrics, admin tools |

---

## Dependency Graph

```
Phase 0 (Scaffold)
    │
    ▼
Phase 1 (MCQ Engine) ──────────────────────────┐
    │                                            │
    ▼                                            │
Phase 2 (AI Tutor)                              │
    │                                            │
    ▼                                            ▼
Phase 3 (Exam Mode)                 Phase 4 (Dashboard + SR)
    │                                            │
    └──────────────────┬─────────────────────────┘
                       ▼
              Phase 5 (Syllabus + Polish)
                       │
                       ▼
              Phase 6 (Ongoing)
```

Phase 1 and Phase 2 are independent after scaffold — they can be developed in parallel if there are multiple developers.

## Key Milestones

| Milestone | Phase | Success Criteria |
|-----------|-------|-----------------|
| M1: Core MCQ Working | End of Phase 1 | 50 questions answerable with feedback |
| M2: AI Tutor Live | End of Phase 2 | RAG responses with citations |
| M3: Exam Simulation | End of Phase 3 | Timed exam with score-at-end |
| M4: Personalized Learning | End of Phase 4 | Spaced repetition + weak areas |
| M5: Beta Launch | End of Phase 5 | Full feature set, mobile-responsive |
