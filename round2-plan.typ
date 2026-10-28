#set document(
  title: "Preflight - Codex 48 Hackathon Round 2: The Build",
  author: "Ayushi Upadhyay",
)

#set page(paper: "a4", margin: (x: 2.1cm, top: 2.3cm, bottom: 2.1cm))

#set text(size: 10.5pt)
#set par(justify: true, leading: 0.62em)

#set table(stroke: 0.4pt + luma(200), inset: 6pt)

#show heading: set block(above: 1.2em, below: 0.6em)
#show heading.where(level: 1): set text(size: 14pt, fill: rgb("#123E6B"))
#show heading.where(level: 3): set text(size: 11pt)

// ============ COVER ============

#v(1.6cm)
#align(center)[#text(size: 10pt, fill: luma(90), tracking: 1.5pt)[CODEX 48 HACKATHON · ORGANISED BY WE CODE CODERS]]
#v(0.3cm)
#align(center)[#text(size: 11pt, fill: luma(70))[ROUND 2 SUBMISSION -- THE BUILD]]
#v(1.4cm)
#align(center)[#text(size: 42pt, weight: "bold", fill: rgb("#123E6B"))[PREFLIGHT]]
#v(0.4cm)
#align(center)[#text(size: 13.5pt, style: "italic")[An intelligent brand-governance platform that reviews content before publication]]
#v(0.3cm)
#align(center)[#text(size: 10.5pt, fill: luma(70))[Built, tested and working: Round 1 plan, this round's changes, verification evidence and the three improvements -- in one document.]]
#v(1.0cm)
#align(center)[#line(length: 55%, stroke: 1pt + rgb("#123E6B"))]
#v(1.0cm)

#align(center)[
  #table(
    columns: (auto, auto),
    [ *Field* ], [ *Detail* ],
    [ *Product working title* ], [ Preflight ],
    [ *Team name* ], [ ayushiupadhyay818 ],
    [ *Team size* ], [ 1 -- solo participant ],
    [ *Team leader and sole member* ], [ Ayushi Upadhyay ],
    [ *Team leader email* ], [ ayushiupadhyay818\@\<gmail.com\> ],
    [ *Problem statement* ], [ Inkloom AI -- intelligent brand governance ],
    [ *Submission date* ], [ 28 October 2026 ],
    [ *Document* ], [ Round 2: The Build (PDF) -- carries the Round 1 plan in summary plus this round's delivered changes ],
  )
]

#v(0.8cm)
#align(center)[#text(size: 8.5pt, fill: luma(110))[Summary of the Round 1 plan, completed features F1-F16, workflow, architecture, honest deviations, verification evidence, the three improvements and team details.]]

#pagebreak()

// ============ HEADER / FOOTER FROM HERE ============

#set page(
  header: block(width: 100%, inset: (bottom: 4pt), stroke: (bottom: 0.5pt + luma(190)))[
    #grid(
      columns: (1fr, auto),
      text(size: 8pt, fill: luma(90))[*Preflight* -- brand governance before publication],
      text(size: 8pt, fill: luma(90))[Codex 48 Hackathon · Round 2 -- The Build],
    )
  ],
  footer: context align(center, text(size: 8.5pt, fill: luma(90))[#counter(page).display("1")]),
)

#outline(title: [Contents], depth: 2)

#pagebreak()

= 1. Executive summary

#block(fill: rgb("#F4F7FA"), stroke: 0.6pt + rgb("#C9D6E4"), inset: 10pt, radius: 3pt)[
  *Round 1 committed to a plan; Round 2 shipped it.* Preflight is a review-before-publish workspace: a creator pastes or uploads content, picks a channel, and the engine checks it against the organisation's own guidelines, approved facts, terminology, tone, accessibility rules and channel rules. Every finding names the clause it violates, quotes that clause verbatim, anchors to an exact span of the draft, and proposes a correction as a diff. Nothing is auto-applied: creators accept, edit or dismiss (dismissals require a reason), and Creator / Manager / Authorised Reviewer sign off through a server-enforced state machine with blocker gating, no self-approval by default, and an append-only audit log.

  *What changed this round.* All sixteen planned features are implemented, six check groups run live, and the three named improvements (visual and accessibility audit, guideline-gap detection, brand-health reporting) are in their Round 2 state as promised in Round 1 Section 5. A re-run reconciliation bug found during verification -- duplicate open findings on re-preflight -- was fixed and now carries a regression check in the HTTP suite.

  *Verification for this build:* `next build` clean · `tsc --noEmit` clean · 14/14 Vitest unit tests · 35/35 HTTP end-to-end checks against the production build, covering page renders without sign-in, evidence integrity, refusal of dismissal-without-reason, refusal of self-approval, 409 on illegal transitions, re-run reconciliation, and the export with its AI-disclosure footnote. The full journey (new review -> preflight -> accept/dismiss -> clear blockers -> submit -> manager approves -> publish-ready -> export) was also driven by hand in a private browser window.
]

