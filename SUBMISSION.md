# Preflight — Round 2 submission material

Team: ayushiupadhyay818 · Leader: Ayushi Upadhyay (sole member, ayushiupadhyay818@gmail.com) · Codex 48, Round 2 (26–28 October)

> **All filled:** repository link (verified public), team details, project link (live preview with Neon Postgres), and updated PDF path (`round2-plan.pdf`, built from `round2-plan.typ`).

---

## 1. Links

- **Working project link:** https://site-23a0517a0f274928a6afc55dce23e316.freebuff.page (opens in a private window, no sign-in)
- **Source-code repository:** https://github.com/ayushinn/codex48_ (public repository — no secrets committed, `.env` is gitignored)
- **Updated project PDF:** `round2-plan.pdf` — Round 2: The Build (source: `round2-plan.typ`;
  Round 1 plan remains `round1-submission.pdf` / `round1-plan.typ`)
- **Completed features:** Section 2 below
- **Technology and implementation:** Section 3 below
- **Changes from the original plan:** Section 4 below
- **Three Round 3 improvements:** Section 5 below

---

## 2. Completed features (Round 2)

Mapped to the feature IDs in the Round 1 plan (Section 5). "Live" means it works end-to-end in
the deployed build today.

| ID | Feature | Status |
| --- | --- | --- |
| F1 | Knowledge-base import and versioning — pasted brand book parsed into classified clauses (code, section, rule type, check group) as version N+1; every finding cites the version it used | **Live** (paste import; PDF/DOCX guideline files are Round 3, see §4) |
| F2 | Approved-facts registry — claim, source, review date; the engine matches claims against it and drafts the citation | **Live** |
| F3 | Terminology enforcement — banned terms with approved replacements, product-name spelling/casing, protected verbatim phrases | **Live** |
| F4 | Multi-format intake — .txt, .md, .docx (mammoth), .pdf (unpdf) normalised into one block model | **Live** |
| F5 | Check groups — **six live**: tone, terminology, messaging, facts and unsupported claims, accessibility, channel rules (Round 1 committed to five for the MVP) | **Live** |
| F6 | Explainable findings — severity from the clause's rule type, plain-language why, verbatim clause quote + clause code, exact span in the draft, confidence | **Live** |
| F7 | Corrections as diffs — word-level diff per finding; accept / edit / dismiss-with-reason; never auto-applied | **Live** |
| F8 | Deterministic citation verifier — clause in scope, clause quote verbatim, content quote locatable, else suppressed and counted; rejections shown on the disclosure page | **Live** |
| F9 | Roles and approval state machine — Creator / Manager / Authorised Reviewer, enforced server-side, DRAFT→…→PUBLISH READY, illegal transitions rejected with 409, no self-approval by default | **Live** |
| F10 | Anchored comments, revision list, append-only audit log (actor, action, time, guideline version) | **Live** |
| F11 | Insights — recurring issues by clause and check group, dismissal clusters, approval cycle times | **Live** |
| F12 | AI disclosure and services page — in-product badge, provider/model/data/spend-cap disclosure, verifier-rejection counter, disclosure footnote on every export | **Live** |
| F13 | Image and accessibility checks (IMP-1 Round 2 state) — alt-text presence/quality/length, measured contrast ratio, off-palette colours, unexpanded acronyms, vague link text, reading level | **Live** |
| F14 | Guideline-gap detection (IMP-2 Round 2 state) — dismissal reasons clustered into gap candidates in Insights | **Live** |
| F15 | Brand-health trends (IMP-3 Round 2 state) — issues per piece over time, cycle time, blocker counts | **Live** |
| F16 | Publish integrations (CMS, extensions, bots) | Out of scope — Round 1 P2 / Section 10 |

**Judge path (no sign-in, no walkthrough):** land on the dashboard → open a seeded review or
paste your own content at *New review* → **Run preflight** → read findings (severity, why,
verbatim clause, diff) → accept / edit / dismiss with a reason → clear all blockers → submit →
switch persona to Manager → approve → export the approval record → see the dismissal cluster in
Insights. Every step above is exercised by the automated suite in `scripts/e2e.ts`.

**Verification run for this build:** `npm run build` clean · `npm run typecheck` clean ·
`npm test` 14/14 unit tests · `npm run e2e` 35/35 HTTP checks (including unauthenticated page
renders, refusal of dismissal-without-reason, refusal of self-approval, 409 on illegal
transitions, verifier behaviour, re-run reconciliation without duplicate findings, and export
with disclosure footnote).

---

## 3. Technology and implementation

- **Language/framework:** TypeScript end-to-end; Next.js 16 App Router (server components +
  route handlers), React 19, Tailwind CSS 4. One codebase, one deploy.
- **Database:** PostgreSQL with Drizzle ORM — one schema, dual driver: Neon serverless
  Postgres when `DATABASE_URL` is set (production), embedded PGlite (file-backed Postgres) with
  zero install locally. Schema is created by idempotent DDL on first access and auto-seeded with
  a demo workspace.
- **Validation:** Zod at every API boundary; state transitions enforced by a state machine in
  `src/lib/workflow.ts`, not by convention.
