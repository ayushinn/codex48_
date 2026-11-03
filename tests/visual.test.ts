import { describe, expect, it } from "vitest";
import { analysePixels, contrastRatioOf, evaluateImage, evaluateImageMeta, matchVariant, nearestPaletteDistance, UNIFORM_TONAL_EPS } from "@/lib/engine/visual";
import { runVisualAudit, VISUAL_CONFIG, VISUAL_TEST_CASES } from "@/lib/visual-testset";

/**
 * IMP-1 — visual rules are measured, not claimed.
 *
 * These tests run the exact code that scores real uploads against the seeded
 * image test set. A regression in the pixel math shows up here as a failed
 * expectation, and the same summary renders on /quality.
 */

describe("visual audit pack (seeded image test set)", () => {
  it("every seeded case behaves as labelled — 100% agreement", () => {
    const audit = runVisualAudit();
    expect(audit.failures).toEqual([]);
    expect(audit.matchedCases).toBe(VISUAL_TEST_CASES.length);
    expect(audit.passRate).toBe(100);
  });

  it("covers all four visual rules with both pass and fail examples", () => {
    const audit = runVisualAudit();
    const byRule = new Map<string, { pass: number; fail: number }>();
    for (const c of audit.cases) {
      for (const r of c.results) {
        const entry = byRule.get(r.rule) ?? { pass: 0, fail: 0 };
        if (r.passed) entry.pass++;
        else entry.fail++;
        byRule.set(r.rule, entry);
      }
    }
    for (const rule of ["contrast", "palette", "logo-variant", "clear-space"]) {
      const entry = byRule.get(rule);
      expect(entry, `${rule} never ran`).toBeTruthy();
      expect(entry!.pass, `${rule} has no passing case`).toBeGreaterThan(0);
      expect(entry!.fail, `${rule} has no failing case`).toBeGreaterThan(0);
    }
  });

  it("every result carries measured evidence and a requirement", () => {
    for (const c of runVisualAudit().cases) {
      for (const r of c.results) {
        expect(r.measured.length).toBeGreaterThan(0);
        expect(r.required.length).toBeGreaterThan(0);
        expect(r.why.length).toBeGreaterThan(10);
      }
    }
  });

  it("labels photo contrast as a tonal heuristic and logo contrast as WCAG", () => {
    const audit = runVisualAudit();
    for (const c of audit.cases) {
      for (const r of c.results) {
        if (r.rule !== "contrast") continue;
        expect(r.measured, `${c.testCase.id}`).toContain(
          c.testCase.kind === "logo" ? "mark vs background" : "tonal spread",
        );
      }
    }
  });
});

