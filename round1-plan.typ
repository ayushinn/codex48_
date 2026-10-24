#set document(
  title: "Preflight - Codex 48 Hackathon Round 1: The Plan",
  author: "[YOUR FULL NAME]",
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
#align(center)[#text(size: 11pt, fill: luma(70))[ROUND 1 SUBMISSION -- THE PLAN]]
#v(1.4cm)
#align(center)[#text(size: 42pt, weight: "bold", fill: rgb("#123E6B"))[PREFLIGHT]]
#v(0.4cm)
#align(center)[#text(size: 13.5pt, style: "italic")[An intelligent brand-governance platform that reviews content before publication]]
#v(0.3cm)
#align(center)[#text(size: 10.5pt, fill: luma(70))[Catch brand problems before they publish -- explained with proof, corrected without losing the creator's intent, approved by humans.]]
#v(1.0cm)
#align(center)[#line(length: 55%, stroke: 1pt + rgb("#123E6B"))]
#v(1.0cm)

#align(center)[
  #table(
    columns: (auto, auto),
    [ *Field* ], [ *Detail* ],
    [ *Product working title* ], [ Preflight ],
    [ *Team name* ], [ [TEAM NAME -- exactly as entered in the submission form] ],
    [ *Team size* ], [ 1 -- solo participant ],
    [ *Team leader and sole member* ], [ [YOUR FULL NAME -- as it should appear on certificates] ],
    [ *Team leader email* ], [ [YOUR EMAIL] ],
    [ *Institution / organisation* ], [ [OPTIONAL] ],
    [ *Problem statement* ], [ Inkloom AI -- intelligent brand governance ],
    [ *Submission date* ], [ 24 October 2026 ],
    [ *Document* ], [ Round 1: The Plan (PDF, 1 of 1 submission per team) ],
  )
]

#v(0.8cm)
#align(center)[#text(size: 8.5pt, fill: luma(110))[Problem understood, users, solution, workflow, features, stack, responsibilities, three-round plan, impact, future scope and team details -- Sections 1 to 11.]]

#pagebreak()

// ============ HEADER / FOOTER FROM HERE ============

#set page(
  header: block(width: 100%, inset: (bottom: 4pt), stroke: (bottom: 0.5pt + luma(190)))[
    #grid(
      columns: (1fr, auto),
      text(size: 8pt, fill: luma(90))[*Preflight* -- brand governance before publication],
      text(size: 8pt, fill: luma(90))[Codex 48 Hackathon · Round 1 -- The Plan],
    )
  ],
  footer: context align(center, text(size: 8.5pt, fill: luma(90))[#counter(page).display("1")]),
)

#outline(title: [Contents], depth: 2)

#pagebreak()

= Rubric map -- where each judging criterion is answered

#table(
  columns: (1.15fr, 1.5fr),
  table.cell(fill: rgb("#EAF1F8"))[*Round 1 criterion (points)*],
  table.cell(fill: rgb("#EAF1F8"))[*Where this document answers it*],
  [ Understanding of the problem statement (25) ],
  [ Section 1 (reading of the brief + cited evidence) and Section 2 (users and setting) ],
  [ Proposed solution (25) ],
  [ Section 3 (solution and value), Section 4 (complete end-to-end workflow), Section 5 (features) ],
  [ Technical plan (20) ],
  [ Section 6 (stack rationale, architecture, most challenging part and how the design answers it), Sections 7-8 (who builds what, when) ],
  [ Originality of approach (15) ],
  [ Section 3.2 (honest competitive landscape and four defensible differentiators) ],
  [ Feasibility and scope (15) ],
  [ Section 3.3 (solo scope, cut lines, risk register), Sections 7-8 (three-round plan with exit criteria) ],
)

#v(0.3cm)
#text(size: 9.5pt, fill: luma(80))[All eleven items required by the Round 1 brief appear as numbered Sections 1 to 11. Responsible-design considerations (privacy, security, human oversight) are in Section 3.4; AI and external-service disclosure in Sections 6.5 and 11.]

#v(0.7cm)

= Executive summary

#block(fill: rgb("#F4F7FA"), stroke: 0.6pt + rgb("#C9D6E4"), inset: 10pt, radius: 3pt)[
  *The problem.* Growing organisations publish through many hands -- employees, external agencies and AI writing tools -- and nothing checks content against the brand's own approved rules before it goes live. The brief's evidence is corroborated by published research: 81% of companies still produce off-brand content (Lucidpress, 2019); 74.2% of newly indexed web pages now contain AI-generated text (Ahrefs, 2025); 94.8% of the top one million home pages fail automated WCAG checks (WebAIM, 2025); and regulators impose civil penalties of up to USD 50,120 per unsubstantiated claim (U.S. FTC, 2023). The damage lands on credibility before anyone inside the organisation notices.

  *The solution.* Preflight is a review-before-publish workspace. A creator pastes or uploads content, picks the channel, and Preflight checks it against the organisation's own guidelines, approved facts, terminology, tone and assets. Every finding explains itself in plain language, quotes the verbatim clause it violates with its source location, and proposes a correction as a diff that preserves the original intent. Nothing is auto-rejected and nothing is auto-changed: creators accept, edit or dismiss each suggestion (with a reason), comments stay anchored to individual findings, and roles -- Creator, Manager, Authorised Reviewer -- sign off through a tracked approval chain. Over time the dashboard turns repeated mistakes into governance insights, including flags for where the brand guidelines themselves are unclear.

  *Plan on a page.* Solo build, one TypeScript/Next.js codebase, PostgreSQL with pgvector, and an LLM behind a provider-agnostic adapter with a deterministic citation verifier (code, not model) so that no unverifiable quote can ever reach a reviewer. Round 2 delivers the core workflow end to end; three named improvements -- visual and accessibility audit, guideline-gap detection, and brand-health reporting -- are scheduled across Rounds 2 and 3 as required by the judging criteria (Section 5). Scope, cut lines and risks are stated in Section 3.3; effort is allocated across six workstreams in Section 7.
]

#pagebreak()

= 1. Understanding of the problem statement

Inkloom AI asks for an intelligent brand-governance platform that reviews content *before publication* and checks it against approved guidelines, facts and assets; detects issues in tone, terminology, messaging, visual consistency, accessibility and unsupported promotional claims; *explains* every issue and suggests corrections that preserve the creator's purpose instead of flatly rejecting content; provides a review-and-approval workflow where creators, managers and authorised reviewers collaborate and track changes; supports multiple content formats; surfaces repeated mistakes and areas where the brand guidelines are unclear; balances automation with human control; protects confidential materials; and discloses AI use.

