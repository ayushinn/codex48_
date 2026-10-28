import type { Clause, Fact, Term, Channel } from "@/lib/db/schema";
import type { Block } from "./text";
import { gradeLevel, toBlocks, tokenize } from "./text";

/**
 * Deterministic check groups.
 *
 * Every check produces a *candidate* finding that points at a clause code from
 * the workspace's own guideline (retrieval-first scoping: a check may only run
 * when its clause is in scope, and a candidate that names a clause we could not
 * retrieve is dropped by the verifier). Severity is derived from the clause's
 * rule type - policy -> blocker, style -> warn, preference -> info - never from
 * a model's mood.
 */

export type Candidate = {
  checkGroup: string;
  clauseCode: string;
  why: string;
  /** Verbatim span from the draft. Required unless `anchor` is "append". */
  quote?: string;
  /** Replacement text for `quote`. Empty string deletes the span. */
  suggestion?: string;
  /** "quote" replaces a span; "append" adds the suggestion to the end. */
  anchor?: "quote" | "append";
  confidence?: "high" | "medium" | "low";
  source?: "rules" | "llm";
};

export type ImageMeta = {
  id: string;
  name: string;
  alt?: string;
  palette?: string[];
  contrastRatio?: number;
};

export type Ctx = {
  content: string;
  blocks: Block[];
  channel: Channel;
  clauses: Clause[];
  terms: Term[];
  facts: Fact[];
  toneExamples: { kind: string; text: string }[];
  images: ImageMeta[];
  palette: string[];
  /** Spans of required verbatim phrases (disclaimers, taglines): protected from other checks. */
  protectedSpans: { start: number; end: number }[];
};

const STOP = new Set(
  "a an the and or of to in for with on at by is are was were be been this that it its as from into you your we our not no than then them they he she i".split(
    " ",
  ),
);

