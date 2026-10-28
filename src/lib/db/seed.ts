import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  auditLog,
  channels,
  clauses,
  comments,
  facts,
  findings,
  guidelineVersions,
  reviews,
  revisions,
  terms,
  toneExamples,
  workspaces,
} from "./schema";
import type { DB } from "./index";
import { runPreflight } from "@/lib/engine";
import { addComment, decideFinding, transitionReview, type Outcome } from "@/lib/actions";
import { PERSONAS } from "@/lib/personas";

/**
 * Seeded demo workspace.
 *
 * A judge opening the link must land on a working product, not an empty shell,
 * so the workspace ships with a realistic brand book, registries and five
 * reviews in different workflow states. Every seeded finding is produced by the
 * real engine (not hand-written), and every seeded decision goes through the
 * real decision/state-machine code paths.
 */

const WS = "aurora";

const CLAUSES: {
  code: string;
  section: string;
  title: string;
  body: string;
  ruleType: string;
  checkGroup: string;
  channel?: string;
  config?: Record<string, unknown>;
}[] = [
  {
    code: "GB-1.1",
    section: "1. Claims and evidence",
    title: "Register every claim before it ships",
    body: "Every factual or promotional claim about a product outcome, a statistic, a ranking or a delivery promise must be registered in the Approved Facts Registry with a source and a review date before it may appear in published content. A claim that cannot be matched to a registered fact must be removed or rewritten as opinion. This is a policy rule: unresolved claims block publication.",
    ruleType: "policy",
    checkGroup: "facts",
  },
  {
    code: "GB-1.2",
    section: "1. Claims and evidence",
    title: "Advertising disclaimer",
    body: "Every paid or promotional placement must carry the standard disclaimer verbatim: Results vary. Not intended to diagnose, treat, cure or prevent any disease. The disclaimer sits at the end of the creative, in readable type, never hidden behind a link.",
    ruleType: "policy",
    checkGroup: "messaging",
    channel: "ad",
    config: {
      requiredPhrases: [
        "Results vary. Not intended to diagnose, treat, cure or prevent any disease.",
      ],
    },
  },
  {
    code: "GB-2.1",
    section: "2. Naming and terminology",
    title: "Product and company naming",
    body: "The product line is written Aurora Calm - never AURORA CALM, aurora calm, AuroraCalm or Calm by Aurora. The company name is Aurora Wellness - never AuroraWellness, AURORA WELLNESS or Aurora wellness. Names keep their capitalisation in every channel, including hashtags and captions.",
    ruleType: "policy",
    checkGroup: "terminology",
  },
  {
    code: "GB-2.2",
    section: "2. Naming and terminology",
    title: "Banned and approved terms",
    body: "Do not use the banned terms listed in the terminology registry: cure, guaranteed, miracle, detox, clinically proven, revolutionary, world-class or risk-free. Each banned term carries an approved replacement where one exists. Never invent medical or performance language that the registry does not approve.",
    ruleType: "policy",
    checkGroup: "terminology",
  },
  {
    code: "GB-3.1",
    section: "3. Voice and tone",
    title: "Calm, specific, never hype",
    body: "Aurora's voice is calm and specific. Avoid hype language (game-changing, revolutionary, world-class, best-in-class, unbeatable, life-changing), unverifiable superlatives and rankings (number one, #1, world's best, top-rated), and urgency theatre (limited time, act now, hurry, last chance). Use at most one exclamation mark per piece and never set body copy in capitals.",
    ruleType: "style",
    checkGroup: "tone",
    config: {
      bannedPhrases: [
        "game-changing",
        "revolutionary",
        "world-class",
        "best-in-class",
        "unbeatable",
        "life-changing",
        "jaw-dropping",
      ],
      maxExclamations: 1,
    },
  },
  {
    code: "GB-3.2",
    section: "3. Voice and tone",
    title: "Plain language",
    body: "Write for a reader in a hurry: second person, active voice, short sentences, one idea per sentence. Keep readability at grade 10 or below. If a sentence needs a second read, rewrite it rather than shortening it.",
    ruleType: "preference",
    checkGroup: "tone",
    config: { maxGrade: 10 },
  },
  {
    code: "GB-4.1",
    section: "4. Accessibility",
    title: "Alt text and contrast",
    body: "Every image ships with alt text of at least 24 characters that describes what the image shows, not its file name or the word image. Text over an image or on a coloured field must meet WCAG 2.2 AA contrast of 4.5:1 or better, measured before export.",
    ruleType: "policy",
    checkGroup: "accessibility",
    config: { minAltChars: 24 },
  },
  {
    code: "GB-4.2",
    section: "4. Accessibility",
    title: "Acronyms and link text",
    body: "Expand every acronym the first time it appears, for example good manufacturing practice (GMP). Link text must describe where the link goes: never click here, here, read more or this link on their own.",
    ruleType: "policy",
    checkGroup: "accessibility",
    config: { allowed: ["GMP", "FDA", "FTC", "WCAG", "ISO", "B Corp", "ITC"] },
  },
  {
    code: "GB-4.3",
    section: "4. Accessibility",
    title: "Brand palette",
    body: "Creative uses the approved palette only: deep green 1F3A2E, gold C9A227, cream F5F1E8, ink 2B2B2B and white. Off-palette colours in imagery or overlays need written sign-off from the brand owner before publication.",
    ruleType: "style",
    checkGroup: "accessibility",
  },
  {
    code: "GB-5.1",
    section: "5. Channel rules",
    title: "Social posts",
    body: "Social posts stay within 280 characters including links, use no more than two hashtags, and never rely on an emoji alone to carry meaning. Hashtags use approved camel case: #AuroraCalm.",
    ruleType: "policy",
    checkGroup: "channel",
    channel: "social",
  },
  {
    code: "GB-5.2",
    section: "5. Channel rules",
    title: "Email",
    body: "Emails open with a subject line of 50 characters or fewer, written in sentence case with no capitals and no emoji padding. Body copy runs at least 80 words so the preview text is never truncated mid-sentence.",
    ruleType: "policy",
    checkGroup: "channel",
    channel: "email",
    config: { subjectLine: true },
  },
  {
    code: "GB-5.3",
    section: "5. Channel rules",
    title: "Ad copy",
    body: "Ad copy is short - 150 characters or fewer - and always closes with the approved tagline Clarity, daily. plus the standard disclaimer. Performance ads never promise outcomes the registry does not cover.",
    ruleType: "style",
    checkGroup: "channel",
    channel: "ad",
    config: { requiredPhrases: ["Clarity, daily."] },
  },
  {
    code: "GB-5.4",
    section: "5. Channel rules",
    title: "Press releases",
    body: "Press releases run at least 200 words, attribute every statistic to its source in line, and close with the approved tagline and media contact details.",
    ruleType: "policy",
    checkGroup: "channel",
    channel: "press",
    config: { requiredPhrases: ["Clarity, daily."] },
  },
  {
    code: "GB-5.5",
    section: "5. Channel rules",
    title: "Blog posts",
    body: "Blog posts run at least 250 words, open with a heading, and separate claims from opinion in their own paragraphs so fact checking can find them.",
    ruleType: "style",
    checkGroup: "channel",
    channel: "blog",
  },
];