Our reading of each element, and the scope decision we take from it:

#table(
  columns: (0.9fr, 1.15fr, 1fr),
  table.cell(fill: rgb("#EAF1F8"))[*What the brief asks*],
  table.cell(fill: rgb("#EAF1F8"))[*What it actually requires*],
  table.cell(fill: rgb("#EAF1F8"))[*What we will and will not build*],
  [ Content made by "multiple employees, agencies and AI tools" ],
  [ Review must work for writers outside the brand team, with no training and no tribal knowledge ],
  [ Build: zero-learning-curve review UI where every rule is quoted, not implied. Not build: brand training or style workshops ],
  [ "Before publication" ],
  [ Shift-left gate, not a post-hoc audit ],
  [ Build: pre-publication review ending at "approved, publish-ready" plus export. Not build: a social listening or post-publication monitoring tool ],
  [ "Explain each issue and suggest corrections that preserve the creator's original purpose" ],
  [ Findings must carry evidence and intent-preserving fixes; rejection alone is failure ],
  [ Build: why + verbatim quoted clause + diff-style suggestion per finding, accept/edit/dismiss per finding. Not build: auto-rewriting the document ],
  [ Tone, terminology, messaging, facts, claims, visuals, accessibility ],
  [ Seven check groups over one shared rule base ],
  [ Build: five text check groups in the Round 2 MVP; visual and image checks arrive as Improvement 1 (Section 5) ],
  [ "Review and approval workflow ... creators, managers and authorised reviewers ... track changes" ],
  [ Roles, statuses, anchored comments, revision history, audit trail ],
  [ Build: three roles + admin, state-machine approvals, comments anchored to findings, append-only revision and audit log ],
  [ "Insights into repeated mistakes or areas where the brand guidelines are unclear" ],
  [ Analytics must diagnose the guide as well as the writers ],
  [ Build: recurring-issue trends, dismissals with reasons, and guideline-gap candidates (Improvement 2) ],
  [ "Balance automation with human control" ],
  [ Automation proposes, humans decide, every decision is logged ],
  [ Build: no auto-publish, no auto-apply; low-confidence findings labelled as judgement calls; overrides captured with reason ],
  [ "Protect confidential materials and disclose AI use" ],
  [ Data handling and transparency are product features, not footnotes ],
  [ Build: per-workspace isolation, no training on customer content, optional redaction, BYO-key path, in-product AI disclosure (Section 3.4) ],
)

== Evidence that the problem is real

Desk research conducted for this plan; every figure is linked to its primary source.#footnote[Evidence discipline: the widely circulated claim that brand inconsistency "costs up to 23% of revenue" could not be verified at its original source (the 2016 Lucidpress report describes an estimated 23% lift from *improved* consistency, not a loss caused by inconsistency), so we do not use it anywhere in this plan. Survey figures are self-reported industry studies, not causal measurements, and we label them as such.]

