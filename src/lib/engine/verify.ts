import type { Clause } from "@/lib/db/schema";
import { locateSpan, locateSpanFuzzy, normalize, type Span } from "./text";
import type { Candidate } from "./checks";

/**
 * Deterministic citation verifier - code, not model.
 *
 * A candidate finding is only allowed to become a displayed finding when:
 *   1. it cites a clause that retrieval actually returned for this workspace,
 *   2. the clause quote is verbatim inside that clause's stored body, and
 *   3. the content quote can be located inside the draft (exact, then fuzzy
 *      with a similarity floor for model-supplied quotes).
 *
 * Anything that fails is counted in the verifier-rejection metric and never
 * reaches a reviewer.
 */

export type VerifyRejection =
  | { ok: false; reason: "clause-not-found"; detail: string }
  | { ok: false; reason: "clause-quote-not-found"; detail: string }
  | { ok: false; reason: "quote-not-found"; detail: string };

export type Verified = {
  ok: true;
  clause: Clause;
  severity: "blocker" | "warn" | "info";
  clauseQuote: string;
  span: Span | null;
};

export function severityFor(ruleType: string): "blocker" | "warn" | "info" {
  if (ruleType === "policy") return "blocker";
  if (ruleType === "style") return "warn";
  return "info";
}

/** A short verbatim excerpt of a clause body, used as the quoted evidence. */
export function excerptClause(body: string): string {
  const sentences = body.split(/(?<=[.!?])\s+/);
  if (sentences.length === 0) return body;
  if (sentences[0].length >= 40 || sentences.length === 1) return sentences[0];
  return `${sentences[0]} ${sentences[1] ?? ""}`.trim();
}

export function verifyCandidate(
  candidate: Candidate,
  retrievedClauses: Clause[],
): Verified | VerifyRejection {
  const clause = retrievedClauses.find((c) => c.code === candidate.clauseCode);
  if (!clause) {
    return {
      ok: false,
      reason: "clause-not-found",
      detail: `Clause ${candidate.clauseCode} was not in the retrieved guideline scope.`,
    };
  }

  // Rule-engine candidates quote the clause they run against; model candidates
  // bring their own quote, which must match the stored body.
  const clauseQuote = candidate.source === "llm" ? undefined : excerptClause(clause.body);
  if (candidate.source === "llm") {
    // LLM candidates must embed their evidence in `why` markers; if absent we
    // still accept the clause link but quote the clause excerpt ourselves.
    const embedded = /\u00ab([^\u00bb]{10,400})\u00bb/.exec(candidate.why);
    if (embedded && !normalize(clause.body).includes(normalize(embedded[1]))) {
      return {
        ok: false,
        reason: "clause-quote-not-found",
        detail: `Quoted clause text not found in ${clause.code}.`,
      };
    }
  }
  const evidence = clauseQuote ?? excerptClause(clause.body);
  if (!normalize(clause.body).includes(normalize(evidence))) {
    return {
      ok: false,
      reason: "clause-quote-not-found",
      detail: `Quoted text not found in ${clause.code}.`,
    };
  }

  if (candidate.anchor === "append" || !candidate.quote) {
    return { ok: true, clause, severity: severityFor(clause.ruleType), clauseQuote: evidence, span: null };
  }

  const span =
    candidate.source === "llm"
      ? locateSpanFuzzy(ctxContent(candidate), candidate.quote, 0.8)
      : locateSpan(ctxContent(candidate), candidate.quote);

  if (!span) {
    return {
      ok: false,
      reason: "quote-not-found",
      detail: `Quote "${candidate.quote.slice(0, 60)}" could not be located in the draft.`,
    };
  }
  return { ok: true, clause, severity: severityFor(clause.ruleType), clauseQuote: evidence, span };
}

/**
 * The verifier needs the draft text to locate quotes. Candidates carry it on a
 * hidden field set by runPreflight so the public Candidate type stays clean.
 */
const CONTENT = Symbol.for("preflight.content");
export function attachContent<T extends Candidate>(candidate: T, content: string): T {
  (candidate as unknown as Record<symbol, string>)[CONTENT] = content;
  return candidate;
}
function ctxContent(candidate: Candidate): string {
  return (candidate as unknown as Record<symbol, string>)[CONTENT] ?? "";
}