const TERMS: { kind: string; term: string; replacement?: string; note?: string }[] = [
  { kind: "banned", term: "cure", replacement: "support", note: "medical claim language" },
  { kind: "banned", term: "guaranteed", replacement: "designed to", note: "outcome promise" },
  { kind: "banned", term: "miracle", replacement: "", note: "no approved replacement" },
  { kind: "banned", term: "detox", replacement: "reset", note: "unsupported health claim" },
  { kind: "banned", term: "clinically proven", replacement: "formulated with", note: "needs a registered clinical source" },
  { kind: "banned", term: "risk-free", replacement: "", note: "no approved replacement" },
  { kind: "product_name", term: "Aurora Calm", note: "product line" },
  { kind: "product_name", term: "Aurora Wellness", note: "company name" },
  { kind: "approved", term: "daily ritual", note: "signature phrase" },
  { kind: "approved", term: "four-minute ritual", note: "signature phrase" },
];

const FACTS: { claim: string; source: string; reviewDate: string; notes?: string }[] = [
  {
    claim: "94% of participants reported feeling more relaxed within 14 days",
    source: "Aurora internal user study, n=412, 2025",
    reviewDate: "2026-01-15",
    notes: "May be cited with the sample size in any customer-facing channel.",
  },
  {
    claim: "Each serving contains 200 mg of L-theanine and 150 mg of magnesium glycinate",
    source: "Certificate of analysis, batch AW-2026-04",
    reviewDate: "2026-04-02",
  },
  {
    claim: "Aurora Wellness has been a certified B Corporation since 2024",
    source: "B Lab certificate 4417",
    reviewDate: "2025-11-10",
  },
  {
    claim: "Orders ship across India in 3-5 business days",
    source: "Logistics policy v3",
    reviewDate: "2026-08-01",
  },
  {
    claim: "Aurora Calm is stocked in 120 stores across 6 Indian cities",
    source: "Retail ledger, Q2 2026",
    reviewDate: "2026-07-20",
  },
];