= 2. The Round 1 plan in one page

The Round 1 document (submitted 24 October 2026) argued that governance needs a *verifiable gate, not an advisor*: an advisor can be confidently wrong; a gate must produce evidence a judge, a regulator or a founder can click. That reading set four commitments that Round 2 had to honour.

#table(
  columns: (1.1fr, 1.6fr),
  table.cell(fill: rgb("#EAF1F8"))[*Round 1 commitment*],
  table.cell(fill: rgb("#EAF1F8"))[*What Round 2 delivers*],
  [ Evidence-first findings ],
  [ Every finding cites a clause that retrieval actually returned, quotes it verbatim, and anchors to a span that exists in the draft -- verified by deterministic code (F6, F8) ],
  [ Suggest, never overwrite ],
  [ Word-level diffs; accept / edit / dismiss-with-reason; nothing applies without a human action (F7) ],
  [ Human-controlled approval ],
  [ Role-checked state machine with blocker gating, self-approval prohibition, illegal transitions rejected with 409, append-only audit (F9, F10) ],
  [ Diagnose the guideline itself ],
  [ Dismissal reasons cluster into guideline-gap candidates; trends and cycle times feed brand-health reporting (F11, F14, F15) ],
)

*Users and setting (Round 1 Section 2).* Small and growing teams publishing through many hands -- employees, agencies, AI writing tools -- with no brand team to police every post. Out of scope: enterprise DAM administrators and social-listening teams.

*Honest non-claims (Round 1 Section 3.2).* Brand checking, accessibility checking and approval workflows all exist; Preflight's claim is the combination -- evidence-first findings plus an integrated text review-and-approval workspace plus analytics that diagnose the guideline -- aimed at teams too small for enterprise tooling.

= 3. Completed features (F1-F16)

"Live" means it works end to end in the deployed build today.

#table(
  columns: (0.5fr, 2.3fr, 0.9fr),
  table.cell(fill: rgb("#EAF1F8"))[*ID*],
  table.cell(fill: rgb("#EAF1F8"))[*Feature*],
  table.cell(fill: rgb("#EAF1F8"))[*Status*],
  [ F1 ], [ Knowledge-base import and versioning -- pasted brand book parsed into classified clauses as version N+1; findings cite the version used ], [ *Live* ],
  [ F2 ], [ Approved-facts registry -- claim, source, review date; the engine matches claims against it and drafts the citation ], [ *Live* ],
  [ F3 ], [ Terminology enforcement -- banned terms with approved replacements, name spelling, protected verbatim phrases ], [ *Live* ],
  [ F4 ], [ Multi-format intake -- .txt, .md, .docx (mammoth), .pdf (unpdf) normalised into one block model ], [ *Live* ],
  [ F5 ], [ Six check groups -- tone, terminology, messaging, facts, accessibility, channel rules ], [ *Live* ],
  [ F6 ], [ Explainable findings -- severity from rule type, plain-language why, verbatim clause quote + code, exact span, confidence ], [ *Live* ],
  [ F7 ], [ Corrections as diffs -- word-level diff; accept / edit / dismiss-with-reason; never auto-applied ], [ *Live* ],
  [ F8 ], [ Deterministic citation verifier -- clause in scope, quotes verbatim and locatable, else suppressed and counted ], [ *Live* ],
  [ F9 ], [ Roles and approval state machine -- three personas, server-enforced, DRAFT to PUBLISH READY, 409 on illegal moves, no self-approval ], [ *Live* ],
  [ F10 ], [ Anchored comments, revision list, append-only audit log (actor, action, time, guideline version) ], [ *Live* ],
  [ F11 ], [ Insights -- recurring issues by clause and check group, dismissal clusters, approval cycle times ], [ *Live* ],
  [ F12 ], [ AI disclosure -- in-product badge, provider/model/data/spend-cap page, verifier-rejection counter, footnote on every export ], [ *Live* ],
  [ F13 ], [ Image and accessibility checks -- alt-text presence/quality/length, measured contrast, off-palette colours, acronyms, link text, reading level ], [ *Live* ],
  [ F14 ], [ Guideline-gap detection -- dismissal reasons clustered into gap candidates in Insights ], [ *Live* ],
  [ F15 ], [ Brand-health trends -- issues per piece, cycle time, blocker counts ], [ *Live* ],
  [ F16 ], [ Publish integrations (CMS, extensions, bots) ], [ Round 1 P2 -- deferred as planned ],
)

