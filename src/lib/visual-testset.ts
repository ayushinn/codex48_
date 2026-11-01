import { analysePixels, evaluateImage, type ImageKind, type VisualRuleConfig, type VisualRuleResult } from "@/lib/engine/visual";

/**
 * Seeded visual test set (IMP-1).
 *
 * Synthetic RGBA buffers with known ground truth: each case states which rules
 * must pass and which must fail. The suite runs the exact analysePixels +
 * evaluateImage code that scores real uploads, so the pass rate reported on
 * /quality and asserted in tests is a measured property of this build — not a
 * hand-written claim. No image files, no fixtures on disk, fully deterministic.
 */

export type TestCase = {
  id: string;
  name: string;
  description: string;
  kind: ImageKind;
  /** Expected outcome per rule: true = must pass, false = must fail. */
  expect: Record<string, boolean>;
  build: () => { data: Uint8ClampedArray; width: number; height: number };
};

const AURORA = ["#1F3A2E", "#C9A227", "#F5F1E8", "#2B2B2B", "#FFFFFF"];

function buffer(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width, height };
}

export const VISUAL_CONFIG: VisualRuleConfig = {
  palette: AURORA,
  minContrast: 4.5,
  maxOffPaletteShare: 0.1,
  minClearSpace: 0.5,
  // Buckets are disjoint and ordered tightest-first, so a 1:1 mark resolves to
  // monogram rather than falling into the wider stacked range.
  variants: [
    { name: "monogram", minRatio: 0.85, maxRatio: 1.15 },
    { name: "stacked", minRatio: 0.5, maxRatio: 0.84 },
    { name: "horizontal", minRatio: 2.2, maxRatio: 4.5 },
  ],
};

export const VISUAL_TEST_CASES: TestCase[] = [
  {
    id: "palette-hero",
    name: "Hero on approved palette",
    description: "Deep-green field with cream type — fully inside the Aurora palette.",
    kind: "photo",
    expect: { contrast: true, palette: true },
    build: () =>
      buffer(160, 100, (x, y) => (y < 70 ? [0x1f, 0x3a, 0x2e, 255] : [0xf5, 0xf1, 0xe8, 255])),
  },
  {
    id: "palette-offbrand",
    name: "Off-brand magenta campaign",
    description: "Magenta and cyan artwork — far outside the approved palette.",
    kind: "photo",
    expect: { contrast: true, palette: false },
    build: () =>
      buffer(160, 100, (x, y) => (x < 90 ? [0xd6, 0x00, 0x6e, 255] : [0x00, 0xc2, 0xc7, 255])),
  },
  {
    id: "contrast-flat",
    name: "Flat mid-tone overlay",
    description: "Two similar mid-greys — contrast well under the 4.5:1 floor.",
    kind: "photo",
    expect: { contrast: false, palette: true },
    build: () =>
      buffer(160, 100, (x, y) => (y < 50 ? [0x77, 0x7a, 0x76, 255] : [0x84, 0x87, 0x83, 255])),
  },
  {
    id: "logo-horizontal-ok",
    name: "Horizontal lockup, correct clear space",
    description: "Wide gold-on-cream wordmark with generous margins.",
    kind: "logo",
    expect: { contrast: true, palette: true, "logo-variant": true, "clear-space": true },
    build: () =>
      buffer(240, 80, (x, y) => {
        const inMark = y >= 30 && y <= 50 && x >= 40 && x <= 200;
        return inMark ? [0xc9, 0xa2, 0x27, 255] : [0xf5, 0xf1, 0xe8, 255];
      }),
  },
  {
    id: "logo-cropped-tight",
    name: "Monogram cropped with no clear space",
    description: "Square mark bleeding to every edge — clear space fails.",
    kind: "logo",
    expect: { contrast: true, palette: true, "logo-variant": true, "clear-space": false },
    build: () =>
      buffer(120, 120, (x, y) => {
        const inMark = x >= 4 && x <= 115 && y >= 4 && y <= 115;
        return inMark ? [0x1f, 0x3a, 0x2e, 255] : [0xf5, 0xf1, 0xe8, 255];
      }),
  },
  {
    id: "logo-unsupported-shape",
    name: "Wide banner treated as a logo",
    description: "8:1 strip — wider than every approved variant bucket allows.",
    kind: "logo",
    expect: { contrast: true, palette: true, "logo-variant": false, "clear-space": true },
    build: () =>
      buffer(320, 40, (x, y) => {
        const inMark = y >= 14 && y <= 26 && x >= 24 && x <= 296;
        return inMark ? [0x1f, 0x3a, 0x2e, 255] : [0xf5, 0xf1, 0xe8, 255];
      }),
  },
  {
    id: "logo-offpalette-mark",
    name: "Off-palette logo colour",
    description: "Bright red mark on cream — palette fails while shape passes.",
    kind: "logo",
    expect: { contrast: true, palette: false, "logo-variant": true, "clear-space": true },
    build: () =>
      buffer(240, 80, (x, y) => {
        const inMark = y >= 26 && y <= 54 && x >= 48 && x <= 192;
        return inMark ? [0xe0, 0x1b, 0x24, 255] : [0xf5, 0xf1, 0xe8, 255];
      }),
  },
  {
    id: "transparent-canvas",
    name: "Fully transparent canvas",
    description: "Degenerate input: no opaque pixels must not crash the rules.",
    kind: "photo",
    expect: { contrast: true, palette: true },
    build: () => buffer(64, 64, () => [0, 0, 0, 0]),
  },
];

export type CaseResult = {
  testCase: TestCase;
  results: VisualRuleResult[];
  matched: boolean;
  /** Expectations that disagreed with the engine. */
  mismatches: { rule: string; expected: boolean; actual: boolean }[];
};

export type AuditSummary = {
  cases: CaseResult[];
  totalRules: number;
  passedRules: number;
  matchedCases: number;
  passRate: number;
  failures: { caseId: string; rule: string; expected: boolean; measured: string; required: string; why: string }[];
};

/** Run every seeded case through the production analysis + rule code. */
export function runVisualAudit(): AuditSummary {
  const cases: CaseResult[] = [];
  const failures: AuditSummary["failures"] = [];
  let totalRules = 0;
  let passedRules = 0;
  let matchedCases = 0;

  for (const testCase of VISUAL_TEST_CASES) {
    const { data, width, height } = testCase.build();
    const analysis = analysePixels(data, width, height, VISUAL_CONFIG.palette);
    const results = evaluateImage(analysis, testCase.kind, VISUAL_CONFIG);

    const mismatches: CaseResult["mismatches"] = [];
    for (const result of results) {
      const expected = testCase.expect[result.rule];
      if (expected === undefined) continue;
      totalRules++;
      if (result.passed) passedRules++;
      if (result.passed !== expected) {
        mismatches.push({ rule: result.rule, expected, actual: result.passed });
        failures.push({
          caseId: testCase.id,
          rule: result.rule,
          expected,
          measured: result.measured,
          required: result.required,
          why: result.why,
        });
      }
    }
    const matched = mismatches.length === 0;
    if (matched) matchedCases++;
    cases.push({ testCase, results, matched, mismatches });
  }

  return {
    cases,
    totalRules,
    passedRules,
    matchedCases,
    passRate: totalRules > 0 ? Math.round((matchedCases / cases.length) * 100) : 0,
    failures,
  };
}