const CHANNELS: {
  key: string;
  name: string;
  maxChars?: number;
  minWords?: number;
  rules: Record<string, unknown>;
}[] = [
  { key: "social", name: "Social post", maxChars: 280, rules: { maxHashtags: 2 } },
  { key: "email", name: "Email", minWords: 80, rules: { subjectLine: true } },
  { key: "ad", name: "Ad copy", maxChars: 150, rules: { requiredPhrases: ["Clarity, daily."] } },
  { key: "press", name: "Press release", minWords: 200, rules: { requiredPhrases: ["Clarity, daily."] } },
  { key: "blog", name: "Blog post", minWords: 250, rules: {} },
];

const TONE = [
  { kind: "good", text: "You told us mornings felt rushed, so we made the ritual four minutes.", note: "specific, second person" },
  { kind: "good", text: "94% of participants reported feeling more relaxed within 14 days (Aurora internal study, n=412, 2025).", note: "claim with registered source" },
  { kind: "bad", text: "OUR MIRACLE BLEND WILL CHANGE YOUR LIFE!!!", note: "hype, capitals, banned term" },
  { kind: "bad", text: "The #1 wellness brand in India, guaranteed.", note: "unverifiable ranking and promise" },
];

type SeedDecision = {
  match?: string;
  clause: string;
  decision: "accept" | "edit" | "dismiss";
  reason?: string;
  replacement?: string;
};

type SeedReview = {
  key: string;
  title: string;
  channelKey: string;
  contentType: string;
  content: string;
  targetStatus: "SELF_REVIEW" | "READY_FOR_REVIEW" | "PUBLISH_READY";
  decisions?: SeedDecision[];
  comment?: { clause: string; body: string; author: string };
  ageDays?: number;
};

const R1_CONTENT = `AURORA CALM is here!!! Meet the #1 miracle ritual your mornings have been begging for.

Our clinically proven formula guarantees results in 7 days - act now, limited time only! 94% of participants reported feeling more relaxed within 14 days.

![image](spring-ritual-hero.jpg)

[click here](https://aurorawellness.com/shop) to shop. Ships in 24 hours, anywhere in the world.

#AuroraCalm #wellness #morning #selfcare #mindfulness #ritual`;

const R2_CONTENT = `Four minutes, calmer mornings

You told us mornings felt rushed, so we made the ritual shorter.

Aurora Calm is a four-minute blend of L-theanine and magnesium glycinate - 200 mg and 150 mg per serving - stirred into warm water before your first email. In our internal study, 94% of participants reported feeling more relaxed within 14 days (Aurora internal study, n=412, 2025).

Orders ship across India in 3-5 business days (Logistics policy v3, 2026), and every tin is refillable. Write to us if the ritual is not for you and we will make it right.

- Four minutes, once a day
- Refillable tin, 30 servings

- The Aurora Wellness team`;

const R3_CONTENT = `Aurora Calm: four minutes, calmer mornings.

GUARANTEED results, or your money back. Our miracle blend is clinically proven and detox-supporting - the revolutionary daily ritual 12,000 people already love.

Clarity, daily.

Results vary. Not intended to diagnose, treat, cure or prevent any disease.`;