= 4. The workflow a judge will see

#block(fill: rgb("#EAF1F8"), stroke: 0.6pt + rgb("#C9D6E4"), inset: 10pt, radius: 3pt)[
  *New review* -> paste or upload content, pick a channel, *Run preflight* -> findings (severity, why, verbatim clause, diff, confidence) -> *accept* a suggestion, *dismiss* another with a reason -> all blockers cleared -> *submit* -> switch persona to Manager -> *take* the review -> *approve* -> mark *publish-ready* -> *export the approval record* (Markdown, with the AI-disclosure footnote) -> open *Insights* to see the dismissal you just made as a guideline-gap candidate.
]

Every step above is exercised by the automated HTTP suite (`scripts/e2e.ts`, 35 checks) against the production build; the full path was also completed manually in a private window during verification for this submission.

= 5. Architecture

- *Language/framework:* TypeScript end to end; Next.js 16 App Router (server components + route handlers), React 19, Tailwind CSS 4. One codebase, one deploy.
- *Database:* PostgreSQL with Drizzle ORM -- one schema, dual driver: Neon serverless Postgres when `DATABASE_URL` is set (production), embedded file-backed PGlite locally with zero install. Idempotent DDL on first access, auto-seeded demo workspace.
- *Validation:* Zod at every API boundary; transitions enforced by a state machine (`src/lib/workflow.ts`), not by convention.
- *Review engine* (`src/lib/engine/`):
  + 1. *Retrieval-first scoping* -- latest guideline version, channel-filtered clauses, registries;
  + 2. *Deterministic rule checks* -- six groups produce candidates, each naming a clause;
  + 3. *Optional AI pass* -- provider-agnostic OpenAI-compatible adapter, strict JSON contract, server-side key, hard daily spend cap; no key configured means the rule engine alone runs the product, and the engine mode is disclosed in the UI;
  + 4. *Citation verifier (code, not model)* -- a candidate survives only if its clause was in scope, its clause quote is verbatim in the stored clause, and its content quote locates in the draft; failures are suppressed and counted;
  + 5. *Reconciliation* -- human decisions survive re-runs; stale findings are cleared; open findings are replaced wholesale so re-running never duplicates them (regression-tested).
- *Workflow:* personas in a session cookie with server-side permission checks, transitions with blocker gating, self-approval prohibition, dismissals with required reasons, append-only audit, Markdown export with approval record.
- *Intake:* .txt/.md/.docx/.pdf -> shared block model (paragraph, heading, list, image). Image metadata (palette, measured contrast) is computed in the browser at intake and checked against the approved palette.
- *Testing:* Vitest (`tests/engine.test.ts` -- verifier paths, span locating, protected phrases, imported-guideline fallback, image accessibility) plus a fetch-based HTTP suite (`scripts/e2e.ts`, 35 assertions over the full workflow).

= 6. Changes from the Round 1 plan (honest record)

#table(
  columns: (1fr, 1.2fr, 1.2fr),
  table.cell(fill: rgb("#EAF1F8"))[*Round 1 plan*],
  table.cell(fill: rgb("#EAF1F8"))[*Round 2 build*],
  table.cell(fill: rgb("#EAF1F8"))[*Why*],
  [ Auth.js (magic link + Google), roles enforced after login ],
  [ Sign-in-free demo personas (session cookie picks Creator/Manager/Reviewer); all permission rules still enforced server-side ],
  [ Round 2's hard rule: the link must open for anyone without signing in. State machine, permissions and audit trail unchanged; real auth returns in Round 3 behind an optional gate ],
  [ pgvector + hybrid retrieval over embeddings ],
  [ Deterministic scoping: latest guideline version + channel filter + check-group classification ],
  [ Same retrieval-first guarantee without embedding infra at MVP scale; upgrade path documented ],
  [ Playwright end-to-end suite ],
  [ Fetch-based HTTP e2e suite + Vitest unit tests ],
  [ Same assertions over real HTTP against the production build; browser automation deferred to Round 3 ],
  [ Object storage (R2) for uploads and exports ],
  [ No object store: uploads parsed at intake, content in Postgres, exports stream as Markdown ],
  [ Nothing in the Round 2 core path needs durable file storage ],
  [ Knowledge import from PDF/DOCX/URL ],
  [ Paste-to-clause import (auto-classified, versioned); file upload works for *content* intake ],
  [ Honest scoping inside the window; guideline file parsing sits in the Round 3 list ],
)

