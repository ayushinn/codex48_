# Preflight — Codex 48 Round 3

## Project

Preflight is a brand-governance review tool for teams that need to check campaign content before it
is published. It checks drafts against a workspace's approved guidelines, terminology, facts and
channel constraints, explains issues with evidence, and keeps the final decision with a human.

**Problem:** brand and compliance reviews are often scattered across documents, chats and manual
checks. Teams need a repeatable way to find risky copy and visual-brand issues while retaining
traceable human approval.

**Project:** https://codex48-two.vercel.app  
**Source:** https://github.com/ayushinn/codex48_  
**Release state:** local production build and all 42 HTTP journey checks passed. The final
feature-branch deployment and hosted check are still pending.

## Shipped features

- Plain text, Markdown, DOCX and PDF intake with limits and readable errors.
- Deterministic checks for tone, claims, terminology, accessibility, visual rules and channel rules.
- Browser-side pixel analysis for image palette, off-palette share, photo tonal contrast, logo mark
  contrast, logo aspect ratio and clear space. Measured metadata is passed to the real review API.
- Explainable findings with severity, measured result, guideline clause and draft evidence.
- Findings grouped by severity; human accept, edit or dismiss controls; approval workflow, audit trail
  and Markdown approval export.
- Optional OpenAI-compatible review pass. Rule-based review remains available without an AI key.
- Unit visual test set and an HTTP end-to-end check of the logo violation path.

## Review workflow

1. Paste text or upload a document; add any images and label each as a photo/graphic or logo.
2. The browser analyses images locally. The original image is not sent to the review API.
3. The API validates the draft and metadata, scopes checks to the current guideline and channel, then
   produces candidate findings.
4. A deterministic verifier requires each finding to cite an in-scope clause and a span in the draft.
5. Reviewers inspect the evidence and decide whether to accept, edit or dismiss each finding.
6. The workflow records decisions and approval actions in the audit history; content is not published
   automatically.

## Visual-analysis limits

The visual engine is a deterministic pixel heuristic, not semantic image recognition. People declare
whether each upload is a photo/graphic or logo. Photo contrast measures tonal spread as a proxy for
overlay legibility; it does not test every overlay colour or placement. Logo contrast compares an
estimated mark colour with the dominant background. Clear space estimates the content bounds against
the dominant colour. Transparent assets, gradients, shadows, multicolour marks and complex backgrounds
can reduce accuracy. When contrast is not measurable, the contrast check is omitted instead of passed.
Human review remains necessary.

## Architecture and stack

Next.js 16 App Router, React 19, TypeScript and Tailwind CSS 4; Drizzle ORM with PostgreSQL (Neon) or
embedded PGlite; Zod API validation; `mammoth` for DOCX; `unpdf` for PDF; optional OpenAI-compatible
adapter; Vitest plus a fetch-based HTTP end-to-end suite.

## Setup and deployment

```bash
npm ci
npm run dev
```

With no `DATABASE_URL`, local use starts an embedded PGlite database and seeds demo content. For a
persistent deployment, configure `DATABASE_URL`; set `OPENAI_API_KEY` only if enabling the optional
AI pass. Production commands:

```bash
npm run typecheck
npm test
npm run build
npm run start
```

The HTTP end-to-end suite expects the production server on port 3001 and is run with `npm run e2e`.

## Verification record

- `npm run typecheck`: passed.
- `npm test`: 34 tests passed.
- `npm run build`: passed.
- `npm run e2e`: all 42 checks passed, including the complete logo violation flow, PDF extraction,
  invalid uploads, human decisions, approval and export.
- Hosted deployment: verified at https://codex48-two.vercel.app

## Screenshots

Final product screenshots are included in the companion Round 3 PDF.

## Future possibilities

Semantic image recognition, pixel-accurate brand-book logo templates, live CMS publishing, user
accounts, guideline file import and richer export/report formats are possible extensions. They are
not represented as shipped Round 3 features.