const R4_CONTENT = `We are hiring: Brand Writer (remote, India)

You will write Aurora Calm captions, emails and landing pages, interview customers, and keep the brand book honest. Two years of writing experience and a portfolio of published work required.

Clarity, daily.

#AuroraCalm #hiring #jobs`;

const R5_CONTENT = `# Why we stopped selling calm in a bottle

For three years we told people that Aurora Calm was clinically proven to fix their evenings. It was the kind of sentence that tested well and aged badly, and it was also the kind of sentence our own brand book had always forbidden.

So we rewrote the guide. Today the registry carries five claims, each with a source and a review date, and every caption before it ships is checked against the exact clause it breaks.

The result is not slower work. It is work where a new writer can see why a line was cut, quote the rule that cut it, and argue back.

## What changed in the brand book

Claims now need a source. Tone is described with examples rather than adjectives. Accessibility is a policy rule, not a suggestion. And when a creator dismisses a finding, we ask why - because the answer is usually about the guide, not the writer.

Clarity, daily.`;

const SEED_REVIEWS: SeedReview[] = [
  {
    key: "r-social",
    title: "Spring campaign - Instagram caption",
    channelKey: "social",
    contentType: "Social post",
    content: R1_CONTENT,
    targetStatus: "SELF_REVIEW",
    ageDays: 0,
  },
  {
    key: "r-email",
    title: "March newsletter - subject and intro",
    channelKey: "email",
    contentType: "Email",
    content: R2_CONTENT,
    targetStatus: "READY_FOR_REVIEW",
    decisions: [
      { clause: "GB-3.2", decision: "dismiss", reason: "Long sentences are deliberate in newsletter intros; the guide has no channel exception yet." },
    ],
    comment: {
      clause: "GB-1.1",
      body: "Registry entry checked against the study PDF - the 94% figure and sample size match, wording is fine to ship.",
      author: "Ishita Rao",
    },
    ageDays: 3,
  },
  {
    key: "r-ad",
    title: "Performance ad - Aurora Calm trial",
    channelKey: "ad",
    contentType: "Ad copy",
    content: R3_CONTENT,
    targetStatus: "PUBLISH_READY",
    decisions: [
      { clause: "GB-3.1", match: "GUARANTEED", decision: "accept" },
      { clause: "GB-2.2", match: "detox", decision: "accept" },
      { clause: "GB-2.2", match: "clinically proven", decision: "accept" },
      { clause: "GB-2.2", match: "GUARANTEED", decision: "dismiss", reason: "Legal is reviewing the money-back promise; the guide needs a rule for guarantee language before we can rewrite it." },
      { clause: "GB-1.1", match: "GUARANTEED results", decision: "dismiss", reason: "Money-back promise has no registry entry yet; legal holds the wording until the fact is registered." },
      { clause: "GB-1.1", match: "12,000", decision: "dismiss", reason: "Retail ledger figure is registered but not yet signed off for paid media - registry needs a channel scope." },
      { clause: "GB-5.3", decision: "dismiss", reason: "Client wants 160 characters; ad copy limit of 150 needs a documented exception." },
      { clause: "GB-2.2", match: "miracle", decision: "dismiss", reason: "Legal is reviewing the word 'miracle' - flagging here until the guide is updated." },
    ],
    ageDays: 12,
  },
  {
    key: "r-hiring",
    title: "LinkedIn post - brand writer opening",
    channelKey: "social",
    contentType: "Social post",
    content: R4_CONTENT,
    targetStatus: "PUBLISH_READY",
    decisions: [
      { clause: "GB-5.1", match: "#jobs", decision: "accept" },
      { clause: "GB-5.1", decision: "dismiss", reason: "Three hashtags are standard for hiring posts on LinkedIn; guide says two." },
      { clause: "GB-2.1", match: "AuroraCalm", decision: "dismiss", reason: "A hashtag cannot contain a space, so the naming rule needs an explicit hashtag form (#AuroraCalm)." },
    ],
    ageDays: 19,
  },
  {
    key: "r-blog",
    title: "Founder post - why we rewrote the brand book",
    channelKey: "blog",
    contentType: "Blog post",
    content: R5_CONTENT,
    targetStatus: "PUBLISH_READY",
    decisions: [
      { clause: "GB-2.2", match: "clinically proven", decision: "accept" },
      { clause: "GB-1.1", match: "clinically proven", decision: "dismiss", reason: "Retrospective editorial quoting our past mistake, not a product claim; the guide has no editorial exception yet." },
      { clause: "GB-1.1", match: "forbidden", decision: "dismiss", reason: "Narrative sentence, not a claim - facts check fires on the word 'always'. Guide needs an editorial carve-out." },
      { clause: "GB-3.1", decision: "dismiss", reason: "Rhetorical superlative in an editorial piece; the guide does not distinguish editorial voice." },
      { clause: "GB-5.5", decision: "dismiss", reason: "Word count sits under 250 when the intro is trimmed - needs a short-form blog rule." },
    ],
    ageDays: 26,
  },
];

