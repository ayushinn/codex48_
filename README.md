# Preflight

Preflight checks campaign content against an approved brand guide before publication. It accepts
text, documents and image metadata, explains findings with guideline evidence, and leaves every
decision to a human reviewer. Nothing is published or edited automatically.

## What ships

- Text and channel checks for tone, terminology, claims, accessibility and channel rules.
- `.txt`, `.md`, `.docx` and `.pdf` intake, with clear errors for malformed or oversized files.
- Browser-side image analysis for dominant colours, off-palette share, tonal contrast, logo contrast,
  aspect ratio and logo clear space. The image itself stays in the browser; only analysis metadata is
  sent with the review.
- Findings grouped by severity, with measured evidence and the applicable guideline clause.
- Human accept, edit or dismiss decisions; approval workflow, audit log and Markdown export.
- Optional server-side OpenAI-compatible review. The deterministic engine works without an API key.

## Visual analysis limits

Visual checks use a deterministic pixel heuristic, not computer vision or semantic recognition. The
creator labels an upload as a photo/graphic or logo. Photo contrast is a tonal-spread heuristic and
does not establish text contrast over every possible overlay. Logo contrast estimates the main mark
against the dominant background. Clear space uses the content bounding box against the dominant
colour; transparency, gradients, shadows, complex backgrounds and low-contrast marks can affect the
estimate. A contrast rule is skipped when the analyser cannot measure it; it is never assigned a
passing score. Human review remains required.

## Local setup

Requirements: Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. With no `DATABASE_URL`, the app uses embedded PGlite and seeds a demo
workspace. Copy `.env.example` only if configuring optional services.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run start -- -p 3001
npm run e2e
```

The HTTP e2e suite expects a production server on port 3001. Unit tests exercise the visual audit
test set and deterministic review engine.

## Architecture

- Next.js App Router, React and TypeScript; Tailwind CSS.
- Drizzle ORM over PostgreSQL (Neon when `DATABASE_URL` is set) or embedded PGlite for local use.
- Zod request validation; deterministic rules and an optional OpenAI-compatible adapter.
- `mammoth` extracts DOCX text; `unpdf` extracts PDF text.
- Vitest unit tests and a fetch-based production HTTP journey in `scripts/e2e.ts`.

## Deployment

Build with `npm ci && npm run build`, then run `npm run start`. For a persistent hosted deployment,
configure `DATABASE_URL`; without it, embedded data may reset when a serverless instance restarts.
Set `OPENAI_API_KEY` only to enable the optional AI pass. See `.env.example` for supported settings.

## Routes

`/` dashboard · `/reviews/new` intake · `/reviews/[id]` review and decisions · `/knowledge` guidelines
and registries · `/insights` trends · `/disclosure` service disclosure · `/settings` workspace policy.

The Round 3 delivery summary and current verification record are in [SUBMISSION.md](SUBMISSION.md).
