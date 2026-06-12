# CLAUDE.md — WSET Chatbot Project

## What This Project Is

WSET Chatbot is an AI-powered study companion for WSET (Wine & Spirit Education Trust) Level 2 and Level 3 candidates. It provides MCQ practice with feedback, AI-driven concept clarification (RAG), exam simulation, spaced repetition, and progress tracking — all grounded in official WSET materials.

## Project Documentation Index

All standardized documentation lives in `docs/`. Read the relevant document before starting any task in that domain.

| Document | When to Read |
|----------|-------------|
| [docs/requirements.md](docs/requirements.md) | Before implementing any feature — understand the functional requirements, priorities, and WSET syllabus structure |
| [docs/technical-spec.md](docs/technical-spec.md) | Before writing code — architecture, tech stack decisions, data models, API contract, RAG pipeline design |
| [docs/design-guidelines.md](docs/design-guidelines.md) | Before building UI — color palette, typography, component patterns, responsive breakpoints, interaction patterns |
| [docs/execution-plan.md](docs/execution-plan.md) | Before starting a new phase — understand the phase structure, dependencies, deliverables, and stop-and-validate checkpoints |
| [DEVLOG.md](DEVLOG.md) | At the start and end of every coding session — review current state, update progress, add log entries |

## Development Workflow

### Starting a New Task

1. Read [DEVLOG.md](DEVLOG.md) to understand current state and active phase
2. Read the relevant `docs/` file for the domain you're touching
3. Implement the change
4. Update [DEVLOG.md](DEVLOG.md):
   - Check off completed to-do items
   - Add a log entry under today's date with Actions / Decisions / Next

### Coding Conventions

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 async, Pydantic v2 for validation
- **Frontend**: React 18, TypeScript strict mode, Tailwind CSS, functional components with hooks
- **Naming**:
  - Python: `snake_case` for functions/variables, `PascalCase` for classes/models
  - TypeScript: `camelCase` for variables/functions, `PascalCase` for components/interfaces
  - Database tables: `snake_case` plural (`users`, `questions`, `user_answers`)
  - API routes: kebab-case in paths (`/weak-areas`), `snake_case` in JSON keys
- **Type safety**: No `any` in TypeScript. Pydantic models for all API I/O.
- **Error handling**: Backend returns structured `{ "detail": "..." }` errors. Frontend uses error boundaries and toast notifications.
- **Testing**: pytest for backend (async where needed), Vitest + React Testing Library for frontend

### Commit Conventions

- `feat:` — new feature (e.g., `feat: add MCQ answer submission endpoint`)
- `fix:` — bug fix
- `refactor:` — code change with no feature change
- `docs:` — documentation only
- `style:` — UI/styling changes only
- `chore:` — tooling, config, build

### Phase Gate Checklist

Before marking a phase complete, verify:
- [ ] All tasks in phase are checked off
- [ ] Stop & Validate criteria from execution plan are met
- [ ] No known regressions
- [ ] DEVLOG.md updated with phase completion entry

## Key Design Decisions (Do Not Reverse Without Discussion)

1. **RAG over fine-tuning**: AI tutor uses retrieval-augmented generation, not a fine-tuned model. This keeps responses grounded in actual WSET materials and allows easy content updates.
2. **Stateless JWT**: No server-side sessions. JWT with 24h access / 7d refresh tokens.
3. **PostgreSQL with pgvector path**: Start with ChromaDB for dev simplicity, plan migration to pgvector for production when scale demands it.
4. **Mobile-first UI**: All core flows must work on mobile. Desktop is enhanced, not primary.
5. **Phase independence**: Phase 1 (MCQ) and Phase 2 (AI Tutor) are parallel tracks. Don't couple them.