#table(
  columns: (1.55fr, 0.85fr, 0.45fr),
  table.cell(fill: rgb("#EAF1F8"))[*Finding*],
  table.cell(fill: rgb("#EAF1F8"))[*Source*],
  table.cell(fill: rgb("#EAF1F8"))[*Year*],
  [ 81% of companies still deal with off-brand content; 50% of organisations create more content than the year before; consistent branding associated with up to 33% higher revenue ],
  [ #link("https://www.prnewswire.com/news-releases/study-finds-companies-with-consistent-branding-can-see-up-to-33-increase-in-revenue-300967219.html")[Lucidpress brand-consistency study, via PR Newswire] ],
  [ 2019 ],
  [ 74.2% of 900,000 newly detected English web pages contain AI-generated content ],
  [ #link("https://ahrefs.com/blog/what-percentage-of-new-content-is-ai-generated/")[Ahrefs study of new content] ],
  [ 2025 ],
  [ 94.8% of the top 1,000,000 home pages have detected WCAG 2 failures, averaging 51 errors per page ],
  [ #link("https://webaim.org/projects/million/2025")[WebAIM Million] ],
  [ 2025 ],
  [ 1.3 billion people -- 16% of the world's population -- experience significant disability; they are an audience for every published asset ],
  [ #link("https://www.who.int/news-room/fact-sheets/detail/disability-and-health")[World Health Organization] ],
  [ 2023 ],
  [ The U.S. FTC warned about 670 companies to substantiate product claims or face civil penalties of up to USD 50,120 per violation ],
  [ #link("https://www.ftc.gov/news-events/news/press-releases/2023/04/ftc-warns-almost-700-marketing-companies-they-could-face-civil-penalties-if-they-cant-back-their")[U.S. Federal Trade Commission] ],
  [ 2023 ],
  [ Enforcement example: DoNotPay's unsubstantiated "world's first robot lawyer" claim settled for USD 193,000 with a bar on unsupported substitution claims ],
  [ #link("https://www.ftc.gov/legal-library/browse/cases-proceedings/donotpay")[U.S. FTC case record] ],
  [ 2025 ],
)

Beyond the published research, the problem is visible in ordinary workflow: content arrives from people who never read the brand book, AI drafts make polished-sounding-but-wrong claims trivial to produce, and review today happens through chat messages and email threads where decisions are vague, late and untracked. As a solo participant inside the Round 1 window, our evidence base is this cited desk research; structured primary evidence -- three to five short interviews with creators and marketing managers, which the rules explicitly permit before development begins -- is scheduled for the first days of the build window and will be included in the Round 2 submission as user-testing evidence.

= 2. Users affected

*Organisational setting.* Growing organisations (roughly 10 to 500 people) that publish continuously across blogs, social posts, newsletters, ads, decks and press releases; where content is produced by in-house marketers, external agencies and freelancers, increasingly assisted by LLMs; and where one or two senior people silently absorb the entire review burden.

#table(
  columns: (0.75fr, 0.95fr, 1.15fr, 1.15fr),
  table.cell(fill: rgb("#EAF1F8"))[*User*],
  table.cell(fill: rgb("#EAF1F8"))[*Who they are*],
  table.cell(fill: rgb("#EAF1F8"))[*What they experience today*],
  table.cell(fill: rgb("#EAF1F8"))[*What they need*],
  [ Creator (primary) ],
  [ Employee, agency or freelancer writing or designing content ],
  [ Late, vague rejections ("this doesn't sound like us"), repeated rework, fear of publishing something wrong ],
  [ Instant, specific feedback with the exact rule and a fix, before they submit for review ],
  [ Brand / marketing manager (primary) ],
  [ Owns consistency, approves nearly everything ],
  [ Permanent bottleneck; context switching; cannot scale review across agencies; decisions lost in chat threads ],
  [ Triage view: severity, evidence, one-click accept or fix, clear status of what is waiting ],
  [ Authorised reviewer (secondary) ],
  [ Compliance, founder or PMO accountable for claims ],
  [ Cannot verify every factual or promotional claim; personal and legal exposure ],
  [ Every claim mapped side by side to the approved-facts registry and its source ],
  [ End audience (affected) ],
  [ Customers and readers of the content ],
  [ Meet inconsistent, inaccurate or inaccessible material and quietly lose trust ],
  [ Consistent, accurate, accessible communication from the organisation ],
  [ Organisation (affected) ],
  [ Brand owner ],
  [ Diluted recognition, remedial rework, regulatory exposure, no evidence of what was approved and when ],
  [ Audit trail plus governance insights that show where the guidelines themselves need work ],
)

Out of scope as users for this event: enterprise DAM administrators and social-listening teams -- their needs belong to the future scope in Section 10.

= 3. Proposed solution

== 3.1 What Preflight is

#block(fill: rgb("#F4F7FA"), stroke: 0.6pt + rgb("#C9D6E4"), inset: 10pt, radius: 3pt)[
  *Value proposition.* Your brand rules, enforced before publish -- with receipts. Preflight checks every piece of content against your own approved guidelines, approved facts, terminology, tone and assets; explains every issue with the exact clause it breaks; proposes a correction that keeps the creator's intent; and routes the decision through your people. Automation proposes, humans decide, and every decision is recorded.
]

Five components make that real:

+ *Knowledge base.* Import guidelines (PDF, DOCX, pasted text or a public URL), an approved-facts registry (claim, source, review date), terminology (approved and banned terms, product-name spelling), an asset library with usage rules, and a tone profile with good and bad examples. Versioned: every future finding cites the version it used.
+ *Review engine.* Multi-format intake -- plain text, Markdown, DOCX, PDF and images (images arrive with Improvement 1) -- normalised into one block model, then checked in seven groups: tone, terminology, messaging alignment, facts and unsupported promotional claims, visual consistency, accessibility, and channel rules.
+ *Explainable findings.* Each finding carries: severity (blocker, warn, info), a one-or-two-sentence why, the verbatim quoted clause with source and location, a suggested correction rendered as a diff over the original text, and a confidence value. A deterministic verifier (code, not model) confirms every quote exists in the source before the finding is ever displayed.
+ *Human workflow.* Creator self-review first (accept, edit, or dismiss with a reason), then comments anchored to individual findings, then role-based approval: Creator, Content Manager, Authorised Reviewer, Admin -- with statuses, revision history and an append-only audit log.
+ *Insights.* Recurring mistakes by creator, channel and term; approval cycle times; clustered dismissals that reveal where the brand book itself is unclear; a monthly brand-health report.

*What Preflight is not.* Not an asset library or DAM (assets are referenced with usage rules, not managed like Bynder), not a content generator (it reviews, never writes your campaign), not post-publication social listening, and never an auto-publisher: the product ends at "approved, publish-ready" plus export.

== 3.2 Originality of approach

Every team received this same brief. The common readings we expect are a chatbot that answers questions about an uploaded brand guide, or a generic "is this on-brand?" scorer with rules the vendor invented. Our reading is different: *governance needs a verifiable gate, not an advisor*. An advisor can be confidently wrong; a gate must produce evidence a judge, a regulator or a founder can click.

Honest landscape (we researched what these products actually do, and where the real gaps are):

#table(
  columns: (0.7fr, 0.85fr, 1.15fr, 1.2fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Category* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Examples* ],
  table.cell(fill: rgb("#EAF1F8"))[ *What they do well* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Gap Preflight addresses* ],
  [ In-editor writing assistants ],
  [ #link("https://writer.com/solutions/marketing/")[Writer], #link("https://www.grammarly.com/business")[Grammarly Business] ],
  [ Company style guides, tone profiles and terminology hints inside the tools people write in ],
  [ Advisory, not gating: no approved-facts registry check against your sources, no approval chain, no audit trail, nothing that stops publication ],
  [ Brand homes and DAM ],
  [ #link("https://www.frontify.com/en/brand-guidelines")[Frontify], #link("https://www.bynder.com/en/products/digital-asset-management/")[Bynder], #link("https://brandfolder.com/product/")[Brandfolder] ],
  [ Guidelines and assets in one place; asset approval workflows, comments and version history; Frontify's assistant links answers to guideline sections ],
  [ Reviews live on creative assets, not clause-quoted findings on text drafts; analytics describe asset usage, not where the brand book is ambiguous ],
  [ Brand scoring and compliance ],
  [ #link("https://www.brandguard.ai/")[BrandGuard], #link("https://experienceleague.adobe.com/en/docs/genstudio-for-performance-marketing/user-guide/guidelines/brand-validation")[Adobe GenStudio] ],
  [ Adherence scoring against a style guide; GenStudio genuinely combines brand checks with accessibility checks (alt text, contrast, readable language) ],
  [ Enterprise-oriented configuration and pricing; findings are not built around a verbatim quote of the exact clause plus a small-team creator-to-manager-to-reviewer text workflow ],
)

Four defensible differentiators -- each maps to an explicit ask in the brief:

+ *Evidence-linked findings by construction.* Every finding shows a verbatim quote, clause ID and location from the customer's own document, and a deterministic citation verifier rejects any finding whose quote cannot be matched back to the source. No unverifiable finding ever reaches a reviewer -- the brief's "reliable, explainable results", enforced by code rather than promised by a model.
+ *The guideline-gap loop.* The brief asks for insight into "areas where the brand guidelines are unclear". Clustered dismissals with reasons plus repeated blocker patterns answer the question no reviewed product asks: *is the creator wrong, or is the brand book unclear?* The output is concrete suggested clarifications for the guideline owner, closing the loop into guidelines vN+1.
+ *A text-first approval workspace in one tool.* Finding-anchored comments, role-based sign-off and revision history for drafts -- not only for creative assets -- at small-team complexity and free-tier cost, where today's alternatives are enterprise DAMs or scattered chat threads.
+ *Trust posture as product rules.* Suggest-don't-overwrite is enforced (suggestions apply only on explicit human accept), an AI-disclosure badge sits on every review, low-confidence findings are labelled as judgement calls, and confidential teams can bring their own key.

*What we deliberately do not claim.* Brand checking, accessibility checks and approval workflows all exist somewhere in the market; several competitors do them well. Our originality claim is the combination -- evidence-first findings, an integrated text review-and-approval workspace, and analytics that diagnose the guideline itself -- aimed squarely at small and growing teams, which is exactly the part of the brief (explain, suggest, human control, unclear-guideline insight) that scoring tools leave unsolved.

== 3.3 Feasibility and scope

A solo build succeeds only with a hard cut line. One person, one language (TypeScript), one codebase (Next.js full stack) and free-tier infrastructure means no coordination overhead and no vendor commitments; every deferred item below has a named home in Round 3 or Section 10.

#table(
  columns: (1fr, 1fr, 1fr),
  table.cell(fill: rgb("#EAF1F8"))[ *In scope -- Round 2 MVP* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Round 3 -- the three improvements* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Out -- future scope (Section 10)* ],
  [ Text intake (paste, Markdown, DOCX, PDF); knowledge-base import with versioning; facts and terminology registries; five text check groups; evidence-linked findings with verifier; diff suggestions with accept / edit / dismiss; three roles plus admin; anchored comments; approvals with audit log; basic recurring-issue dashboard; export of the approved version ],
  [ IMP-1 visual and accessibility audit (images, alt text, contrast, palette); IMP-2 guideline-gap detection with suggested clarifications; IMP-3 brand-health report with trends and export ],
  [ Browser or Docs extension; CMS publish webhooks; Slack and Teams bots; multi-language review; SSO; on-prem or customer-managed keys; DAM-style asset storage; supplier portals; compliance packs by industry ],
)

*Effort assumption.* The plan assumes roughly 12 to 15 working days of build time inside the announced windows; if the window is shorter, the Round 3 column and the Round 2 dashboard shrink further -- never the evidence-linked core, which is the product.

*Risk register.*

#table(
  columns: (0.8fr, 0.4fr, 1.3fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Risk* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Level* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Mitigation* ],
  [ Model invents a citation or over-flags style nits ],
  [ High impact ],
  [ Retrieval-first scoping, strict JSON contract, deterministic citation verifier, severity mapped from rule type (Section 6.3), golden-set evaluation every build ],
  [ Scope creep ],
  [ High ],
  [ Only the three named improvements may be added; everything else is Section 10; weekly exit criteria in Section 8 ],
  [ No AI key or budget yet ],
  [ Medium ],
  [ Provider-agnostic adapter; free-tier model at MVP; spend cap and daily budget in code; acquiring the key is task one of the build window ],
  [ Confidential content leaving the organisation ],
  [ Medium impact ],
  [ No training on customer content, provider zero-retention settings, optional redaction before send, BYO-key path (Section 3.4) ],
  [ Solo availability (illness, exams) ],
  [ Medium ],
  [ Cut-line discipline: the Round 2 exit criteria in Section 8 are the floor; deeper items drop first ],
)

== 3.4 Responsible-design considerations (privacy, security and human oversight)

- *Confidentiality.* Per-workspace data isolation enforced with Postgres row-level security; least-privilege roles; TLS in transit; encryption at rest on managed storage; uploads in private object storage with expiring links; retention controls with one-click workspace deletion; optional PII redaction before any external call; BYO-key option for regulated teams. Customer content is never used to train models.
- *Human oversight.* No auto-publish and no auto-apply, ever. Low-confidence findings are labelled "judgement call", not "error". Every override or dismissal is captured with a reason and fed to the guideline-gap analysis -- human decisions are signal, not noise. Every state change lands in an append-only audit log (who, what, when, which guideline version).
- *AI and external-service disclosure.* A persistent "AI-assisted review" badge appears on every findings panel, an external-services page names each provider and what data it receives, and exported approval records carry a disclosure footnote. This satisfies the brief's disclosure requirement inside the product, not only in this document.
- *Accessibility of our own product.* The review UI targets WCAG 2.2 AA (keyboard operation, visible focus, contrast, semantic tables) -- we dogfood the very checks we sell.
- *IP, licences and honesty of record.* Only licence-compatible libraries and APIs (listed in Section 6); no scraping of third-party brand material; templates or boilerplate and any AI-generated components will be disclosed in the repository as the rules require.

= 4. Complete product workflow

Roles and permissions (role-based, enforced server-side; a solo workspace can collapse Creator and Manager into one person without changing the state machine):

#table(
  columns: (0.55fr, 1.45fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Role* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Permissions* ],
  [ Creator ],
  [ Create reviews, run preflight, resolve or dismiss own findings (reason required), comment, submit for review, revise and resubmit ],
  [ Content Manager ],
  [ All creator powers plus approve or request changes, reassign reviewers, view insights, manage who reviews what ],
  [ Authorised Reviewer ],
  [ Read-only on content; verify claims against the facts registry, approve or request changes; cannot edit content -- separation of duties ],
  [ Admin ],
  [ Knowledge base and versioning, registries, roles, workspace settings, external-services disclosure, retention and deletion ],
)

Statuses: *DRAFT* → *SELF-REVIEW* → *READY FOR REVIEW* → *IN REVIEW* → *APPROVED* → *PUBLISH-READY*, with *CHANGES REQUESTED* looping back from IN REVIEW. Illegal transitions are rejected by a state machine, not by convention.

The end-to-end flow:

+ *One-time setup (Admin).* Import the brand guidelines (PDF, DOCX, pasted text or public URL); register approved facts as claim, source and review date; add approved and banned terminology; add assets with usage rules; describe tone with good and bad examples. The knowledge base is versioned -- every finding later cites the exact version it used.
+ *Intake (Creator).* New review: paste or upload content, pick content type and channel (social post, blog, email, ad copy, press release, deck copy). The channel selects rule subsets, length limits and tone expectations.
+ *Automated preflight (System).* Normalise to the block model, hybrid-retrieve the applicable clauses and facts, run the check groups, then gate every candidate finding through the deterministic citation verifier and the severity map before anything is displayed. The AI call is disclosed and spend-capped.
+ *Creator self-review.* Findings appear inline: severity, why, verbatim quote with location, diff suggestion, confidence. The creator accepts, edits or dismisses each with a reason. Re-running the preflight shows a before-and-after diff. The review advances only when every blocker is resolved or explicitly waived -- and waivers are logged with justification.
+ *Collaboration (Creator and Manager).* Comments anchored to individual findings or text spans, mentions, resolvable threads, full revision history with diffs.
+ *Approval (Manager; Authorised Reviewer joins when claims or regulated terms are involved).* IN REVIEW ends in APPROVED or CHANGES REQUESTED (loop back to step 4). Claim-bearing content automatically surfaces the approved-facts registry side by side. A creator cannot approve their own content unless the workspace explicitly allows single-person sign-off -- the honest configuration for a team of one.
+ *Publish handoff.* The approved version exports as rich-text copy, Markdown or DOCX, together with an approval record: who signed, when, guideline version, findings resolved versus waived, AI disclosure footnote. CMS webhooks are future scope (Section 10).
+ *Insights and maintenance (Manager, Admin).* The dashboard shows recurring issues, trends and cycle times plus guideline-gap candidates. The admin accepts a suggested clarification, the knowledge base bumps to vN+1, and future reviews cite the new version -- the loop closes by improving the brand book itself, not only the content.

State machine and non-negotiables:

```text
 DRAFT --> SELF-REVIEW --> READY FOR REVIEW --> IN REVIEW --> APPROVED --> PUBLISH-READY
            ^   accept / edit / dismiss+reason     |  approve      (export + audit record)
            |   blockers cleared or waived         |
            +---------- CHANGES REQUESTED <--------+
                             ^
       comments anchored to findings · revision history at every step

 RULES: only a human accept applies an AI suggestion (never auto-apply)
        a creator cannot self-approve unless the workspace allows it
        every transition logs actor, time, guideline version and reason
```

= 5. Main features

#table(
  columns: (0.35fr, 0.85fr, 1.6fr, 0.35fr),
  table.cell(fill: rgb("#EAF1F8"))[ *ID* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Feature* ],
  table.cell(fill: rgb("#EAF1F8"))[ *What it delivers* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Pri.* ],
  [ F1 ], [ Knowledge-base import and versioning ], [ PDF, DOCX, URL or paste in; clause IDs, version history; every finding cites its version ], [ P0 ],
  [ F2 ], [ Approved-facts registry ], [ Claim, source, review date; side-by-side verification panel during approval ], [ P0 ],
  [ F3 ], [ Terminology enforcement ], [ Approved and banned terms, product-name spelling, capitalisation and locale rules ], [ P0 ],
  [ F4 ], [ Multi-format intake ], [ Text, Markdown, DOCX and PDF normalised into one block model so all checks behave identically ], [ P0 ],
  [ F5 ], [ Seven check groups ], [ Tone, terminology, messaging, facts and unsupported claims, visual consistency, accessibility, channel rules -- five in the MVP, seven by Round 3 ], [ P0 ],
  [ F6 ], [ Explainable findings ], [ Severity, plain-language why, verbatim quote with source and location, confidence ], [ P0 ],
  [ F7 ], [ Corrections as diffs ], [ Intent-preserving suggestion per finding; accept, edit or dismiss-with-reason; never auto-applied ], [ P0 ],
  [ F8 ], [ Deterministic citation verifier ], [ A quote that cannot be matched to the source suppresses the finding and increments a verifier-rejection metric ], [ P0 ],
  [ F9 ], [ Roles and approval state machine ], [ Creator, Manager, Authorised Reviewer, Admin; enforced statuses; no self-approval by default ], [ P0 ],
  [ F10 ], [ Anchored comments and revision history ], [ Threads on findings or text spans, diffable revisions, append-only audit log ], [ P0 ],
  [ F11 ], [ Insights dashboard -- basic ], [ Recurring issues by creator, channel and term; approval cycle times; dismissals with reasons ], [ P0 ],
  [ F12 ], [ AI disclosure and services page ], [ In-product badge, named provider, data-received statement, spend cap ], [ P0 ],
  [ F13 ], [ Image intake and visual checks -- IMP-1 ], [ Alt-text presence and quality, contrast, off-palette colours, logo variant and clear-space rules ], [ P1 ],
  [ F14 ], [ Guideline-gap detection -- IMP-2 ], [ Dismissal clustering, ambiguity flags, suggested clarifications for the guideline owner ], [ P1 ],
  [ F15 ], [ Brand-health reporting -- IMP-3 ], [ Monthly trends, before-and-after issue rates, exportable report ], [ P1 ],
  [ F16 ], [ Publish integrations ], [ CMS webhook, browser or Docs extension, Slack and Teams bot -- gated publishing where content is made ], [ P2 ],
)

== The three improvements we name for Rounds 2 and 3

The judging criteria award 15 points in Round 2 for "the three improvements you named" and 20 in Round 3 for "the three improvements delivered". We name them now, precisely, so delivery can be verified against this text:

#block(fill: rgb("#FFF8E8"), stroke: 0.6pt + rgb("#E4CF9A"), inset: 10pt, radius: 3pt)[
  *IMP-1 -- Visual and accessibility audit pack.* Image uploads checked for alt-text presence and quality, text/background contrast, off-palette colours, and logo variant and clear-space rules; text accessibility additions (reading level, unexplained abbreviations, vague link text). Round 2: alt text and contrast live. Round 3: palette and logo rules complete, measured against a seeded image test set.

  *IMP-2 -- Guideline-gap detection.* Cluster dismissals-with-reason and repeated blocker patterns to flag ambiguous, missing or conflicting rules, surfaced as gap cards with one-click suggested clarifications. Round 2: event capture and basic grouping in insights. Round 3: gap cards, suggestion drafting, and guideline vN+1 approved from inside the product.

  *IMP-3 -- Brand-health reporting.* Trend views (issues per piece of content, per creator, per channel; approval cycle time; blocker rate before and after adoption) plus a monthly exportable report. Round 2: live dashboard with core trends. Round 3: report generation, export and period-over-period comparison.
]

Each improvement is additive to -- never a replacement for -- the Round 2 core workflow, and each has a stated Round 2 partial state so progress can be judged honestly even if Round 3 time runs short.

= 6. Technology stack and technical plan

Every choice below is driven by three solo-build constraints: one language everywhere, free-tier infrastructure, and the fewest moving parts that still satisfy the brief. The stack is justified, not defaulted to.

== Stack and why we chose it

#table(
  columns: (0.5fr, 0.85fr, 1.65fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Layer* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Choice* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Why this choice for a solo build* ],
  [ Language ], [ TypeScript end to end ], [ One language, one mental model; types shared across UI, API and database eliminate an entire class of integration bugs ],
  [ Framework ], [ Next.js (App Router, server components, route handlers) ], [ UI and API in one codebase and one deploy; no separate backend service to provision, monitor or pay for ],
  [ Database ], [ PostgreSQL with pgvector (Supabase or Neon free tier) ], [ Workflow data and vector retrieval in one store; row-level security gives per-workspace isolation at the database layer, not only in app code ],
  [ ORM and validation ], [ Drizzle ORM plus Zod ], [ Typed schema from database to route handler; every input validated at the boundary; lightweight, no code generation pipeline ],
  [ Authentication ], [ Auth.js (email magic link plus Google) ], [ No password storage or recovery surface to build; roles enforced in the app and mirrored by database row-level security ],
  [ Object storage ], [ S3-compatible storage (Cloudflare R2 free tier) ], [ Private uploads, expiring download links, export artefacts -- without putting customer documents in the database ],
  [ Document parsing ], [ mammoth (DOCX), pdf-parse (PDF text), native Markdown and plain text ], [ Deterministic extraction into the shared block model, so checks behave identically regardless of source format ],
  [ AI layer ], [ Provider-agnostic adapter over OpenAI-compatible chat completions with structured JSON output ], [ Swap providers with an environment variable; start on a free tier; BYO-key supported. No key is provisioned yet -- obtaining one is task one of the build window, and the architecture depends on no single vendor ],
  [ UI styling ], [ Tailwind CSS plus shadcn/ui ], [ Fast, consistent, accessible components; keyboard-operable controls we would otherwise have to build and maintain ourselves ],
  [ Background work ], [ In-process queue with retry and idempotency keys ], [ No broker or Redis at MVP scale; documented upgrade path to a worker when volume requires it ],
  [ Testing ], [ Vitest (unit) plus Playwright (end-to-end) ], [ Round 3 judging needs reliability evidence; the end-to-end suite drives the full workflow through real HTTP ],
  [ Repository and deploy ], [ GitHub from the first minute of the build window; free-tier hosting (Vercel or Cloudflare) ], [ Commit history as permitted evidence of when work happened; a public repository for Round 2 as the brief requires ],
)

== System architecture

```text
+------------- Browser: Next.js UI (Tailwind + shadcn/ui) ------------------+
|  Review workspace | Approval queue | Insights | Knowledge base            |
+----------------------+----------------------------------+-------------------+
                       | HTTPS - session auth - role check
+----------------------v----------------------------------+-------------------+
| Next.js route handlers (TypeScript, Zod-validated)                        |
|  + Ingestion : parse PDF/DOCX/MD/txt -> block model -> chunk -> embed      |
|  + Review    : retrieve clauses -> LLM checks -> citation verifier (code)  |
|  + Workflow  : comments, approvals, revisions, audit log (state machine)  |
|  + Insights  : recurring-issue aggregation, guideline-gap clustering      |
+----------------------+----------------------------------+-------------------+
                       |                                  |
+----------------------v-------------+  +-------------------v----------------+
| PostgreSQL + pgvector              |  | LLM adapter (OpenAI-compatible)    |
| workspaces, roles, clauses,        |  | strict JSON schema, retries,       |
| findings, revisions, audit log     |  | spend cap, provider via env var    |
| row-level security per workspace   |  +-------------------+----------------+
+----------------------+-------------+                      | disclosed call
+----------------------v-------------+  +-------------------v----------------+
| Object storage (R2 or S3)          |  | AI provider (free tier, BYO-key)   |
| uploads, exports, expiring links   |  +------------------------------------+
+------------------------------------+
```

Four properties matter for judging: the browser never talks to the AI provider directly (the key stays server-side); every finding passes a deterministic verifier before display; all workflow state changes go through one state machine into an append-only log; and the provider is swappable without touching product code.

== The most technically challenging part, and how the architecture answers it

*Grounded explainability from an unreliable generator.* The product's entire promise is "every flagged issue quotes a real clause you can click" -- yet language models can invent quotes, attribute a rule to the wrong section, over-flag harmless style variations, and drift on severity. One fabricated citation destroys the trust the product sells, so this is the problem the design must solve first, not last.

The answer is a pipeline with deterministic gates around the model:

+ *Retrieval-first scoping.* Findings may only cite clauses and facts retrieved from the workspace knowledge base (hybrid vector plus keyword search returning clause IDs). The model never reviews against its own memory of the guide, so the candidate evidence set is fixed and auditable before generation begins.
+ *Strict output contract.* Every check returns a JSON schema object: clause ID, verbatim quote, source span, severity, category, one-sentence why, suggestion, confidence. Invalid output is retried once, then the review fails loudly -- a silent pass is never possible.
+ *Deterministic citation verifier (code, not model).* The quoted text is normalised and matched back to the stored clause (exact, then fuzzy with a similarity floor). A finding whose quote does not match is discarded and counted in a verifier-rejection metric visible in insights. This single gate is what makes "reliable, explainable results" an engineering property rather than a marketing claim.
+ *Claim checking against the registry, not plausibility.* Promotional and factual claims are extracted, then matched to the approved-facts registry; unmatched claims are flagged against the policy clause that requires registration -- so even an absence finding cites a real rule instead of quoting nothing.
+ *Deterministic severity mapping.* Severity comes from the rule type (policy equals blocker, style guideline equals warn, preference equals info), not from the model's mood; confidence below threshold renders the finding as "judgement call" for a human, never as an error.
+ *Intent-preserving suggestions by construction.* Corrections are diffs over exact spans of the original text, applied only on human accept -- the model cannot rewrite the document wholesale, so the creator's purpose survives by design.
+ *Evaluation harness.* A golden set of roughly thirty seeded violations (several per check group) plus clean documents; precision, recall and verifier-rejection rate are measured on every build. This produces the reliability numbers Round 3 judging asks for.

*Secondary challenges, briefly.* Multi-format normalisation: one block model (paragraph, heading, list, image) is produced at ingestion so every check has a single target regardless of source format. Workflow integrity: statuses are a state machine with optimistic locking and append-only revisions, so concurrent comments or double approvals cannot corrupt history.

== Data sources, integrations and external services

- *Inputs:* only what the workspace's own people upload or paste, plus a user-initiated fetch of a public guideline URL. No scraping, no purchased datasets, no third-party brand material.
- *Outputs:* export of approved content and approval records; a CMS publish webhook arrives after the event (Section 10).
- *External services at MVP:* one AI provider (disclosed in-product), transactional email for sign-in links, and the hosting platform. Each is named on the external-services page inside the product -- the brief's disclosure requirement, implemented rather than promised.
- *Cost control:* retrieval-first prompts keep context small, JSON outputs keep completions short, and a hard daily spend cap lives in the adapter.

Security and privacy mechanics (secrets in environment variables only, TLS, hashed sessions, row-level security, retention and deletion controls, provider zero-retention settings, no training on customer content) are specified once in Section 3.4 and implemented there; this section only confirms they shape the architecture -- the AI key never reaches the browser and customer documents never leave the chosen boundary without disclosure.

= 7. Responsibilities of each team member

This is a solo team: one participant, [YOUR FULL NAME], carries every responsibility, and is also the team leader. There is no coordination overhead and no hand-off loss; the corresponding risk -- a single point of failure -- is managed through the cut lines and weekly exit criteria in Section 8. Judges may question this member on any part of the product, which is consistent by construction because there is only one member.

#table(
  columns: (0.75fr, 1.55fr, 0.45fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Workstream* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Responsibility* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Share* ],
  [ AI review pipeline (largest) ], [ Ingestion, chunking and embedding, check-group prompts and JSON schemas, citation verifier, claim matching, evaluation harness ], [ 25% ],
  [ Architecture and backend ], [ Schema and migrations, route handlers, auth and roles, row-level security, object storage, state machine and audit log ], [ 20% ],
  [ Frontend ], [ Review workspace with inline findings and diffs, comment threads, approval screens, knowledge-base UI, insights dashboard ], [ 20% ],
  [ Product and design ], [ Problem framing, personas, workflow and status design, wireframes, interface copy, accessibility of the product itself ], [ 15% ],
  [ Research and outreach ], [ Cited desk research (delivered in this document), three to five user interviews at the start of the build window, structured tester feedback for Round 2 ], [ 10% ],
  [ QA, DevOps and documentation ], [ Vitest and Playwright suites, golden-set evaluation, deployment, repository hygiene and commit discipline, README and architecture notes, demo script ], [ 10% ],
)

The same allocation, phrased as individual contribution, will be entered in the submission form's contribution field so that the form entry and this document match exactly (Section 11).

= 8. Development plan across all three rounds

Premise, per the event rules: all product code is written inside the official build windows only. Before the window, research, planning and interviews are permitted -- that is what this document is. The repository is created and the first commit lands when Round 2 opens; AI coding tools used during the window will be disclosed in the repository as the rules require.

#table(
  columns: (0.45fr, 0.75fr, 1.8fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Round* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Goal* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Work and deliverables* ],
  [ Round 1 -- The Plan (now) ], [ Understand and commit ], [ Cited desk research; personas; solution, workflow and features; architecture and stack rationale; the three named improvements; role allocation; this PDF -- submitted before 25 October, 6:00 PM IST ],
  [ Round 2 -- The Build ], [ Core workflow runs end to end, publicly ], [ Weeks below; deployed instance, public repository, architecture notes, disclosure of APIs, models, libraries and tools, structured tester feedback, honest status of the three improvements ],
  [ Round 3 -- The Finish ], [ Complete, reliable, documented ], [ All three improvements delivered to their Section 5 definitions; reliability numbers from the evaluation harness; accessibility and security passes; demo video or live demo; privacy, security and responsible-design write-up; known limitations and roadmap; final contribution details ],
)

