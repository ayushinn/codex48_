import { describe, expect, it } from "vitest";
import { buildCtx, runRuleChecks, type Ctx } from "@/lib/engine/checks";
import { locateSpan, normalize, wordDiff } from "@/lib/engine/text";
import { excerptClause, severityFor, verifyCandidate, attachContent } from "@/lib/engine/verify";
import type { Clause, Fact, Term, Channel } from "@/lib/db/schema";

/**
 * Core engine guarantees the product is judged on:
 *  - every finding cites a clause that retrieval actually returned,
 *  - every quoted span exists verbatim in the draft,
 *  - required verbatim phrases (disclaimers) are not flagged word-by-word.
 */

const clause = (over: Partial<Clause> & Pick<Clause, "code" | "body" | "ruleType" | "checkGroup">): Clause =>
  ({
    id: `cl_${over.code}`,
    guidelineVersionId: "gv_1",
    section: over.code,
    title: over.code,
    config: {},
    channel: null,
    ...over,
  }) as Clause;

describe("citation verifier", () => {
  const clauses: Clause[] = [
    clause({
      code: "GB-2.2",
      body: "Never use the words cure, detox, or hack. The approved wording names the outcome plainly.",
      ruleType: "policy",
      checkGroup: "terminology",
    }),
  ];

  it("accepts a rule-engine candidate and maps policy to blocker", () => {
    const content = "Our supplement will cure stress in days.";
    const candidate = attachContent(
      {
        checkGroup: "terminology",
        clauseCode: "GB-2.2",
        why: "Banned term.",
        quote: "cure",
        source: "rules",
      },
      content,
    );
    const result = verifyCandidate(candidate, clauses);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.severity).toBe("blocker");
      expect(result.span).not.toBeNull();
      expect(content.slice(result.span!.start, result.span!.end).toLowerCase()).toBe("cure");
      expect(clauses[0].body).toContain(result.clauseQuote);
    }
    expect(severityFor("style")).toBe("warn");
    expect(severityFor("preference")).toBe("info");
  });

  it("rejects a finding whose clause was not retrieved", () => {
    const candidate = attachContent(
      { checkGroup: "tone", clauseCode: "GB-9.9", why: "x", quote: "hello" },
      "hello world",
    );
    const result = verifyCandidate(candidate, clauses);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("clause-not-found");
  });

  it("rejects an LLM quote that is not verbatim in the stored clause", () => {
    const candidate = attachContent(
      {
        checkGroup: "terminology",
        clauseCode: "GB-2.2",
        why: "Violates the clause \u00abthe brand must always win awards\u00bb.",
        quote: "cure",
        source: "llm",
      },
      "cure stress",
    );
    const result = verifyCandidate(candidate, clauses);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("clause-quote-not-found");
  });

  it("rejects a quote that cannot be located in the draft", () => {
    const candidate = attachContent(
      { checkGroup: "terminology", clauseCode: "GB-2.2", why: "x", quote: "miracle cure" },
      "Our supplement will cure stress in days.",
    );
    const result = verifyCandidate(candidate, clauses);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("quote-not-found");
  });

  it("quotes the clause excerpt verbatim", () => {
    const body = "Short rule. Second sentence carries the detail.";
    expect(body).toContain(excerptClause(body));
  });
});

describe("span locating", () => {
  it("locates spans across smart quotes and collapsed whitespace", () => {
    const source = "The guide says \u201cnever say \u201ccure\u201d\u201d in copy.";
    const span = locateSpan(source, '"never say "cure"" in copy.');
    expect(span).not.toBeNull();
    expect(normalize(source.slice(span!.start, span!.end))).toBe(normalize('"never say "cure"" in copy.'));
  });

  it("returns null for text not present", () => {
    expect(locateSpan("alpha beta gamma", "delta")).toBeNull();
  });
});

describe("word diff", () => {
  it("turns a suggestion into keep/del/ins operations", () => {
    const ops = wordDiff("Buy our detox tea now", "Buy our wellness tea now");
    const del = ops.filter((o) => o.op === "del").map((o) => o.text).join("").trim();
    const ins = ops.filter((o) => o.op === "ins").map((o) => o.text).join("").trim();
    expect(del).toBe("detox");
    expect(ins).toBe("wellness");
  });
});