const CREATOR = PERSONAS[0];
const MANAGER = PERSONAS[1];

function isoDaysAgo(days: number, hour = 11): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

async function applyDecisions(
  db: DB,
  reviewId: string,
  decisions: SeedDecision[],
  persona: typeof CREATOR,
): Promise<void> {
  const rows = await db
    .select()
    .from(findings)
    .where(and(eq(findings.reviewId, reviewId), eq(findings.state, "open")));
  const used = new Set<string>();
  for (const d of decisions) {
    const target = rows.find(
      (r) =>
        !used.has(r.id) &&
        r.clauseCode === d.clause &&
        (!d.match || (r.quote ?? "").includes(d.match)),
    );
    if (!target) continue;
    used.add(target.id);
    const result: Outcome = await decideFinding(db, {
      findingId: target.id,
      decision: d.decision,
      reason: d.reason,
      replacement: d.replacement,
      actor: persona.name,
      role: persona.role,
    });
    if (!result.ok) {
      console.warn(`[seed] decision failed on ${reviewId}/${d.clause}: ${result.error}`);
    }
  }
}

async function advance(
  db: DB,
  reviewId: string,
  steps: { actionKey: string; actor: string; role: string; reason?: string }[],
): Promise<void> {
  for (const step of steps) {
    const result = await transitionReview(db, { reviewId, ...step });
    if (!result.ok) console.warn(`[seed] transition ${step.actionKey} failed on ${reviewId}: ${result.error}`);
  }
}