== Round 2 week-by-week (weeks counted from the announced window start; dates adjusted to the organiser's schedule)

#table(
  columns: (0.3fr, 1.55fr, 0.9fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Week* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Deliverables* ],
  table.cell(fill: rgb("#EAF1F8"))[ *How it is verified* ],
  [ W1 ], [ Repository and CI; auth plus roles; database schema with row-level security; knowledge-base import with chunking and embedding; preflight skeleton covering tone and terminology; findings page rendering verbatim quotes ], [ Paste content into an uploaded guide and see real, quoted findings in a deployed environment ],
  [ W2 ], [ Citation verifier and severity mapping; approved-facts registry plus unsupported-claim check; remaining text check groups (messaging, text accessibility, channel rules); diff suggestions with accept, edit and dismiss-with-reason ], [ Golden set of roughly 30 seeded violations runs green; a planted fake quote is rejected by the verifier ],
  [ W3 ], [ Approval state machine with roles; anchored comments; revision history and audit log; insights v1 (recurring issues, cycle times); IMP-1 begins (alt text and contrast) ], [ Playwright end-to-end test drives creator and manager through the full workflow ],
  [ W4 ], [ Seeded demo workspace with a realistic sample brand guide; deployment; README and architecture notes; structured user testing with three to five people plus fixes; Round-2 submission write-up with disclosures and honest improvement status ], [ Judges reproduce the full flow on the public URL; commit history tells a clean story ],
)