describe("pixel analysis", () => {
  it("measures clear space as the tightest margin over content height", () => {
    // 100x100 canvas, content box at x 20..79, y 30..69 → margins 20/20/30/30,
    // content height 40 → min margin 20 → 0.5.
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const i = (y * 100 + x) * 4;
        const inside = x >= 20 && x <= 79 && y >= 30 && y <= 69;
        data[i] = inside ? 0x1f : 0xf5;
        data[i + 1] = inside ? 0x3a : 0xf1;
        data[i + 2] = inside ? 0x2e : 0xe8;
        data[i + 3] = 255;
      }
    }
    const analysis = analysePixels(data, 100, 100, VISUAL_CONFIG.palette);
    expect(analysis.clearSpaceRatio).toBeCloseTo(0.5, 2);
  });

  it("returns null contrast (not a guess) on a fully transparent buffer", () => {
    const analysis = analysePixels(new Uint8ClampedArray(32 * 32 * 4), 32, 32, VISUAL_CONFIG.palette);
    expect(analysis.contrastRatio).toBeNull();
    expect(analysis.markContrastRatio).toBeNull();
    expect(analysis.offPaletteShare).toBe(0);
    expect(analysis.clearSpaceRatio).toBe(1);
    // And the photo contrast rule is skipped rather than scored.
    const rules = evaluateImage(analysis, "photo", VISUAL_CONFIG);
    expect(rules.map((r) => r.rule)).toEqual(["palette"]);
  });

  it("returns null contrast on a uniform fill — nothing to measure", () => {
    const data = new Uint8ClampedArray(64 * 64 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0x2b;
      data[i + 1] = 0x2b;
      data[i + 2] = 0x2b;
      data[i + 3] = 255;
    }
    const analysis = analysePixels(data, 64, 64, VISUAL_CONFIG.palette);
    expect(analysis.contrastRatio).toBeNull();
    expect(UNIFORM_TONAL_EPS).toBeGreaterThan(0);
  });

  it("computes off-palette share for a synthetic off-brand image", () => {
    const data = new Uint8ClampedArray(64 * 64 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0xd6;
      data[i + 1] = 0x00;
      data[i + 2] = 0x6e;
      data[i + 3] = 255;
    }
    const analysis = analysePixels(data, 64, 64, VISUAL_CONFIG.palette);
    expect(analysis.offPaletteShare).toBe(1);
  });

  it("matches approved palette colours at zero distance", () => {
    expect(nearestPaletteDistance("#1F3A2E", VISUAL_CONFIG.palette)).toBe(0);
    expect(nearestPaletteDistance("#FF0000", VISUAL_CONFIG.palette)).toBeGreaterThan(100);
  });

  it("handles malformed input: truncated buffers and zero dimensions", () => {
    // Declared 100x100 but only 50 pixels of data exist.
    const truncated = analysePixels(new Uint8ClampedArray(50 * 4), 100, 100, VISUAL_CONFIG.palette);
    expect(truncated.clearSpaceRatio).toBeGreaterThanOrEqual(0);
    expect(truncated.offPaletteShare).toBeGreaterThanOrEqual(0);
    // Zero-sized image.
    const zero = analysePixels(new Uint8ClampedArray(0), 0, 0, VISUAL_CONFIG.palette);
    expect(zero.aspectRatio).toBe(0);
    expect(zero.contrastRatio).toBeNull();
    // Garbage bytes: alpha 0 everywhere → treated as transparent.
    const garbage = analysePixels(new Uint8ClampedArray([1, 2, 3, 0]), 1, 1, VISUAL_CONFIG.palette);
    expect(garbage.contrastRatio).toBeNull();
  });

  it("handles unusually large stride images without scanning every pixel twice", () => {
    // 640x640 > 40,000 pixels → sampling path engages.
    const size = 640;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const top = y < size / 2;
        data[i] = top ? 0x1f : 0xf5;
        data[i + 1] = top ? 0x3a : 0xf1;
        data[i + 2] = top ? 0x2e : 0xe8;
        data[i + 3] = 255;
      }
    }
    const analysis = analysePixels(data, size, size, VISUAL_CONFIG.palette);
    expect(analysis.offPaletteShare).toBe(0);
    expect(analysis.contrastRatio).toBeGreaterThan(4.5);
  });
});

