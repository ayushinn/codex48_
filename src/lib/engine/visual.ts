/**
 * Visual rule pack — deterministic analysis of image pixels and metadata.
 *
 * The same rules run in two places, which is the point:
 *  - in the browser at intake, over canvas ImageData of a real upload;
 *  - on the server and in tests, over synthetic pixel buffers from the seeded
 *    visual test set (src/lib/visual-testset.ts).
 *
 * So the rules that score a user's logo are literally the ones measured by the
 * test set, and the measured pass rate on /quality is a property of the build.
 * No dependency, no model, no network: pure functions over RGBA bytes.
 */

export type ImageKind = "photo" | "logo";

export type VariantSpec = { name: string; minRatio: number; maxRatio: number };

export type VisualRuleConfig = {
  /** Approved brand palette as hex strings. Empty disables palette rules. */
  palette: string[];
  /** WCAG AA contrast between dominant light and dark tones. Default 4.5. */
  minContrast?: number;
  /** Max share of sampled pixels allowed far from the palette. Default 0.1. */
  maxOffPaletteShare?: number;
  /** Approved logo variants (aspect-ratio buckets, width / height). */
  variants?: VariantSpec[];
  /** Min clear space around the logo's content box, as a fraction of its height. */
  minClearSpace?: number;
};

export type ImageAnalysis = {
  width: number;
  height: number;
  aspectRatio: number;
  /** Dominant colours, most frequent first. */
  palette: string[];
  /** Contrast between the dominant light and dark tones. */
  contrastRatio: number;
  /** 0..1 share of sampled pixels whose nearest palette colour is far away. */
  offPaletteShare: number;
  /** Min margin around the content bounding box, as a fraction of content height. */
  clearSpaceRatio: number;
};

export type RuleName = "palette" | "contrast" | "clear-space" | "logo-variant";

export type VisualRuleResult = {
  rule: RuleName;
  passed: boolean;
  measured: string;
  required: string;
  why: string;
};

