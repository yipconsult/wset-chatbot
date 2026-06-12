# WSET Chatbot — Design Guidelines

## Design Principles

1. **Calm & Focused** — Wine study is serious. The UI minimizes distraction. No gamification gimmicks, no flashy animations. Clean whitespace, clear hierarchy.

2. **Wine-Appropriate Aesthetic** — Deep burgundy, cream, slate palette. Elegant serif headings, clean sans-serif body. Feels premium but not pretentious.

3. **Mobile-First** — Candidates study on phones during commutes. All core flows (MCQ, AI chat) must be fully usable on mobile.

4. **Progressive Disclosure** — Show the question, hide the explanation until answered. Show the topic, hide sub-topics until expanded. Don't overwhelm.

5. **Accessible** — WCAG 2.1 AA. Sufficient contrast, keyboard navigation, screen-reader friendly.

## Color Palette

```
Primary:       #722F37 (Burgundy / Wine Red)
Primary Light: #8B4550
Secondary:     #F5F0EB (Warm Cream)
Accent:        #C8A951 (Gold / Champagne)
Text:          #1A1A1A (Near Black)
Text Muted:    #6B6B6B (Slate Gray)
Success:       #2D6A4F (Forest Green)
Error:         #C13838 (Muted Red)
Background:    #FAFAF8 (Off-White)
Surface:       #FFFFFF (White Card)
Border:        #E5E0DA (Warm Gray Border)
```

## Typography

- **Headings**: Playfair Display (serif) — elegant, wine-labels feel
- **Body**: Inter (sans-serif) — highly readable at small sizes
- **Code / Data**: JetBrains Mono (monospace)
- **Scale**: 12px / 14px / 16px / 20px / 24px / 32px / 40px

## Component Patterns

### MCQ Card
```
┌─────────────────────────────────────────┐
│  Topic: France > Bordeaux          [L3] │  ← Topic badge + difficulty
│                                         │
│  Which of the following communes is     │  ← Question text (18px, medium weight)
│  on the Right Bank of Bordeaux?         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ○ Pauillac                      │    │  ← Radio-button options
│  │ ● Saint-Émilion                 │    │     Selected: burgundy border
│  │ ○ Margaux                       │    │     Correct reveal: green border + ✓
│  │ ○ Pessac-Léognan                │    │     Incorrect reveal: red border + ✗
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ✓ Correct!                      │    │  ← Feedback panel (hidden until answered)
│  │ Saint-Émilion is a Right Bank   │    │     Green/red header + explanation text
│  │ appellation in the Libournais.  │    │
│  │ The others are Left Bank.       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Previous]              [Next →]      │  ← Navigation
└─────────────────────────────────────────┘
```

### AI Chat Panel
```
┌─────────────────────────────────────────┐
│  AI Tutor                       [New]   │  ← Header + new thread button
│  ─────────────────────────────────────  │
│                                         │
│  ┌─ User ──────────────────────────┐    │
│  │ Why is Chardonnay the primary   │    │
│  │ grape in Champagne?             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─ AI ────────────────────────────┐    │
│  │ Chardonnay thrives in           │    │  ← Markdown rendered
│  │ Champagne's cool climate        │    │
│  │ because...                       │    │
│  │                                  │    │
│  │ 📚 WSET L3 Textbook, Ch. 18     │    │  ← Source citations
│  └──────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Type your question...      [→]  │    │  ← Input bar (fixed bottom)
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Dashboard Layout
```
┌──────────────────────────────────────────┐
│  Welcome back, [Name]                    │
│  ─────────────────────────────────────  │
│                                          │
│  ┌────────┐ ┌────────┐ ┌────────────┐   │
│  │  62%   │ │  148   │ │  12h 34m   │   │  ← Stat cards
│  │ Avg.   │ │ Q's    │ │  Studying  │   │
│  └────────┘ └────────┘ └────────────┘   │
│                                          │
│  ┌─ Weak Areas ─────────────────────┐    │
│  │ ■ Burgundy ........ 45% ███░░    │    │  ← Topic progress bars
│  │ ■ Italy ........... 51% ████░    │    │     Color: red→yellow→green
│  │ ■ Fortified Wines . 38% ██░░░    │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌─ Recent Activity ────────────────┐    │
│  │ Jun 5 · Study Session · 25 Q's   │    │
│  │ Jun 4 · Exam Mode · 50 Q's       │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Single column, bottom nav, full-width cards |
| Tablet | 640-1024px | Single column, side nav collapsed, wider cards |
| Desktop | > 1024px | Side nav visible, 2-column dashboard, max-width 1200px content |

## Interaction Patterns

- **MCQ Answer**: Tap option → instant visual feedback (300ms transition) → explanation slides in (200ms ease-out)
- **Exam Mode**: Tap option → subtle selection highlight only (no correctness reveal). "Submit Exam" button at end.
- **AI Chat**: Type → Enter or send button → message appears immediately (optimistic) → streaming response renders progressively
- **Navigation**: Bottom tab bar on mobile (MCQ | Chat | Dashboard | Profile). Side nav on desktop.
- **Loading**: Skeleton screens for initial loads. Subtle spinner for answer submission.
- **Empty States**: "No questions attempted yet — start a practice session!" with CTA button.

## File & Asset Conventions

- Icons: Lucide React (consistent, tree-shakable)
- Images: WebP format, lazy loaded
- Wine region maps: SVG for crisp rendering at all sizes
- No stock photos; use simple illustrations or icons only