export function buildCtx(args: {
  content: string;
  channel: Channel;
  clauses: Clause[];
  terms: Term[];
  facts: Fact[];
  toneExamples: { kind: string; text: string }[];
  images: ImageMeta[];
  palette: string[];
}): Ctx {
  // Required verbatim phrases (e.g. the advertising disclaimer) are quoted
  // straight from the guide, so other checks must not flag words inside them.
  const requiredPhrases = [
    ...args.clauses.flatMap((c) => ((c.config as { requiredPhrases?: string[] }).requiredPhrases ?? [])),
    ...(((args.channel.rules as { requiredPhrases?: string[] }).requiredPhrases) ?? []),
  ].filter(Boolean);
  const protectedSpans: { start: number; end: number }[] = [];
  for (const phrase of requiredPhrases) {
    const re = new RegExp(escapeRe(phrase), "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(args.content))) {
      protectedSpans.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return { ...args, blocks: toBlocks(args.content), protectedSpans };
}

function isProtected(ctx: Ctx, start: number, end: number): boolean {
  return ctx.protectedSpans.some((s) => start >= s.start && end <= s.end);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findClause(ctx: Ctx, code: string): Clause | undefined {
  return ctx.clauses.find((c) => c.code === code);
}

/**
 * Resolve the clause a check runs against.
 *
 * Prefers the exact clause code (the seeded demo guide fixes these), then
 * falls back to the first in-scope clause of the check's own group. The
 * fallback is what makes a pasted, imported guideline work: its clauses are
 * auto-coded (GB-1-3, ...) but classified into the same six check groups, so a
 * judge's own brand book still drives every check instead of silently
 * returning nothing.
 */
function resolveClause(ctx: Ctx, group: string | string[], ...codes: string[]): Clause | undefined {
  for (const code of codes) {
    const hit = findClause(ctx, code);
    if (hit) return hit;
  }
  for (const g of Array.isArray(group) ? group : [group]) {
    const hit = ctx.clauses.find((c) => c.checkGroup === g);
    if (hit) return hit;
  }
  return undefined;
}

function sentencesOf(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const s = m[0].trim();
    if (s.length > 1) out.push({ text: s, start: m.index + (m[0].indexOf(s) as number) });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 1. Terminology
 * ------------------------------------------------------------------ */
function checkTerminology(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  const clause = resolveClause(ctx, "terminology", "GB-2.1", "GB-2.2");
  const fallback = resolveClause(ctx, "terminology", "GB-2.2");

  // Banned terms (each entry may carry its approved replacement)
  for (const term of ctx.terms.filter((t) => t.kind === "banned")) {
    if (!fallback) break;
    const re = new RegExp(`\\b${escapeRe(term.term)}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(ctx.content))) {
      const matched = m[0];
      if (isProtected(ctx, m.index, m.index + matched.length)) {
        if (m.index === re.lastIndex) re.lastIndex++;
        continue; // inside a required verbatim phrase (disclaimer, tagline)
      }
      out.push({
        checkGroup: "terminology",
        clauseCode: fallback.code,
        why: term.replacement
          ? `"${matched}" is on the banned-terms list. The approved wording is "${term.replacement}"${term.note ? ` (${term.note})` : ""}.`
          : `"${matched}" is on the banned-terms list and has no approved replacement${term.note ? ` (${term.note})` : ""}. Remove it or rephrase.`,
        quote: matched,
        suggestion: term.replacement ?? "",
        confidence: "high",
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  // Product / company naming: right words, wrong spelling or casing
  for (const term of ctx.terms.filter((t) => t.kind === "product_name")) {
    if (!clause) break;
    const spaced = term.term.split(/\s+/).map(escapeRe).join("[\\s-]+");
    const spacedRe = new RegExp(spaced, "i");
    const spacedHit = spacedRe.exec(ctx.content);
    const compactHit = new RegExp(escapeRe(term.term.replace(/\s+/g, "")), "i").exec(ctx.content);
    if (spacedHit && spacedHit[0] !== term.term && !isProtected(ctx, spacedHit.index, spacedHit.index + spacedHit[0].length)) {
      out.push({
        checkGroup: "terminology",
        clauseCode: clause.code,
        why: `"${spacedHit[0]}" breaks the approved spelling of the name. The guide fixes it as "${term.term}".`,
        quote: spacedHit[0],
        suggestion: term.term,
        confidence: "high",
      });
    } else if (compactHit && !isProtected(ctx, compactHit.index, compactHit.index + compactHit[0].length)) {
      out.push({
        checkGroup: "terminology",
        clauseCode: clause.code,
        why: `"${compactHit[0]}" collapses the name into one word. The approved spelling is "${term.term}".`,
        quote: compactHit[0],
        suggestion: term.term,
        confidence: "high",
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 2. Facts and unsupported promotional claims
 * ------------------------------------------------------------------ */
const CLAIM_RE =
  /\b(\d+(\.\d+)?\s*%|#\s?\d+|number one|guarantee\w*|clinically proven|proven\b|cures?\b|always\b|100\s?%|free\b|instantly|doctors recommend\w*|studies show|research shows|world'?s (best|first)|no\.?\s?1)\b/i;

function claimScore(a: string, b: string): number {
  const ta = tokenize(a).filter((t) => !STOP.has(t) && t.length > 2);
  const tb = new Set(tokenize(b).filter((t) => !STOP.has(t) && t.length > 2));
  if (ta.length === 0) return 0;
  const hits = ta.filter((t) => tb.has(t)).length;
  return hits / ta.length;
}

function checkFacts(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  const clause = resolveClause(ctx, "facts", "GB-1.1");
  if (!clause) return out;

  for (const s of sentencesOf(ctx.content)) {
    if (!CLAIM_RE.test(s.text)) continue;
    if (isProtected(ctx, s.start, s.start + s.text.length)) continue; // verbatim disclaimer / required phrase
    let best: { fact: Fact; score: number } | null = null;
    for (const fact of ctx.facts) {
      const score = claimScore(s.text, fact.claim);
      if (!best || score > best.score) best = { fact, score };
    }
    if (best && best.score >= 0.45) {
      const alreadyCited = /\([^)]*\b(19|20)\d{2}\b[^)]*\)/.test(s.text);
      if (alreadyCited) continue; // claim matched a registered fact and carries its source
      out.push({
        checkGroup: "facts",
        clauseCode: clause.code,
        why: `Claim matched an approved fact in the registry: "${best.fact.claim}" (source: ${best.fact.source}, reviewed ${best.fact.reviewDate}). Add the source so a reader can check it.`,
        quote: s.text,
        suggestion: `${s.text} (${best.fact.source.split(",")[0]}, ${best.fact.reviewDate.slice(0, 4)})`,
        confidence: best.score >= 0.6 ? "high" : "medium",
      });
    } else {
      out.push({
        checkGroup: "facts",
        clauseCode: clause.code,
        why: `This reads as a factual or promotional claim, but nothing in the Approved Facts Registry matches it. Policy ${clause.code} requires every outcome claim to carry a registered source before publication.`,
        quote: s.text,
        suggestion: "",
        confidence: "medium",
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 3. Tone
 * ------------------------------------------------------------------ */
function checkTone(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  const style = resolveClause(ctx, "tone", "GB-3.1");
  const config = (style?.config ?? {}) as { bannedPhrases?: string[]; maxExclamations?: number };

  if (style) {
    for (const phrase of config.bannedPhrases ?? []) {
      const re = new RegExp(`\\b${escapeRe(phrase)}\\b`, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(ctx.content))) {
        if (isProtected(ctx, m.index, m.index + m[0].length)) continue;
        out.push({
          checkGroup: "tone",
          clauseCode: style.code,
          why: `Hype language: "${m[0]}" conflicts with the calm, specific tone the brand book asks for in ${style.code}.`,
          quote: m[0],
          suggestion: "",
          confidence: "high",
        });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }

    // Superlatives and urgency theatre
    const patterns: { re: RegExp; label: string }[] = [
      { re: /#\s?\d+\b/gi, label: "unsubstantiated #1 ranking" },
      { re: /\b(number one|no\.?\s?1|best[- ]selling|top[- ]rated|world'?s (best|first|most)|leading|unmatched)\b/gi, label: "superlative" },
      { re: /\b(limited[- ]time|act now|hurry|don'?t wait|last chance|now or never|only \d+ (left|days?))\b/gi, label: "urgency theatre" },
    ];
    for (const { re, label } of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(ctx.content))) {
        if (isProtected(ctx, m.index, m.index + m[0].length)) continue;
        out.push({
          checkGroup: "tone",
          clauseCode: style.code,
          why: `${label.charAt(0).toUpperCase() + label.slice(1)} in copy. ${style.title} asks for specific, verifiable statements instead.`,
          quote: m[0],
          suggestion: "",
          confidence: "high",
        });
      }
    }
  }

  // Exclamation marks
  const maxExcl = typeof config.maxExclamations === "number" ? config.maxExclamations : 1;
  const exclCount = (ctx.content.match(/!/g) ?? []).length;
  if (style && exclCount > maxExcl) {
    const sents = sentencesOf(ctx.content);
    const worst = sents.reduce(
      (acc, s) => {
        const n = (s.text.match(/!/g) ?? []).length;
        return n > acc.n ? { s, n } : acc;
      },
      { s: sents[0], n: 0 },
    );
    if (worst.s) {
      const cleaned = worst.s.text.replace(/!(\s*!)+/g, "!").replace(/!+$/, "");
      out.push({
        checkGroup: "tone",
        clauseCode: style.code,
        why: `Exclamation marks: ${exclCount} in this piece; the guide allows ${maxExcl}.`,
        quote: worst.s.text,
        suggestion: cleaned.trimEnd(),
        confidence: "high",
      });
    }
  }

  // ALL-CAPS emphasis (excluding approved brand spellings)
  const brandWords = ctx.terms
    .filter((t) => t.kind === "product_name" || t.kind === "approved")
    .flatMap((t) => t.term.split(/\s+/));
  const capsRe = /\b[A-Z]{4,}\b/g;
  let cm: RegExpExecArray | null;
  while ((cm = capsRe.exec(ctx.content))) {
    const word = cm[0];
    if (isProtected(ctx, cm.index, cm.index + word.length)) continue;
    if (brandWords.some((b) => b.toUpperCase() === word)) continue;
    if (!style) break;
    out.push({
      checkGroup: "tone",
      clauseCode: style.code,
      why: `"${word}" is set in full capitals, which reads as shouting in body copy.`,
      quote: word,
      suggestion: word.charAt(0) + word.slice(1).toLowerCase(),
      confidence: "medium",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 4. Messaging alignment (required elements, link text)
 * ------------------------------------------------------------------ */
function checkMessaging(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];

  // Required elements declared by any in-scope clause (e.g. the ad disclaimer).
  for (const clause of ctx.clauses) {
    const phrases = ((clause.config as { requiredPhrases?: string[] }).requiredPhrases ?? []).filter(Boolean);
    for (const phrase of phrases) {
      if (ctx.content.toLowerCase().includes(phrase.toLowerCase())) continue;
      out.push({
        checkGroup: "messaging",
        clauseCode: clause.code,
        why: `Required element missing: ${clause.code} asks for "${phrase}" in this kind of content and it does not appear in the draft.`,
        anchor: "append",
        suggestion: phrase,
        confidence: "high",
      });
    }
  }

  // Channel-level required elements are cited to the channel clause itself.
  const channelClause = ctx.clauses.find((c) => c.checkGroup === "channel");
  for (const phrase of ctx.channel.rules.requiredPhrases ?? []) {
    if (!phrase || ctx.content.toLowerCase().includes(phrase.toLowerCase())) continue;
    if (!channelClause) break;
    out.push({
      checkGroup: "messaging",
      clauseCode: channelClause.code,
      why: `${channelClause.code} requires ${ctx.channel.name} content to close with "${phrase}"; it is missing.`,
      anchor: "append",
      suggestion: phrase,
      confidence: "high",
    });
  }

  // Vague link text
  const linkRe = /\[([^\]]{1,60})\]\(([^)]+)\)/g;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(ctx.content))) {
    const text = lm[1];
    if (!/^(click here|here|read more|this link|link|more)$/i.test(text.trim())) continue;
    const clause = resolveClause(ctx, ["messaging", "accessibility"], "GB-4.2");
    if (!clause) break;
    out.push({
      checkGroup: "messaging",
      clauseCode: clause.code,
      why: `Link text "${text}" tells a reader nothing about where the link goes, which ${clause.code} prohibits.`,
      quote: `[${text}](${lm[2]})`,
      suggestion: /\b(shop|buy|store|product)\b/i.test(lm[2])
        ? `[Shop Aurora Calm](${lm[2]})`
        : undefined,
      confidence: "high",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 5. Accessibility (text + visual metadata supplied at intake)
 * ------------------------------------------------------------------ */
const VAGUE_ALT = /^(image|photo|picture|img|screenshot|banner|logo|graphic|visual)$/i;
const DEFAULT_ACRONYMS = ["FDA", "FTC", "WCAG", "GMP", "ISO", "DTC", "B2B", "B2C", "CTA", "SEO", "UGC", "AI"];

function altFromFilename(src: string): string | undefined {
  const base = (src.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "");
  const words = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words || /\d{6,}/.test(words)) return undefined;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function checkAccessibility(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  const altClause = resolveClause(ctx, "accessibility", "GB-4.1");
  const acrClause = resolveClause(ctx, "accessibility", "GB-4.2");
  const minAlt = ((altClause?.config as { minAltChars?: number })?.minAltChars ?? 20) as number;

  // Images referenced in the draft
  for (const block of ctx.blocks) {
    if (block.kind !== "image" || !altClause) continue;
    const alt = (block.alt ?? "").trim();
    const problem = !alt
      ? "has no alt text at all"
      : VAGUE_ALT.test(alt)
        ? `uses the non-descriptive alt text "${alt}"`
        : alt.length < minAlt
          ? `has alt text of only ${alt.length} characters, the guide requires at least ${minAlt}`
          : null;
    if (!problem) continue;
    const proposed = altFromFilename(block.src ?? "");
    out.push({
      checkGroup: "accessibility",
      clauseCode: altClause.code,
      why: `The image ${problem}. ${altClause.code} requires alt text of at least ${minAlt} characters describing the image's content.`,
      quote: block.text,
      suggestion: proposed ? block.text.replace(/^!\[[^\]]*\]/, `![${proposed}]`) : undefined,
      confidence: "high",
    });
  }

  // Images attached at intake: alt text is checked through the draft's own
  // image references; the browser-supplied metadata adds contrast + palette.
  for (const image of ctx.images) {
    if (!altClause) break;
    const alt = (image.alt ?? "").trim();
    void alt;
    if (typeof image.contrastRatio === "number" && image.contrastRatio < 4.5) {
      out.push({
        checkGroup: "accessibility",
        clauseCode: altClause.code,
        why: `Measured contrast inside "${image.name}" is ${image.contrastRatio.toFixed(2)}:1 between its dominant light and dark tones. ${altClause.code} requires 4.5:1 for WCAG AA.`,
        quote: image.name,
        suggestion: undefined,
        confidence: "medium",
      });
    }
    if (image.palette?.length && ctx.palette.length) {
      const off = image.palette.filter((c) => nearestDistance(c, ctx.palette) > 60);
      if (off.length) {          const paletteClause = resolveClause(ctx, "accessibility", "GB-4.3");
        if (paletteClause) {
          out.push({
            checkGroup: "accessibility",
            clauseCode: paletteClause.code,
            why: `"${image.name}" uses ${off.length} colour${off.length > 1 ? "s" : ""} outside the approved palette (${off.slice(0, 4).join(", ")}).`,
            quote: image.name,
            suggestion: undefined,
            confidence: "low",
          });
        }
      }
    }
  }

  // Acronyms must be expanded on first use
  if (acrClause) {
    const allowed = new Set(
      (((acrClause.config as { allowed?: string[] }).allowed ?? DEFAULT_ACRONYMS) as string[]).map((a) => a.toUpperCase()),
    );
    const brandWords = ctx.terms.map((t) => t.term.toUpperCase());
    const seen = new Set<string>();
    const acrRe = /\b[A-Z]{2,6}\b/g;
    let m: RegExpExecArray | null;
    while ((m = acrRe.exec(ctx.content))) {
      const acr = m[0];
      if (allowed.has(acr) || seen.has(acr) || brandWords.some((b) => b.includes(acr))) continue;
      seen.add(acr);
      out.push({
        checkGroup: "accessibility",
        clauseCode: acrClause.code,
        why: `"${acr}" appears without being expanded. ${acrClause.code} asks for the full form on first use, e.g. "good manufacturing practice (GMP)".`,
        quote: acr,
        suggestion: undefined,
        confidence: "medium",
      });
    }
  }

  return out;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function nearestDistance(a: string, palette: string[]): number {
  const ca = hexToRgb(a);
  if (!ca) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const p of palette) {
    const cb = hexToRgb(p);
    if (!cb) continue;
    const d = Math.sqrt((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2 + (ca[2] - cb[2]) ** 2);
    best = Math.min(best, d);
  }
  return best === Number.POSITIVE_INFINITY ? 0 : best;
}

/* ------------------------------------------------------------------ *
 * 6. Channel rules
 * ------------------------------------------------------------------ */
function checkChannel(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  const clause =
    ctx.clauses.find((c) => c.checkGroup === "channel") ??
    ctx.clauses.find((c) => c.code === "GB-5.1");
  if (!clause) return out;
  const { maxHashtags, subjectLine } = ctx.channel.rules as Record<string, unknown>;
  const content = ctx.content;
  const words = content.match(/\S+/g) ?? [];

  if (ctx.channel.maxChars && content.length > ctx.channel.maxChars) {
    // Anchor the finding on the overflowing tail so the creator can see where to cut.
    const trimmed = content.slice(0, ctx.channel.maxChars);
    const lastBreak = Math.max(trimmed.lastIndexOf("\n"), trimmed.lastIndexOf(" "));
    const cutAt = lastBreak > ctx.channel.maxChars * 0.6 ? lastBreak : ctx.channel.maxChars;
    out.push({
      checkGroup: "channel",
      clauseCode: clause.code,
      why: `This ${ctx.channel.name} is ${content.length} characters; the channel limit is ${ctx.channel.maxChars}. Cut the highlighted tail.`,
      quote: content.slice(cutAt),
      suggestion: "",
      confidence: "high",
    });
  }

  if (ctx.channel.minWords && words.length < ctx.channel.minWords) {
    out.push({
      checkGroup: "channel",
      clauseCode: clause.code,
      why: `Only ${words.length} words; ${ctx.channel.name} expects at least ${ctx.channel.minWords}.`,
      anchor: "append",
      suggestion: undefined,
      confidence: "medium",
    });
  }

  if (typeof maxHashtags === "number") {
    const tags = [...content.matchAll(/#[\p{L}\p{N}_]+/gu)];
    if (tags.length > maxHashtags) {
      const extra = tags[maxHashtags];
      out.push({
        checkGroup: "channel",
        clauseCode: clause.code,
        why: `${tags.length} hashtags in one post; the channel rule allows ${maxHashtags}.`,
        quote: extra[0],
        suggestion: "",
        confidence: "high",
      });
    }
  }

  if (subjectLine) {
    const firstLine = (content.split("\n")[0] ?? "").trim();
    if (firstLine.length > 50) {
      out.push({
        checkGroup: "channel",
        clauseCode: clause.code,
        why: `Subject line is ${firstLine.length} characters; the guide caps email subjects at 50 so they are not truncated in the inbox.`,
        quote: firstLine,
        suggestion: firstLine.slice(0, 47).trimEnd() + "…",
        confidence: "high",
      });
    }
    if (firstLine === firstLine.toUpperCase() && /[A-Z]{4}/.test(firstLine)) {
      out.push({
        checkGroup: "channel",
        clauseCode: clause.code,
        why: "Subject line is written in capitals, which reads as shouting and triggers spam filters.",
        quote: firstLine,
        suggestion: firstLine.charAt(0).toUpperCase() + firstLine.slice(1).toLowerCase(),
        confidence: "medium",
      });
    }
  }

  if (ctx.channel.minWords && words.length >= ctx.channel.minWords) {
    const grade = gradeLevel(content);
    const toneClause = resolveClause(ctx, "tone", "GB-3.2");
    const maxGrade = ((toneClause?.config as { maxGrade?: number })?.maxGrade ?? 10) as number;
    if (toneClause && grade > maxGrade) {
      out.push({
        checkGroup: "messaging",
        clauseCode: toneClause.code,
        why: `Readability is roughly grade ${grade}; ${toneClause.code} asks for plain language at grade ${maxGrade} or below.`,
        anchor: "append",
        suggestion: undefined,
        confidence: "low",
      });
    }
  }

  return out;
}

export function runRuleChecks(ctx: Ctx): Candidate[] {
  const candidates = [
    ...checkTerminology(ctx),
    ...checkFacts(ctx),
    ...checkTone(ctx),
    ...checkMessaging(ctx),
    ...checkAccessibility(ctx),
    ...checkChannel(ctx),
  ];
  // De-duplicate identical (clause, quote) candidates
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.clauseCode}::${(c.quote ?? "append").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