#block(fill: rgb("#EAF7EE"), stroke: 0.6pt + rgb("#A7D0B8"), inset: 10pt, radius: 3pt)[
  *Round 2 exit criteria (the floor, not the ceiling).* A judge, without assistance, can: sign in, upload a brand guide, paste content, receive findings that quote the exact clause, accept the suggested fixes, submit for review, watch a manager approve it, and see one governance insight -- on a public URL, with no console errors. If time runs short, the insights dashboard and IMP-1 shrink; this flow never does.
]

== Round 3 priorities

+ *Deliver the three improvements* exactly as defined in Section 5 (visual and accessibility audit complete; guideline-gap cards with suggested clarifications; brand-health report with export).
+ *Reliability evidence:* golden-set precision, recall and verifier-rejection numbers; p95 review latency measured on realistic documents; retry and idempotency hardening; graceful failure states (review cannot fail silently).
+ *Usability and accessibility:* WCAG 2.2 AA pass on the product itself, empty states and first-run guidance, fixes driven by Round 2 tester feedback -- evidence for the "usability and real-world fit" criterion.
+ *Documentation and governance:* README, architecture-decision notes, privacy, security, accessibility and responsible-design statement, AI and external-service disclosure page, known limitations, and the roadmap in Section 10.
+ *Presentation:* demo video or live demonstration as requested, plus final contribution statements matching Section 11.

