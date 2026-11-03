import type { VariantSpec } from "@/lib/engine/visual";

/**
 * Canonical visual rules for the Aurora demo workspace (IMP-1).
 *
 * One source of truth, four consumers: the seed writes these into the
 * guideline clause configs (GB-4.1/4.3/4.4), the browser applies them to real
 * uploads at intake, the server re-applies them from stored clause configs,
 * and the seeded test set measures them in /quality. Drift between what the
 * product claims and what it measures is structurally impossible here.
 */

export const BRAND_PALETTE = ["#1F3A2E", "#C9A227", "#F5F1E8", "#2B2B2B", "#FFFFFF"];

export const VISUAL_THRESHOLDS = {
  /** WCAG 2.2 AA floor (logo: mark vs background; photo: tonal spread). */
  minContrast: 4.5,
  /** Share of sampled pixels allowed outside the palette (photographic tone). */
  maxOffPaletteShare: 0.1,
  /** Clear space around the logo, as a fraction of its height, every side. */
  minClearSpace: 0.5,
};

/** Approved logo aspect-ratio buckets (width / height). Disjoint by design. */
export const LOGO_VARIANTS: VariantSpec[] = [
  { name: "monogram", minRatio: 0.85, maxRatio: 1.15 },
  { name: "stacked", minRatio: 0.5, maxRatio: 0.84 },
  { name: "horizontal", minRatio: 2.2, maxRatio: 4.5 },
];