- **Review engine** (`src/lib/engine/`):
  1. *Retrieval-first scoping* — latest guideline version, channel-filtered clauses, registries;
  2. *Deterministic rule checks* — six groups producing candidate findings, each naming a clause;
  3. *Optional AI pass* — provider-agnostic OpenAI-compatible adapter, strict JSON contract,
     server-side key, hard daily spend cap. **No key configured → the rule engine alone runs the
     product**; the engine mode is disclosed in the UI;
  4. *Citation verifier (code, not model)* — a candidate survives only if its clause was in
     scope, its clause quote is verbatim in the stored clause, and its content quote locates in
     the draft (exact, then fuzzy with a similarity floor for model quotes). Failures are
     suppressed and counted as verifier rejections;
  5. *Reconciliation* — human decisions survive re-runs; stale findings (whose quoted span left
     the draft) are cleared on re-preflight.
- **Workflow** (`src/lib/workflow.ts`, `src/lib/actions.ts`): personas in a session cookie with
  server-side permission checks (sign-in-free, see §4), transitions with blocker gating,
  self-approval prohibition (audited workspace opt-out), dismissals require reasons, append-only
  audit log on every mutation, Markdown export with approval record.
- **Intake:** .txt/.md/.docx/.pdf → shared block model (paragraph, heading, list, image) so all
  checks behave identically regardless of source format. Image metadata (palette, measured
  contrast) is computed in the browser at intake and checked against the approved palette.
- **Testing:** Vitest unit suite (`tests/engine.test.ts` — verifier accept/reject paths, span
  locating, protected verbatim phrases, imported-guideline fallback, image accessibility:
  valid markdown alt suggestions and the WCAG contrast threshold) plus a fetch-based HTTP
  end-to-end suite (`scripts/e2e.ts`, 35 assertions over the full workflow, including that
  re-running preflight replaces open findings instead of duplicating them).

---

## 4. Changes from the Round 1 plan

| Round 1 plan | Round 2 build | Why |
| --- | --- | --- |
| Auth.js (magic link + Google), roles enforced after login | **Sign-in-free demo personas** (session cookie picks Creator/Manager/Reviewer); all permission rules still enforced server-side in the API | Round 2's hard rule is that the link must open for anyone without signing in — teams were eliminated in Round 1 for exactly that. The state machine, permissions and audit trail are unchanged; real auth returns in Round 3 behind an optional gate |
| pgvector + hybrid retrieval over embeddings | **Deterministic scoping**: latest guideline version + channel filter + check-group classification | Same retrieval-first guarantee (a check may only cite a clause that exists), without a dependency on embedding infra at MVP scale; upgrade path documented |
| Playwright end-to-end suite | **Fetch-based HTTP e2e suite** (`scripts/e2e.ts`) + Vitest unit tests | Same assertions driven over real HTTP against the production build; browser automation deferred to Round 3 |
| Object storage (R2) for uploads and exports | **No object store**: uploads are parsed at intake, content lives in Postgres, exports stream as Markdown downloads | Nothing in the Round 2 core path needs durable file storage; removes a service from the critical path |
| shadcn/ui components | **Small in-repo component set** (still Tailwind, keyboard-operable) | Avoids a codegen pipeline in a solo build; keeps the bundle and the audit surface small |
| Knowledge import from PDF/DOCX/URL | **Paste-to-clause import** (auto-classified, versioned); file upload of .docx/.pdf works for *content* intake | Honest scoping inside the window; guideline file parsing is in the Round 3 list (§5, IMP-2) |
| pdf-parse | **unpdf** | Maintained ESM build, same deterministic text extraction |

Everything else in the Round 1 workflow (blockers-gated state machine, verbatim evidence,
diff suggestions, comments, audit log, insights, disclosure) was built as planned.

---

## 5. The three improvements we will complete in Round 3

Carried verbatim from Round 1 Section 5, each with its current Round 2 state so progress can be
verified against that text. They are additive to the core workflow, never a replacement.

### IMP-1 — Visual and accessibility audit pack (complete)
- **Round 2 state (live now):** alt-text presence/quality/length, measured contrast ratio at
  intake, off-palette colour detection, reading level, unexpanded acronyms, vague link text.
- **Round 3:** logo variant and clear-space rules checked automatically; palette rules completed
  against a seeded image test set with a measured pass rate; visual checks measured on every build
  like the text checks.

### IMP-2 — Guideline gap detection (complete)
- **Round 2 state (live now):** every dismissal requires a reason; reasons are clustered into
  guideline-gap candidates on the Insights page.
- **Round 3:** gap cards with ambiguity/conflict flags, one-click suggested clarifications drafted
  from the dismissal cluster, and approval of guideline **vN+1 from inside the product**, so
  future reviews cite the new version — the loop closes by improving the brand book itself.

### IMP-3 — Brand health reporting (complete)
- **Round 2 state (live now):** live trends — issues per piece of content over time, approval
  cycle time, blocker counts, recurring issues by clause/check group.
- **Round 3:** monthly report generation with period-over-period comparison (blocker rate before
  and after adoption), per-creator and per-channel breakdowns, and an exportable report format
  alongside the existing approval-record export.

---

## 6. Suggested judge script (for the reviewer, not a walkthrough)

1. Open the link in a private window — the dashboard shows seeded reviews in five different states.
2. *New review* → paste any copy → pick a channel → **Run preflight**.
3. Open a finding: severity, why, verbatim clause quote, diff suggestion, confidence.
4. Accept one, dismiss another with a reason, watch blockers drop; submit; switch to Manager;
   approve; export.
5. Open *Insights* — the dismissal you just made appears as a guideline-gap candidate.