*Personas and identity -- the one deliberate limitation.* The persona picker lets any visitor select Creator, Manager, Reviewer or Admin. It is a disclosed Round 2 demo shortcut (Round 1 required real authentication), not secure role-based access control: every permission rule is still enforced server-side against the selected persona, the approval API re-checks the role, and the substitution is recorded here and in the submission document rather than hidden. Production must bind roles to authenticated identities.

= 7. Verification evidence for this build

#table(
  columns: (1.4fr, 1.6fr),
  table.cell(fill: rgb("#EAF1F8"))[*Check*],
  table.cell(fill: rgb("#EAF1F8"))[*Result*],
  [ `npm run build` ], [ Clean (Next.js 16.4.3, Turbopack) ],
  [ `npm run typecheck` ], [ Clean (`tsc --noEmit`) ],
  [ `npm test` ], [ 14/14 Vitest tests pass ],
  [ `npm run e2e` ], [ 35/35 HTTP checks pass against the production build ],
  [ Secrets scan ], [ No credentials committed; `.env` is gitignored ],
  [ Manual journey ], [ New review -> preflight -> accept/dismiss-with-reason -> blocker gate refuses submission while blockers remain -> Manager approves (audit line: `status approve (IN_REVIEW -> APPROVED)`) -> export with disclosure footnote ],
  [ Registry behaviour ], [ Registered claim matched its approved fact (no finding); unregistered claim flagged; adding a fact and re-running produced the drafted citation ],
  [ Image checks ], [ Real PNG analysed in the browser (palette + 10.00:1 contrast); missing alt text and off-palette colours flagged as blockers; 2.10:1 contrast flagged as blocker ],
  [ Guideline import ], [ Pasted text classified into check groups, stored as version N+1, and used by the next preflight run ],
  [ Bug fixed this round ], [ Re-running preflight duplicated open findings; reconciliation now replaces them wholesale -- covered by a dedicated e2e check ],
)

= 8. The three Round 3 improvements -- Round 2 state

- *IMP-1 -- Visual and accessibility audit pack.* Live now: alt-text presence/quality/length, measured contrast ratio at intake, off-palette detection, reading level, unexpanded acronyms, vague link text. Round 3: logo variant and clear-space rules; palette rules measured against a seeded image test set.
- *IMP-2 -- Guideline gap detection.* Live now: every dismissal requires a reason; reasons cluster into guideline-gap candidates in Insights. Round 3: ambiguity/conflict flags, one-click suggested clarifications, and approving guideline vN+1 from inside the product.
- *IMP-3 -- Brand health reporting.* Live now: issues per piece over time, approval cycle time, blocker counts, recurring issues by clause/check group. Round 3: monthly report with period-over-period comparison, per-creator and per-channel breakdowns, exportable format.

= 9. Links, repository and deployment

#table(
  columns: (auto, auto),
  [ *Source repository* ], [ https://github.com/ayushinn/codex48_ (public; no secrets committed) ],
  [ *Working project link* ], [ See SUBMISSION.md section 1 -- filled with the deployed preview URL ],
  [ *Round 1 plan* ], [ `round1-submission.pdf` (source: `round1-plan.typ`) ],
  [ *Round 2 document* ], [ `round2-plan.pdf` (source: `round2-plan.typ`, this file) ],
  [ *Submission form* ], [ `SUBMISSION.md` -- feature map, technology, deviations, judge script ],
)

= 10. Team details

#table(
  columns: (auto, auto),
  [ *Team name* ], [ ayushiupadhyay818 ],
  [ *Team size* ], [ 1 -- solo participant ],
  [ *Team leader and sole member* ], [ Ayushi Upadhyay ],
  [ *Team leader email* ], [ ayushiupadhyay818\@\<gmail.com\> ],
  [ *Round 1 responsibilities* ], [ Round 1 Section 7 -- unchanged: research, product definition, design, implementation, testing and submission are all carried by the sole member ],
)

#v(0.5cm)
#block(fill: rgb("#F4F7FA"), stroke: 0.6pt + rgb("#C9D6E4"), inset: 10pt, radius: 3pt)[
  *AI and tooling disclosure.* Preflight's own AI pass is optional, server-side, spend-capped and always disclosed in the product (F12). Assisted development tooling was used for scaffolding and verification; every claim in this document was verified against the running build -- build, typecheck, unit tests, HTTP suite and a manual end-to-end journey -- rather than asserted.
]