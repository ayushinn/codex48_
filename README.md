# Preflight — brand governance before publication

Preflight is a content-governance platform: **content goes in, it is checked against your approved
guidelines, terms, facts and channel rules, the issues come back explained with verbatim evidence,
and a human decides.** No finding is ever auto-applied, every decision is logged, and the approval
record exports with the content.

It is the Round 2 build of our Codex 48 (Inkloom AI) Round 1 plan.

## Quick start

```bash
npm ci          # install
npm run dev     # http://localhost:3000  (file-backed PGlite, auto-seeded demo workspace)
```

Production-style run (what we test against):

```bash
npm run build
npm run start           # serves on :3000
npm test                # Vitest unit suite (engine + citation verifier)
npm run e2e             # HTTP end-to-end suite (expects the server on :3001)
```

No configuration is required for local use: with no `DATABASE_URL` the app boots an embedded
PGlite Postgres in `./data` and seeds a demo workspace (brand guide with clause IDs, terminology
registries, approved-facts registry, channels, tone examples, and five seeded reviews in different
workflow states).

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon/Supabase). Unset → embedded PGlite (local, and as an ephemeral fallback on hosts without a database). |
| `OPENAI_API_KEY` | Optional. Any OpenAI-compatible endpoint. **Without a key the deterministic rule engine runs the whole product** — the AI pass is additive, never load-bearing. |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | Provider selection by env var (default OpenAI, `gpt-4o-mini`). |
| `AI_SPEND_CAP_USD` | Hard daily spend cap enforced in the adapter (default `2.00`). |

See `.env.example`.

## How a review works

```
intake (paste / .md / .docx / .pdf, channel + content type)
  → block model (paragraph, heading, list, image)
  → retrieval-first scoping (latest guideline version, channel-filtered clauses,
     terms, facts, tone examples)
  → rule checks: tone · terminology · messaging · facts & unsupported claims ·
     accessibility · channel rules        [+ optional LLM pass, server-side key]
  → deterministic citation verifier (code, not model):
       clause must be in scope · clause quote verbatim in the stored clause ·
       content quote locatable in the draft — otherwise the finding is
       suppressed and counted as a verifier rejection
  → findings: severity (from the clause's rule type), plain-language why,
     verbatim clause quote + code, exact span in the draft, confidence,
     word-level diff suggestion
  → human decides: accept / edit / dismiss-with-reason
  → state machine: DRAFT → SELF REVIEW → READY FOR REVIEW → IN REVIEW →
     APPROVED → PUBLISH READY (+ CHANGES REQUESTED loop), illegal transitions 409
  → export: content + approval record (Markdown) with AI-disclosure footnote
  → insights: recurring issues, dismissal clusters → guideline-gap candidates,
     cycle times, issue-rate trend
```

Key properties:

- **A model can never invent a citation.** Every candidate — rule or LLM — passes the same
  verifier before display; rejections are surfaced in the product's disclosure.
- **Retrieval-first scoping.** A check may only cite a clause the workspace actually has. Seeded
  codes (`GB-2.2` …) are preferred; pasted/imported guidelines fall back to their check-group
  classification, so a judge's own brand book drives every check.
- **Roles are enforced server-side** even without a login: a session cookie picks the active
  persona (Creator / Manager / Authorised Reviewer), the rules — including "no self-approval" —
  are applied in the API, and every transition lands in an append-only audit log.
- **Disclosure lives in the product**, not only in the deck: an AI-assisted-review badge, a
  disclosure page naming provider, model, data received and spend cap, and the footnote on every
  exported approval record.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Workspace dashboard: reviews by state, blockers, cycle time |
| `/reviews/new` | Intake — paste or upload, pick channel, run preflight |
| `/reviews/[id]` | The review: findings with evidence + diffs, comments, revisions, workflow bar, audit log |
| `/knowledge` | Guideline import (versioned), clauses, terminology, facts, channels, tone examples |
| `/insights` | Recurring issues, guideline-gap candidates, cycle times, trends |
| `/disclosure` | AI and external-services disclosure, engine mode, verifier rejections |
| `/settings` | Workspace settings, self-approval switch, recent audit entries |
| `/api/*` | All mutations (Zod-validated, persona-scoped, audited) |

## Stack

Next.js 16 (App Router, route handlers) · React 19 · TypeScript · Tailwind CSS 4 ·
Drizzle ORM · PostgreSQL (Neon in production, embedded PGlite locally) · Zod ·
mammoth (DOCX) · unpdf (PDF) · provider-agnostic OpenAI-compatible AI adapter ·
Vitest (unit) + fetch-based HTTP e2e suite.

## Deployment

Any Node host works (Vercel/Netlify): `npm ci && npm run build && npm run start`.

- **Set `DATABASE_URL`** (free-tier Neon) for persistent data. Without it the app still runs and
  seeds itself, but on serverless hosts the database lives in `/tmp` and resets on cold starts.
- No sign-in is required to open the product — open it in a private window and it works.

## Repository contents

- `SUBMISSION.md` — the Round 2 submission material (features, tech, plan changes, Round 3 improvements)
- `ROUND1.md` + `round1-plan.typ` + `round1-submission.pdf` + `artifacts/` — the Round 1 plan and its sources

## Honesty notes

- No finding is auto-applied; a human accept is the only thing that changes content.
- Low-confidence findings are labelled as judgement calls.
- Demo content is fictional (Aurora Wellness / Aurora Calm); no third-party brand material is used.
- AI assistance in building this product is disclosed in the repository, as the rules require.