describe("protected verbatim phrases", () => {
  const channel = {
    id: "ch_1",
    workspaceId: "ws_1",
    key: "ad",
    name: "Paid ad",
    maxChars: null,
    minWords: null,
    rules: { requiredPhrases: ["Results not typical. Terms apply."] },
  } as Channel;

  const terms: Term[] = [
    { id: "t_1", workspaceId: "ws_1", kind: "banned", term: "guaranteed", replacement: "designed to", note: null },
  ];

  const ctxFor = (content: string): Ctx =>
    buildCtx({
      content,
      channel,
      clauses: [
        clause({
          code: "GB-2.2",
          body: "Banned words are removed from all copy.",
          ruleType: "policy",
          checkGroup: "terminology",
          config: { requiredPhrases: ["Results not typical. Terms apply."] },
        }),
      ],
      terms,
      facts: [] as Fact[],
      toneExamples: [],
      images: [],
      palette: [],
    });

  it("does not flag banned words inside the required disclaimer", () => {
    const ctx = ctxFor(
      "Our plan is guaranteed to work. Results not typical. Terms apply.",
    );
    const flagged = runRuleChecks(ctx).filter((c) => c.checkGroup === "terminology");
    // The word "guaranteed" outside the disclaimer is flagged...
    expect(flagged.length).toBe(1);
    expect(flagged[0].quote?.toLowerCase()).toBe("guaranteed");
  });

  it("flags the banned word when it appears outside the disclaimer", () => {
    const ctx = ctxFor("This is guaranteed to work for everyone.");
    const flagged = runRuleChecks(ctx).filter((c) => c.checkGroup === "terminology");
    expect(flagged.length).toBe(1);
    expect(flagged[0].suggestion).toBe("designed to");
  });

  it("reports the missing required phrase as an append fix", () => {
    const ctx = ctxFor("This is guaranteed to work for everyone.");
    const missing = runRuleChecks(ctx).filter((c) => c.anchor === "append");
    expect(missing.some((c) => c.suggestion === "Results not typical. Terms apply.")).toBe(true);
  });
});

describe("imported guideline (pasted, auto-coded clauses)", () => {
  it("resolves checks by check group when the seeded codes are absent", () => {
    const channel = {
      id: "ch_2",
      workspaceId: "ws_1",
      key: "social",
      name: "Social",
      maxChars: 280,
      minWords: null,
      rules: {},
    } as Channel;
    // Exactly what /api/knowledge produces for a pasted brand book: codes are
    // GB-{version}-{n} and config is empty, so nothing matches GB-2.2 etc.
    const imported = [
      clause({ code: "GB-2-4", body: "Never use the word detox.", ruleType: "policy", checkGroup: "terminology" }),
      clause({ code: "GB-1-2", body: "Register every claim with a source.", ruleType: "policy", checkGroup: "facts" }),
      clause({ code: "GB-3-1", body: "Avoid hype and superlatives.", ruleType: "style", checkGroup: "tone" }),
    ];
    const ctx = buildCtx({
      content: "This detox tea is number one and cures everything!"
        .concat("\n\nResults vary. Terms apply."),
      channel,
      clauses: imported,
      terms: [{ id: "t_2", workspaceId: "ws_1", kind: "banned", term: "detox", replacement: "wellness", note: null }],
      facts: [] as Fact[],
      toneExamples: [],
      images: [],
      palette: [],
    });
    const flags = runRuleChecks(ctx);
    const terminology = flags.filter((f) => f.clauseCode === "GB-2-4");
    expect(terminology.length).toBeGreaterThan(0);
    expect(terminology[0].quote?.toLowerCase()).toBe("detox");
    expect(flags.some((f) => f.clauseCode === "GB-1-2")).toBe(true);
    expect(flags.some((f) => f.clauseCode === "GB-3-1")).toBe(true);
    expect(flags.every((f) => imported.some((c) => c.code === f.clauseCode))).toBe(true);
  });
});

describe("image accessibility", () => {
  const channel = {
    id: "ch_3",
    workspaceId: "ws_1",
    key: "social",
    name: "Social",
    maxChars: null,
    minWords: null,
    rules: {},
  } as Channel;

  it("flags a missing alt and suggests valid markdown", () => {
    const ctx = buildCtx({
      content: "Weekend note for the feed.\n\n![](spring-sale.jpg)",
      channel,
      clauses: [
        clause({
          code: "GB-4-1",
          body: "Alt text of at least 24 characters is required on every image.",
          ruleType: "policy",
          checkGroup: "accessibility",
        }),
      ],
      terms: [] as Term[],
      facts: [] as Fact[],
      toneExamples: [],
      images: [],
      palette: [],
    });
    const alt = runRuleChecks(ctx).filter((f) => f.checkGroup === "accessibility");
    expect(alt.length).toBe(1);
    // The suggestion must itself be parseable markdown: ![alt](src)
    expect(alt[0].suggestion).toBe("![Spring sale](spring-sale.jpg)");
  });

  it("flags attached images below the WCAG contrast threshold", () => {
    const ctx = buildCtx({
      content: "Weekend note for the feed.",
      channel,
      clauses: [
        clause({
          code: "GB-4-2",
          body: "Text over an image must meet 4.5:1 contrast.",
          ruleType: "policy",
          checkGroup: "accessibility",
        }),
      ],
      terms: [] as Term[],
      facts: [] as Fact[],
      toneExamples: [],
      images: [{ id: "img_1", name: "flat.png", alt: "", palette: [], contrastRatio: 2.1 }],
      palette: [],
    });
    const contrast = runRuleChecks(ctx).filter((f) => f.why.includes("contrast"));
    expect(contrast.length).toBe(1);
    expect(contrast[0].why).toContain("2.10:1");
  });
});
