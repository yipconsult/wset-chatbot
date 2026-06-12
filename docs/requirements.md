# WSET Chatbot — Requirements Document

## Product Overview

An AI-powered study companion for WSET (Wine & Spirit Education Trust) Level 2 and Level 3 candidates. The chatbot provides MCQ practice with immediate feedback, AI-driven concept clarification, exam simulation, and progress tracking — all grounded in official WSET materials.

## Target Users

- WSET Level 1 candidates (introductory knowledge, ~6–10 study hours)
- WSET Level 2 candidates (foundation knowledge, ~40–60 study hours)
- WSET Level 3 candidates (advanced knowledge, ~80–120 study hours)

## Functional Requirements

### FR1: MCQ Practice Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | Display single multiple-choice questions with 4 options | P0 |
| FR1.2 | Submit answer and show correct/incorrect immediately | P0 |
| FR1.3 | Provide a concise explanation for each answer (why correct, why distractors are wrong) | P0 |
| FR1.4 | Support question categorization by WSET syllabus topic | P1 |
| FR1.5 | Support question difficulty tagging (L2 / L3 / mixed) | P1 |
| FR1.6 | Allow image-based questions (wine labels, maps, charts) | P2 |

### FR2: AI Tutor / Concept Clarification

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | Free-text natural language Q&A about wine/spirits concepts | P0 |
| FR2.2 | Answers must be grounded in official WSET materials (RAG) | P0 |
| FR2.3 | Cite source materials in responses (e.g., "WSET L3 Textbook, Ch. 12") | P1 |
| FR2.4 | Support follow-up questions within a conversation thread | P0 |
| FR2.5 | Conversation history persistence per user | P1 |

### FR3: Study Mode vs. Exam Mode

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | Study Mode: instant feedback, explanations, no time limit | P0 |
| FR3.2 | Exam Mode: timed session (matching real exam duration), no hints | P0 |
| FR3.3 | Exam Mode: reveal score only after session ends | P1 |
| FR3.4 | Configurable question count per session (10/25/50/all) | P1 |
| FR3.5 | Configurable time limit per exam session | P2 |

### FR4: Spaced Repetition & Weak Areas

| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | Track every answer (correct/incorrect) per user | P0 |
| FR4.2 | Identify weak topics based on error rate | P1 |
| FR4.3 | Re-surface previously-wrong questions after increasing intervals (1d, 3d, 7d, 14d) | P1 |
| FR4.4 | "Review Weak Areas" quick-start button that queues questions from weak topics | P1 |
| FR4.5 | Mark a topic as "mastered" when error rate drops below threshold | P2 |

### FR5: Syllabus Navigation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | Browse WSET topics as a hierarchical tree (Category → Sub-topic) | P1 |
| FR5.2 | Filter MCQ practice by selected topic | P1 |
| FR5.3 | Show progress % per topic in the navigation view | P2 |
| FR5.4 | Topic overview page with key facts summary (AI-generated) | P2 |

### FR6: Progress Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR6.1 | Overall completion % of available questions | P1 |
| FR6.2 | Average score % (all-time, last 7 days, last 30 days) | P1 |
| FR6.3 | Time spent studying (total and per-session) | P2 |
| FR6.4 | Topic-level breakdown with color-coded proficiency | P1 |
| FR6.5 | Streak tracking (consecutive days studied) | P3 |

### FR7: User Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR7.1 | User registration (email + password) | P0 |
| FR7.2 | User login / logout with JWT | P0 |
| FR7.3 | Select WSET level (L2 or L3) during onboarding | P1 |
| FR7.4 | Guest mode with localStorage-only progress (no account required) | P2 |

## WSET Syllabus Topics (L2 & L3)

```
1. Wine Fundamentals
   1.1 Grape Growing (viticulture)
   1.2 Winemaking (vinification)
   1.3 Tasting Technique (SAT)
   1.4 Wine Service & Storage

2. Principal Grape Varieties
   2.1 White: Chardonnay, Sauvignon Blanc, Riesling, Pinot Grigio/Gris
   2.2 Red: Cabernet Sauvignon, Merlot, Pinot Noir, Syrah/Shiraz

3. Wine Regions
   3.1 France (Bordeaux, Burgundy, Loire, Rhône, Alsace, Champagne)
   3.2 Italy (Piedmont, Tuscany, Veneto)
   3.3 Spain (Rioja, Ribera del Duero, Sherry)
   3.4 Germany (Mosel, Rheingau, Pfalz)
   3.5 Portugal (Douro, Port)
   3.6 USA (Napa, Sonoma, Oregon)
   3.7 Australia & New Zealand
   3.8 South America (Chile, Argentina)
   3.9 South Africa

4. Sparkling & Fortified Wines
   4.1 Sparkling Wine Production Methods
   4.2 Champagne & Crémant
   4.3 Cava, Prosecco, New World Sparkling
   4.4 Sherry, Port, Madeira

5. Spirits (L2 specific)
   5.1 Whisky/Whiskey (Scotch, Bourbon, Irish)
   5.2 Brandy (Cognac, Armagnac)
   5.3 Rum, Vodka, Gin, Tequila
   5.4 Liqueurs & Other Spirits
```

## Non-Functional Requirements

| ID | Requirement | Detail |
|----|-------------|--------|
| NFR1 | Response latency | AI tutor responses < 5s; MCQ feedback < 500ms |
| NFR2 | Availability | 99.5% uptime target |
| NFR3 | Data privacy | User progress data encrypted at rest; no WSET materials exposed publicly |
| NFR4 | Mobile responsive | UI must work on mobile, tablet, and desktop |
| NFR5 | Cost efficiency | LLM API calls cached where possible; RAG retrieval optimized |