== How each later-round criterion is addressed

#table(
  columns: (0.35fr, 0.95fr, 1.55fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Round* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Criterion (points)* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Where the plan delivers it* ],
  [ 2 ], [ Core workflow end to end (30) ], [ Weeks 1-3 plus the exit criteria above; the flow is defined in Section 4 ],
  [ 2 ], [ Technical depth and reliability (25) ], [ Citation verifier, strict schemas, row-level security, state machine, golden-set harness (Section 6.3) ],
  [ 2 ], [ Progress against the plan (20) ], [ This document is the baseline; weekly milestones with verification columns make drift visible ],
  [ 2 ], [ The three improvements you named (15) ], [ IMP-1 partial (alt text, contrast) and IMP-2 data capture by Round 2 close, as stated in Section 5 ],
  [ 2 ], [ Usability so far (10) ], [ Week 4 structured testing with three to five people plus recorded fixes ],
  [ 3 ], [ Completeness of the product (25) ], [ All P0 features (Section 5) plus IMP-1 to IMP-3 in their final states ],
  [ 3 ], [ The three improvements delivered (20) ], [ Exact Round 3 definitions from Section 5, each verifiable against this text ],
  [ 3 ], [ Reliability under normal use (20) ], [ Evaluation numbers, latency measurements, error-state hardening, regression suite in CI ],
  [ 3 ], [ Usability and real-world fit (20) ], [ Accessibility pass, tester-driven fixes, realistic seeded demo workspace ],
  [ 3 ], [ Documentation and roadmap (15) ], [ README, architecture notes, responsible-design statement, known limitations, Section 10 roadmap ],
)