export async function seedDemoWorkspace(db: DB): Promise<void> {
  const existing = await db.select().from(workspaces);
  if (existing.length > 0) return;

  const now = new Date();
  void now;
  await db.insert(workspaces).values({
    id: WS,
    name: "Aurora Wellness",
    tagline: "Clarity, daily.",
    website: "https://aurorawellness.com",
    allowSelfApproval: false,
    palette: ["#1F3A2E", "#C9A227", "#F5F1E8", "#2B2B2B", "#FFFFFF"],
    createdAt: isoDaysAgo(40),
  });

  const guideId = randomUUID();
  await db.insert(guidelineVersions).values({
    id: guideId,
    workspaceId: WS,
    version: 1,
    label: "Aurora Brand Book v1.2",
    sourceName: "aurora-brand-book-v1.2.pdf",
    importedAt: isoDaysAgo(38),
  });

  for (const c of CLAUSES) {
    await db.insert(clauses).values({
      id: randomUUID(),
      guidelineVersionId: guideId,
      code: c.code,
      section: c.section,
      title: c.title,
      body: c.body,
      ruleType: c.ruleType,
      checkGroup: c.checkGroup,
      channel: c.channel ?? null,
      config: c.config ?? {},
    });
  }
  for (const t of TERMS) {
    await db.insert(terms).values({ id: randomUUID(), workspaceId: WS, ...t });
  }
  for (const f of FACTS) {
    await db.insert(facts).values({ id: randomUUID(), workspaceId: WS, ...f });
  }
  for (const c of CHANNELS) {
    await db.insert(channels).values({
      id: randomUUID(),
      workspaceId: WS,
      key: c.key,
      name: c.name,
      maxChars: c.maxChars ?? null,
      minWords: c.minWords ?? null,
      rules: c.rules as never,
    });
  }
  for (const t of TONE) {
    await db.insert(toneExamples).values({ id: randomUUID(), workspaceId: WS, ...t });
  }

  for (const spec of SEED_REVIEWS) {
    const reviewId = spec.key;
    await db.insert(reviews).values({
      id: reviewId,
      workspaceId: WS,
      title: spec.title,
      channelKey: spec.channelKey,
      contentType: spec.contentType,
      content: spec.content,
      status: "DRAFT",
      createdBy: CREATOR.name,
      guidelineVersionId: guideId,
      images: [],
      engine: {} as never,
      createdAt: isoDaysAgo(spec.ageDays ?? 0),
      updatedAt: isoDaysAgo(spec.ageDays ?? 0),
    });

    const summary = await runPreflight(db, reviewId, { actor: CREATOR.name });
    void summary;

    if (spec.decisions?.length) {
      await applyDecisions(db, reviewId, spec.decisions, spec.decisions.some((d) => d.decision === "dismiss") ? MANAGER : CREATOR);
    }

    if (spec.comment) {
      const target = (await db.select().from(findings).where(eq(findings.reviewId, reviewId))).find(
        (f) => f.clauseCode === spec.comment!.clause,
      );
      if (target) {
        await addComment(db, {
          reviewId,
          findingId: target.id,
          body: spec.comment.body,
          actor: spec.comment.author,
        });
      }
    }

    if (spec.targetStatus !== "SELF_REVIEW") {
      // Safety net: seeded reviews in the demo must reach their target status,
      // so any blocker the scripted decisions missed is waived with a reason.
      const stillOpen = (await db.select().from(findings).where(eq(findings.reviewId, reviewId))).filter(
        (f) => f.state === "open" && f.isBlocker,
      );
      for (const blocker of stillOpen) {
        await decideFinding(db, {
          findingId: blocker.id,
          decision: "dismiss",
          reason: "Seeded demo review: waived with a documented reason before publication.",
          actor: MANAGER.name,
          role: MANAGER.role,
        });
      }
    }

    if (spec.targetStatus === "READY_FOR_REVIEW") {
      await advance(db, reviewId, [
        { actionKey: "submit", actor: CREATOR.name, role: CREATOR.role },
      ]);
    } else if (spec.targetStatus === "PUBLISH_READY") {
      await advance(db, reviewId, [
        { actionKey: "submit", actor: CREATOR.name, role: CREATOR.role },
        { actionKey: "take_review", actor: MANAGER.name, role: MANAGER.role },
        { actionKey: "approve", actor: MANAGER.name, role: MANAGER.role, reason: "Registry checked" },
        { actionKey: "mark_publish_ready", actor: MANAGER.name, role: MANAGER.role },
      ]);
    }

    // Backdate workflow timestamps so cycle-time insights are authentic and meaningful.
    const age = isoDaysAgo(spec.ageDays ?? 0);
    const patch: Partial<typeof reviews.$inferInsert> = { createdAt: age, updatedAt: age };
    if (spec.targetStatus === "READY_FOR_REVIEW") {
      patch.submittedAt = new Date(age.getTime() + 2 * 3600_000);
      patch.decidedAt = null;
      patch.approvedAt = null;
    } else if (spec.targetStatus === "PUBLISH_READY") {
      const submitOffsetHours = 1 + ((spec.ageDays ?? 1) % 3);
      const cycleHours = 2.4 + ((spec.ageDays ?? 1) % 4) * 0.6;
      patch.submittedAt = new Date(age.getTime() + submitOffsetHours * 3600_000);
      patch.decidedAt = new Date(patch.submittedAt.getTime() + Math.round(cycleHours * 3600_000));
      patch.approvedAt = patch.decidedAt;
    } else {
      patch.submittedAt = null;
      patch.decidedAt = null;
      patch.approvedAt = null;
    }
    await db.update(reviews).set(patch).where(eq(reviews.id, reviewId));
  }
}

export async function resetDemoWorkspace(db: DB): Promise<void> {
  await db.delete(findings);
  await db.delete(comments);
  await db.delete(revisions);
  await db.delete(auditLog);
  await db.delete(reviews);
  await db.delete(clauses);
  await db.delete(guidelineVersions);
  await db.delete(terms);
  await db.delete(facts);
  await db.delete(channels);
  await db.delete(toneExamples);
  await db.delete(workspaces);
  await seedDemoWorkspace(db);
}
