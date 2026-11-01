import { describe, expect, it } from "vitest";
import { analysePixels, evaluateImage, matchVariant, nearestPaletteDistance } from "@/lib/engine/visual";
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

  it("does not crash or divide by zero on a fully transparent buffer", () => {
    const analysis = analysePixels(new Uint8ClampedArray(32 * 32 * 4), 32, 32, VISUAL_CONFIG.palette);
    expect(Number.isFinite(analysis.contrastRatio)).toBe(true);
    expect(analysis.offPaletteShare).toBe(0);
    expect(analysis.clearSpaceRatio).toBe(1);
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
});

describe("variant matching", () => {
  it("maps aspect ratios into approved buckets", () => {
    const variants = VISUAL_CONFIG.variants!;
    expect(matchVariant(3.0, variants)?.name).toBe("horizontal");
    expect(matchVariant(1.0, variants)?.name).toBe("monogram");
    expect(matchVariant(1.2, variants)?.name).toBe("stacked");
    expect(matchVariant(8.0, variants)).toBeNull();
  });
});

describe("evaluateImage rules", () => {
  const base = {
    width: 240,
    height: 80,
    aspectRatio: 3,
    palette: ["#1F3A2E", "#F5F1E8"],
    contrastRatio: 8,
    offPaletteShare: 0,
    clearSpaceRatio: 0.8,
  };

  it("skips logo rules for photos", () => {
    const rules = evaluateImage(base, "photo", VISUAL_CONFIG);
    expect(rules.map((r) => r.rule).sort()).toEqual(["contrast", "palette"]);
  });

  it("applies logo rules to logos and honours thresholds", () => {
    const failing = evaluateImage(
      { ...base, offPaletteShare: 0.4, clearSpaceRatio: 0.1, aspectRatio: 8 },
      "logo",
      VISUAL_CONFIG,
    );
    const by = Object.fromEntries(failing.map((r) => [r.rule, r]));
    expect(by.palette.passed).toBe(false);
    expect(by["clear-space"].passed).toBe(false);
    expect(by["logo-variant"].passed).toBe(false);
    expect(by.contrast.passed).toBe(true);
  });
});