= 9. Expected impact

Stated as measurable expectations, not guarantees; baselines are captured during Round 2 pilot testing so before-and-after comparisons are honest. We claim prevention, not revenue causation.

#table(
  columns: (0.85fr, 0.95fr, 0.75fr, 0.65fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Outcome* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Metric* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Pilot target* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Ties to* ],
  [ Fewer off-brand pieces reach publish ], [ Share of approved content carrying zero unresolved blockers, versus a pre-Preflight audit of the same corpus ], [ 70% fewer ], [ Section 1 (81% off-brand) ],
  [ Faster, less bottlenecked reviews ], [ Median time from submit to decision ], [ 40-60% faster ], [ Section 1 (content volume growth) ],
  [ No unsupported claims ship ], [ Unsupported promotional claims found in the published pilot set ], [ Zero -- registered or removed ], [ Section 1 (FTC penalties) ],
  [ Accessible content by default ], [ Pilot content passing alt-text and contrast checks ], [ 95% or better ], [ Section 1 (WebAIM, WHO) ],
  [ Guidelines get clearer over time ], [ Guideline-gap candidates closed per quarter ], [ 5 or more clarifications shipped ], [ Brief: "areas where the brand guidelines are unclear" ],
  [ Human control remains decisive ], [ AI suggestions applied without an explicit human accept ], [ 0% -- enforced by the product ], [ Brief: "balance automation with human control" ],
)