const DEFAULT_MIN_CONTRAST = 4.5;
const DEFAULT_MAX_OFF_PALETTE = 0.1;
const DEFAULT_MIN_CLEAR_SPACE = 0.5;
/** RGB distance above which a sampled colour counts as off-palette. */
export const PALETTE_DISTANCE_FLOOR = 60;

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function nearestPaletteDistance(hex: string, palette: string[]): number {
  const ca = hexToRgb(hex);
  if (!ca) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const p of palette) {
    const cb = hexToRgb(p);
    if (!cb) continue;
    const d = Math.sqrt((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2 + (ca[2] - cb[2]) ** 2);
    if (d < best) best = d;
  }
  return best === Number.POSITIVE_INFINITY ? 0 : best;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * Analyse raw RGBA pixels. Called with browser ImageData in production and
 * with synthetic buffers in the seeded test set — never with a model.
 */
export function analysePixels(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  palette: string[],
): ImageAnalysis {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  let lightSum = 0;
  let lightN = 0;
  let darkSum = 0;
  let darkN = 0;
  let off = 0;
  let sampled = 0;

  // Content bounding box: background is the most common colour, content is
  // everything meaningfully different from it (this is what clear space measures).
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  const total = width * height;
  const step = total > 40_000 ? 4 : 1; // large uploads are sampled, not exhaustively scanned

  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n++;
    buckets.set(key, bucket);

    const lum = relativeLuminance(r, g, b);
    if (lum > 0.4) {
      lightSum += lum;
      lightN++;
    } else {
      darkSum += lum;
      darkN++;
    }

    sampled++;
    if (palette.length && nearestPaletteDistance(toHex(r, g, b), palette) > PALETTE_DISTANCE_FLOOR) {
      off++;
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const dominant = sorted[0] ?? { r: 255, g: 255, b: 255, n: 1 };
  const domHex = toHex(
    Math.round(dominant.r / dominant.n),
    Math.round(dominant.g / dominant.n),
    Math.round(dominant.b / dominant.n),
  );

  // Second pass for the content box (pixel stride must match the grid, so a
  // separate loop is cheaper to reason about than threading indices through).
  const pixelAt = (x: number, y: number): [number, number, number, number] => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const bg = hexToRgb(domHex) ?? [255, 255, 255];
  const xStep = width > 320 ? 2 : 1;
  const yStep = height > 320 ? 2 : 1;
  for (let y = 0; y < height; y += yStep) {
    for (let x = 0; x < width; x += xStep) {
      const [r, g, b, a] = pixelAt(x, y);
      if (a < 200) continue;
      const d = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
      if (d > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  let clearSpaceRatio = 1;
  if (maxX >= minX && maxY >= minY) {
    const contentHeight = maxY - minY + 1;
    const margin = Math.min(minX, minY, width - 1 - maxX, height - 1 - maxY);
    clearSpaceRatio = contentHeight > 0 ? margin / contentHeight : 0;
  }

  const lightAvg = lightN > total * 0.02 ? lightSum / lightN : null;
  const darkAvg = darkN > total * 0.02 ? darkSum / darkN : null;
  const contrastRatio =
    lightAvg !== null && darkAvg !== null
      ? (Math.max(lightAvg, darkAvg) + 0.05) / (Math.min(lightAvg, darkAvg) + 0.05)
      : 10;

  const top = sorted.slice(0, 6).map((b) =>
    toHex(Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)),
  );

  return {
    width,
    height,
    aspectRatio: height > 0 ? Math.round((width / height) * 100) / 100 : 0,
    palette: top,
    contrastRatio: Math.round(contrastRatio * 100) / 100,
    offPaletteShare: sampled > 0 ? Math.round((off / sampled) * 1000) / 1000 : 0,
    clearSpaceRatio: Math.round(clearSpaceRatio * 1000) / 1000,
  };
}

/** Which approved variant (if any) an aspect ratio falls into. */
export function matchVariant(aspectRatio: number, variants: VariantSpec[]): VariantSpec | null {
  return variants.find((v) => aspectRatio >= v.minRatio && aspectRatio <= v.maxRatio) ?? null;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Evaluate the visual rules against an analysis. Every result carries what was
 * measured and what was required, so a reviewer sees which rules passed,
 * which failed and why — the same evidence standard as the text findings.
 */
export function evaluateImage(
  analysis: ImageAnalysis,
  kind: ImageKind,
  cfg: VisualRuleConfig,
): VisualRuleResult[] {
  const out: VisualRuleResult[] = [];
  const minContrast = cfg.minContrast ?? DEFAULT_MIN_CONTRAST;
  const maxOff = cfg.maxOffPaletteShare ?? DEFAULT_MAX_OFF_PALETTE;
  const minClear = cfg.minClearSpace ?? DEFAULT_MIN_CLEAR_SPACE;

  // Contrast applies to every image.
  out.push({
    rule: "contrast",
    passed: analysis.contrastRatio >= minContrast,
    measured: `${analysis.contrastRatio.toFixed(2)}:1`,
    required: `${minContrast.toFixed(1)}:1`,
    why:
      analysis.contrastRatio >= minContrast
        ? `Dominant light and dark tones measure ${analysis.contrastRatio.toFixed(2)}:1, above the ${minContrast.toFixed(1)}:1 floor.`
        : `Dominant light and dark tones measure ${analysis.contrastRatio.toFixed(2)}:1; WCAG 2.2 AA and the brand book require ${minContrast.toFixed(1)}:1.`,
  });

  // Palette applies whenever an approved palette is configured.
  if (cfg.palette.length > 0) {
    out.push({
      rule: "palette",
      passed: analysis.offPaletteShare <= maxOff,
      measured: `${pct(analysis.offPaletteShare)} off-palette`,
      required: `≤ ${pct(maxOff)}`,
      why:
        analysis.offPaletteShare <= maxOff
          ? `${pct(analysis.offPaletteShare)} of sampled pixels fall outside the approved palette, within the ${pct(maxOff)} tolerance for photographic tone.`
          : `${pct(analysis.offPaletteShare)} of sampled pixels fall outside the approved palette (${analysis.palette.slice(0, 3).join(", ")} dominate); the tolerance is ${pct(maxOff)}.`,
    });
  }

  if (kind === "logo") {
    const variants = cfg.variants ?? [];
    if (variants.length > 0) {
      const match = matchVariant(analysis.aspectRatio, variants);
      out.push({
        rule: "logo-variant",
        passed: Boolean(match),
        measured: `${analysis.aspectRatio}:1 aspect (${analysis.width}×${analysis.height})`,
        required: variants.map((v) => `${v.name} ${v.minRatio}–${v.maxRatio}:1`).join(" · "),
        why: match
          ? `The ${analysis.aspectRatio}:1 aspect matches the approved "${match.name}" variant.`
          : `No approved logo variant matches a ${analysis.aspectRatio}:1 aspect; the approved shapes are ${variants.map((v) => `${v.name} (${v.minRatio}–${v.maxRatio}:1)`).join(", ")}.`,
      });
    }
    out.push({
      rule: "clear-space",
      passed: analysis.clearSpaceRatio >= minClear,
      measured: `${pct(analysis.clearSpaceRatio)} of logo height`,
      required: `≥ ${pct(minClear)}`,
      why:
        analysis.clearSpaceRatio >= minClear
          ? `Clear space around the mark measures ${pct(analysis.clearSpaceRatio)} of its height, at or above the required ${pct(minClear)}.`
          : `Clear space around the mark measures only ${pct(analysis.clearSpaceRatio)} of its height; the brand book requires ${pct(minClear)} on every side.`,
    });
  }

  return out;
}

/**
 * Rule evaluation from stored intake metadata (what the review page has after
 * the browser analysis) rather than raw pixels. Rules whose input is missing
 * are skipped, never guessed.
 */
export function evaluateImageMeta(
  image: {
    name: string;
    kind?: ImageKind;
    palette?: string[];
    contrastRatio?: number;
    width?: number;
    height?: number;
    aspectRatio?: number;
    clearSpaceRatio?: number;
    offPaletteShare?: number;
  },
  cfg: VisualRuleConfig,
): VisualRuleResult[] {
  const minContrast = cfg.minContrast ?? DEFAULT_MIN_CONTRAST;
  const maxOff = cfg.maxOffPaletteShare ?? DEFAULT_MAX_OFF_PALETTE;
  const minClear = cfg.minClearSpace ?? DEFAULT_MIN_CLEAR_SPACE;
  const out: VisualRuleResult[] = [];

  if (typeof image.contrastRatio === "number") {
    out.push({
      rule: "contrast",
      passed: image.contrastRatio >= minContrast,
      measured: `${image.contrastRatio.toFixed(2)}:1`,
      required: `${minContrast.toFixed(1)}:1`,
      why:
        image.contrastRatio >= minContrast
          ? `Measured contrast inside "${image.name}" is ${image.contrastRatio.toFixed(2)}:1, above the ${minContrast.toFixed(1)}:1 floor.`
          : `Measured contrast inside "${image.name}" is ${image.contrastRatio.toFixed(2)}:1; WCAG 2.2 AA requires ${minContrast.toFixed(1)}:1.`,
    });
  }

  if (typeof image.offPaletteShare === "number" && cfg.palette.length > 0) {
    out.push({
      rule: "palette",
      passed: image.offPaletteShare <= maxOff,
      measured: `${pct(image.offPaletteShare)} off-palette`,
      required: `≤ ${pct(maxOff)}`,
      why:
        image.offPaletteShare <= maxOff
          ? `"${image.name}" is ${pct(image.offPaletteShare)} off-palette, within the ${pct(maxOff)} tolerance.`
          : `"${image.name}" is ${pct(image.offPaletteShare)} off-palette (${(image.palette ?? []).slice(0, 3).join(", ")} dominate); the tolerance is ${pct(maxOff)}.`,
    });
  } else if (image.palette?.length && cfg.palette.length > 0) {
    // Legacy path: only dominant colours were stored, so measure those.
    const off = image.palette.filter((c) => nearestPaletteDistance(c, cfg.palette) > PALETTE_DISTANCE_FLOOR);
    out.push({
      rule: "palette",
      passed: off.length === 0,
      measured: `${off.length} of ${image.palette.length} dominant colours off-palette`,
      required: "dominant colours on-palette",
      why:
        off.length === 0
          ? `Every dominant colour of "${image.name}" sits inside the approved palette.`
          : `"${image.name}" uses ${off.length} colour${off.length > 1 ? "s" : ""} outside the approved palette (${off.slice(0, 4).join(", ")}).`,
    });
  }

  if (image.kind === "logo") {
    const aspect =
      typeof image.aspectRatio === "number"
        ? image.aspectRatio
        : image.width && image.height
          ? Math.round((image.width / image.height) * 100) / 100
          : null;
    const variants = cfg.variants ?? [];
    if (aspect !== null && variants.length > 0) {
      const match = matchVariant(aspect, variants);
      out.push({
        rule: "logo-variant",
        passed: Boolean(match),
        measured: `${aspect}:1 aspect`,
        required: variants.map((v) => `${v.name} ${v.minRatio}–${v.maxRatio}:1`).join(" · "),
        why: match
          ? `"${image.name}" is a ${aspect}:1 mark, matching the approved "${match.name}" variant.`
          : `"${image.name}" is a ${aspect}:1 mark; no approved variant matches (approved: ${variants.map((v) => `${v.name} ${v.minRatio}–${v.maxRatio}:1`).join(", ")}).`,
      });
    }
    if (typeof image.clearSpaceRatio === "number") {
      out.push({
        rule: "clear-space",
        passed: image.clearSpaceRatio >= minClear,
        measured: `${pct(image.clearSpaceRatio)} of logo height`,
        required: `≥ ${pct(minClear)}`,
        why:
          image.clearSpaceRatio >= minClear
            ? `Clear space around "${image.name}" measures ${pct(image.clearSpaceRatio)} of its height, at or above the required ${pct(minClear)}.`
            : `Clear space around "${image.name}" measures only ${pct(image.clearSpaceRatio)} of its height; the brand book requires ${pct(minClear)} on every side.`,
      });
    }
  }

  return out;
}