describe("contrast measurement", () => {
  it("computes the WCAG 2.2 ratio between two hex colours", () => {
    expect(contrastRatioOf("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatioOf("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 1);
    // Gold on cream — the reviewer-verified failure case.
    expect(contrastRatioOf("#C9A227", "#F5F1E8")).toBeLessThan(4.5);
    // Deep green on cream passes.
    expect(contrastRatioOf("#1F3A2E", "#F5F1E8")).toBeGreaterThan(4.5);
  });

  it("photo contrast is a tonal spread, logo contrast is mark-vs-background", () => {
    const photo = analysePixels(
      VISUAL_TEST_CASES.find((c) => c.id === "palette-hero")!.build().data,
      160,
      100,
      VISUAL_CONFIG.palette,
    );
    expect(photo.contrastRatio).not.toBeNull();
    const photoRules = evaluateImage(photo, "photo", VISUAL_CONFIG);
    expect(photoRules.find((r) => r.rule === "contrast")!.measured).toContain("tonal spread");

    const logo = analysePixels(
      VISUAL_TEST_CASES.find((c) => c.id === "logo-horizontal-ok")!.build().data,
      240,
      80,
      VISUAL_CONFIG.palette,
    );
    expect(logo.markColor).toBe("#1F3A2E");
    const logoRules = evaluateImage(logo, "logo", VISUAL_CONFIG);
    expect(logoRules.find((r) => r.rule === "contrast")!.measured).toContain("mark vs background");
  });
});

describe("variant matching", () => {
  it("maps aspect ratios into disjoint approved buckets", () => {
    const variants = VISUAL_CONFIG.variants!;
    expect(matchVariant(3.0, variants)?.name).toBe("horizontal");
    expect(matchVariant(1.0, variants)?.name).toBe("monogram");
    expect(matchVariant(0.7, variants)?.name).toBe("stacked");
    // Deliberate gap: 1.16–2.19 has no approved variant.
    expect(matchVariant(1.5, variants)).toBeNull();
    expect(matchVariant(8.0, variants)).toBeNull();
  });

  it("has no overlapping buckets", () => {
    const variants = VISUAL_CONFIG.variants!;
    for (const outer of variants) {
      for (const inner of variants) {
        if (outer === inner) continue;
        const overlap = outer.minRatio <= inner.maxRatio && outer.maxRatio >= inner.minRatio;
        expect(overlap, `${outer.name} overlaps ${inner.name}`).toBe(false);
      }
    }
  });
});

describe("evaluateImage rules", () => {
  const base = {
    width: 240,
    height: 80,
    aspectRatio: 3,
    palette: ["#1F3A2E", "#F5F1E8"],
    contrastRatio: 8,
    markContrastRatio: 8,
    markColor: "#1F3A2E",
    backgroundColor: "#F5F1E8",
    offPaletteShare: 0,
    clearSpaceRatio: 0.8,
  };

  it("skips logo rules for photos", () => {
    const rules = evaluateImage(base, "photo", VISUAL_CONFIG);
    expect(rules.map((r) => r.rule).sort()).toEqual(["contrast", "palette"]);
  });

  it("applies logo rules to logos and honours thresholds", () => {
    const failing = evaluateImage(
      { ...base, offPaletteShare: 0.4, clearSpaceRatio: 0.1, aspectRatio: 8, markContrastRatio: 2.1 },
      "logo",
      VISUAL_CONFIG,
    );
    const by = Object.fromEntries(failing.map((r) => [r.rule, r]));
    expect(by.palette.passed).toBe(false);
    expect(by["clear-space"].passed).toBe(false);
    expect(by["logo-variant"].passed).toBe(false);
    expect(by.contrast.passed).toBe(false);
    expect(by.contrast.measured).toContain("mark vs background");
  });

  it("skips the logo contrast rule when mark contrast is not measurable", () => {
    const rules = evaluateImage(
      { ...base, markContrastRatio: null, markColor: null },
      "logo",
      VISUAL_CONFIG,
    );
    expect(rules.map((r) => r.rule).sort()).toEqual(["clear-space", "logo-variant", "palette"]);
  });

  it("never substitutes a passing contrast value for missing measurements", () => {
    const results = evaluateImageMeta({ name: "transparent.png", kind: "photo", contrastRatio: null }, VISUAL_CONFIG);
    expect(results.some((r) => r.rule === "contrast")).toBe(false);
  });

  it("reports every distinct failing logo rule from stored intake metadata", () => {
    const results = evaluateImageMeta({
      name: "off-brand-logo.png", kind: "logo", palette: ["#D6006E"],
      contrastRatio: 1.2, offPaletteShare: 1, clearSpaceRatio: 0.05, aspectRatio: 8,
    }, VISUAL_CONFIG);
    expect(results.filter((r) => !r.passed).map((r) => r.rule).sort()).toEqual([
      "clear-space", "contrast", "logo-variant", "palette",
    ]);
  });
});