Secondary effects we expect but will not overstate: review work becomes visible (it was previously a private favour), new joiners learn the brand rules by reading quoted clauses instead of asking in chat, and agencies see the same rules the in-house team sees.

= 10. Future scope of the product after the event

Everything in this section is deliberately outside the hackathon commitments; it is where the product goes once Round 3 ships.

- *Meet content where it is written.* A browser extension and Google Docs add-in that run preflight inside the drafting tool, and a Slack or Teams bot that reviews content in the channel where it is proposed.
- *Gate the pipeline, not just the page.* A publish webhook for WordPress, Webflow and HubSpot so approved content flows onward automatically -- and the inverse: a content API that lets a publishing pipeline fail fast on unresolved blockers.
- *Scale the organisation model.* Multi-brand and multi-locale workspaces, supplier and agency portals with scoped visibility, SSO and directory sync, and finer reviewer policies per content type.
- *Deepen the intelligence.* Fine-tuning a small checker model on the workspace's own accepted and dismissed findings; industry claim-compliance packs; multilingual review with locale-aware terminology.
- *Trust for regulated teams.* On-premises or private-cloud deployment, customer-managed encryption keys, and longer configurable retention -- the confidential-material story from Section 3.4 taken to its conclusion.
- *The brand book as a living system.* Scheduled guideline health reviews generated from accumulated gap analytics, so the knowledge base itself is maintained on a cadence rather than once a year.

= 11. Complete team and participant details

#table(
  columns: (0.6fr, 1.4fr),
  table.cell(fill: rgb("#EAF1F8"))[ *Field* ],
  table.cell(fill: rgb("#EAF1F8"))[ *Detail* ],
  [ Team name ], [ [TEAM NAME -- must match the submission form exactly, as it should appear on certificates] ],
  [ Team size ], [ 1 -- solo participation; the sole member is also the team leader ],
  [ Member 1 ], [ [YOUR FULL NAME AS ON CERTIFICATES] -- team leader and sole member; role: product engineer end-to-end (product and design, architecture, AI review pipeline, frontend, QA and deployment, documentation); email: [YOUR EMAIL] ],
  [ Institution / organisation ], [ [OPTIONAL] ],
  [ Contact number ], [ [OPTIONAL] ],
  [ Individual contribution entry ], [ The Google Form contribution field will state the same allocation as Section 7 (AI pipeline 25%, backend 20%, frontend 20%, product and design 15%, research 10%, QA and DevOps 10%), so the form entry and this document cannot contradict each other ],
  [ Submission logistics ], [ One PDF per team, uploaded to Google Drive with "Anyone with the link -- Viewer", tested in an incognito window, submitted by the team leader before the deadline ],
)

#block(fill: rgb("#F4F7FA"), stroke: 0.6pt + rgb("#C9D6E4"), inset: 10pt, radius: 3pt)[
  *Declaration and disclosures.*

  1. This plan is original work prepared for the Codex 48 Hackathon Round 1. No product code was written before the official build window; all development will occur inside the announced windows (event Rules 1-4).
  2. Evidence in Section 1 comes from cited public sources; no interviews, surveys or third-party data are claimed that were not actually conducted. User interviews planned for the build window will be reported only if they happen (Rules 14, 17).
  3. This document was prepared with the assistance of an AI writing and research tool, and that assistance is disclosed here as required by Rule 7. Significant AI-generated components, libraries, models and templates used during the build will be disclosed in the repository and in the Round 2 submission.
  4. Participant details above are truthful and will be double-checked for spelling before submission; certificates will use these names (Rules 14, 17).
]

#v(0.4cm)
#align(center)[#text(size: 9pt, fill: luma(100))[-- End of Round 1 submission. Team: [TEAM NAME] · Member: [YOUR FULL NAME] · 24 October 2026 --]]
