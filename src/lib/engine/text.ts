/**
 * Text utilities for the review engine and the deterministic citation verifier.
 *
 * The verifier's job is pure code: prove that a quoted span actually exists in
 * the source (the draft, or the guideline clause) before a finding is shown.
 */

export type Span = { start: number; end: number };

const SMART_QUOTES: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u00a0": " ",
  "\u200b": "",
};

export function clean(input: string): string {
  let out = "";
  for (const ch of input) out += SMART_QUOTES[ch] ?? ch;
  return out;
}

/**
 * Normalise for comparison: lower case, unified quotes, collapsed whitespace.
 * Diacritics are kept; comparison targets come from the same source material.
 */
export function normalize(input: string): string {
  return clean(input)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a normalized view of `source` that keeps a map back to original
 * indices, so a located normalized offset can be reported as a real span in
 * the text the user sees.
 */
export function normalizedWithMap(source: string): { text: string; map: number[] } {
  const cleaned = clean(source);
  let text = "";
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const lower = ch.toLowerCase();
    const isSpace = /\s/.test(ch);
    if (isSpace) {
      if (lastWasSpace) continue;
      text += " ";
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    const mapped = SMART_QUOTES[ch];
    if (mapped === "") continue; // dropped characters have no normalized output
    text += lower;
    map.push(i);
    lastWasSpace = false;
  }
  return { text: text.trimEnd(), map };
}

/**
 * Locate a quoted span inside a source string.
 * Returns null when the quote cannot be found even after normalisation, which
 * is exactly what the citation verifier needs to reject a finding.
 */
export function locateSpan(source: string, quote: string): Span | null {
  const q = normalize(quote);
  if (!q) return null;

  const { text, map } = normalizedWithMap(source);
  const at = text.indexOf(q);
  if (at >= 0) {
    const start = map[at];
    const last = map[at + q.length - 1];
    const end = last === undefined ? source.length : last + 1;
    return { start, end };
  }
  return null;
}

/** Token-based Dice similarity, used as the fuzzy floor for LLM-supplied quotes. */
export function similarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 && tb.length === 0) return 1;
  if (ta.length === 0 || tb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of ta) counts.set(t, (counts.get(t) ?? 0) + 1);
  let hits = 0;
  for (const t of tb) {
    const n = counts.get(t) ?? 0;
    if (n > 0) {
      hits++;
      counts.set(t, n - 1);
    }
  }
  return (2 * hits) / (ta.length + tb.length);
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .replace(/[^\p{L}\p{N}'%#.-]+/gu, " ")
    .split(" ")
    .filter(Boolean);
}

/**
 * Fuzzy location: slide a window over the source at roughly the quote's length
 * and keep the best token overlap. Returns the span only above the floor.
 */
export function locateSpanFuzzy(source: string, quote: string, floor = 0.8): Span | null {
  const exact = locateSpan(source, quote);
  if (exact) return exact;
  const q = normalize(quote);
  if (q.length < 8) return null;
  const { text, map } = normalizedWithMap(source);
  const windowSize = Math.round(q.length * 1.2);
  if (windowSize < 8) return null;
  let best: { score: number; start: number; end: number } | null = null;
  const step = Math.max(4, Math.floor(windowSize / 3));
  for (let i = 0; i < text.length; i += step) {
    const window = text.slice(i, i + windowSize);
    if (window.length < Math.min(q.length, 8)) break;
    const score = similarity(window, q);
    if (!best || score > best.score) {
      const lastIdx = Math.min(i + window.length, map.length) - 1;
      best = { score, start: map[i], end: map[lastIdx] + 1 };
    }
  }
  if (best && best.score >= floor) return { start: best.start, end: best.end };
  return null;
}

/** Word-level LCS diff between an original span and its suggested replacement. */
export function wordDiff(before: string, after: string): { op: "keep" | "del" | "ins"; text: string }[] {
  const a = before.match(/\S+\s*|\s+/g) ?? [];
  const b = after.match(/\S+\s*|\s+/g) ?? [];
  const n = a.length;
  const m = b.length;
  // LCS table (bounded: spans are short, sentence-level at most)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].trim() === b[j].trim() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { op: "keep" | "del" | "ins"; text: string }[] = [];
  let i = 0;
  let j = 0;
  const push = (op: "keep" | "del" | "ins", text: string) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ op, text });
  };
  while (i < n && j < m) {
    if (a[i].trim() === b[j].trim()) {
      push("keep", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", a[i]);
      i++;
    } else {
      push("ins", b[j]);
      j++;
    }
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("ins", b[j++]);
  return out;
}

/** Split into paragraphs/headings/list items and markdown image references. */
export type Block = { kind: "heading" | "paragraph" | "list" | "image"; text: string; alt?: string; src?: string };

export function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const imageRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  for (const raw of content.split(/\n{2,}/)) {
    const text = raw.trim();
    if (!text) continue;
    const image = imageRe.exec(text);
    if (image && image[0].length >= text.length - 2) {
      blocks.push({ kind: "image", text, alt: image[1], src: image[2] });
      imageRe.lastIndex = 0;
      continue;
    }
    imageRe.lastIndex = 0;
    if (/^#{1,6}\s/.test(text)) blocks.push({ kind: "heading", text });
    else if (/^\s*[-*+]\s/.test(text) || /^\s*\d+\.\s/.test(text)) blocks.push({ kind: "list", text });
    else blocks.push({ kind: "paragraph", text });
  }
  if (blocks.length === 0 && content.trim()) blocks.push({ kind: "paragraph", text: content.trim() });
  return blocks;
}

/** Approximate Flesch-Kincaid grade level; no dependency, deterministic. */
export function gradeLevel(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.match(/[\p{L}'][\p{L}'-]*/gu) ?? [];
  if (sentences.length === 0 || words.length === 0) return 0;
  const syllables = words.reduce((sum, w) => sum + syllableCount(w), 0);
  return Math.round((0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59) * 10) / 10;
}

function syllableCount(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (w.endsWith("e") && !w.endsWith("le") && count > 1) count--;
  return Math.max(1, count);
}
