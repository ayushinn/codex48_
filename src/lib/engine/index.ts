import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  clauses,
  facts,
  findings,
  guidelineVersions,
  reviews,
  terms,
  toneExamples,
  channels,
  workspaces,
  type Clause,
} from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildCtx, runRuleChecks, type Candidate, type ImageMeta } from "./checks";
import { attachContent, verifyCandidate, type VerifyRejection } from "./verify";
import { aiConfigured, runLlmReview, spendState } from "./llm";
import { normalize, wordDiff } from "./text";

export type PreflightSummary = {
  reviewId: string;
  status: string;
  candidates: number;
  findings: number;
  blockers: number;
  warns: number;
  infos: number;
  carried: number;
  removed: number;
  rejections: VerifyRejection[];
  engine: {
    mode: "rules+llm" | "rules-only";
    provider?: string;
    model?: string;
    candidates: number;
    verified: number;
    rejected: number;
    llmFindings: number;
    runMs: number;
    ranAt: string;
  };
};

/** Latest guideline version for the workspace. */
export async function latestGuideline(db: DB, workspaceId: string) {
  const rows = await db
    .select()
    .from(guidelineVersions)
    .where(eq(guidelineVersions.workspaceId, workspaceId))
    .orderBy(desc(guidelineVersions.version))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Run preflight on a review: retrieve scope -> rule checks -> optional model
 * pass -> deterministic citation verifier -> reconcile with existing findings.
 *
 * Findings the human already decided (accepted / edited / dismissed) are kept
 * when their quoted span still exists in the draft; open findings are replaced.
 */
export async function runPreflight(
  db: DB,
  reviewId: string,
  opts: { actor: string },
): Promise<PreflightSummary> {
  const started = Date.now();
  const reviewRows = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  const review = reviewRows[0];
  if (!review) throw new Error(`Review ${reviewId} not found`);

  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, review.workspaceId));
  const workspace = wsRows[0];
  if (!workspace) throw new Error("Workspace not found");

  const guide = await latestGuideline(db, review.workspaceId);
  if (!guide) throw new Error("No guideline version imported yet");

  // --- Retrieval-first scoping -----------------------------------------
  const allClauses = await db
    .select()
    .from(clauses)
    .where(eq(clauses.guidelineVersionId, guide.id))
    .orderBy(asc(clauses.code));
  const scoped = allClauses.filter((c) => !c.channel || c.channel === review.channelKey);

  const termRows = await db.select().from(terms).where(eq(terms.workspaceId, review.workspaceId));
  const factRows = await db.select().from(facts).where(eq(facts.workspaceId, review.workspaceId));
  const toneRows = await db
    .select()
    .from(toneExamples)
    .where(eq(toneExamples.workspaceId, review.workspaceId));
  const channelRows = await db
    .select()
    .from(channels)
    .where(eq(channels.workspaceId, review.workspaceId));
  const channel = channelRows.find((c) => c.key === review.channelKey) ?? channelRows[0];

  const ctx = buildCtx({
    content: review.content,
    channel,
    clauses: scoped,
    terms: termRows,
    facts: factRows,
    toneExamples: toneRows,
    images: (review.images ?? []) as unknown as ImageMeta[],
    palette: (workspace.palette ?? []) as string[],
  });

  // --- Candidate generation --------------------------------------------
  const ruleCandidates = runRuleChecks(ctx).map((c) => attachContent(c, review.content));

  let llmFindings: Awaited<ReturnType<typeof runLlmReview>> = null;
  if (aiConfigured()) {
    llmFindings = await runLlmReview({
      content: review.content,
      channel: channel.name,
      clauses: scoped.map((c) => ({ code: c.code, section: c.section, title: c.title, body: c.body })),
      terms: termRows.map((t) => ({ term: t.term, kind: t.kind, replacement: t.replacement ?? undefined })),
      facts: factRows.map((f) => ({ claim: f.claim, source: f.source })),
    });
  }

  const llmCandidates: Candidate[] = (llmFindings?.findings ?? [])
    .map((f) =>
      attachContent(
        {
          checkGroup: "ai-review",
          clauseCode: f.clauseCode,
          why: f.clauseQuote ? `${f.why} \u00ab${f.clauseQuote}\u00bb` : f.why,
          quote: f.quote,
          suggestion: f.suggestion,
          confidence: f.confidence ?? "medium",
          source: "llm",
        } as Candidate,
        review.content,
      ),
    )
    .filter((c) => c.quote !== undefined && c.quote.length > 0);

  const candidates = [...ruleCandidates, ...llmCandidates];

  // --- Verification gate ------------------------------------------------
  const verified: {
    candidate: Candidate;
    clause: Clause;
    severity: "blocker" | "warn" | "info";
    clauseQuote: string;
    span: { start: number; end: number } | null;
  }[] = [];
  const rejections: VerifyRejection[] = [];

  for (const candidate of candidates) {
    const result = verifyCandidate(candidate, scoped);
    if (result.ok) {
      const key = `${result.clause.code}::${normalize(candidate.quote ?? "append")}`;
      if (verified.some((v) => `${v.clause.code}::${normalize(v.candidate.quote ?? "append")}` === key)) {
        rejections.push({ ok: false, reason: "quote-not-found", detail: "duplicate candidate suppressed" });
        continue;
      }
      verified.push({ candidate, clause: result.clause, severity: result.severity, clauseQuote: result.clauseQuote, span: result.span });
    } else {
      rejections.push(result);
    }
  }

  // --- Reconcile with existing findings ---------------------------------
  const existing = await db.select().from(findings).where(eq(findings.reviewId, review.id));
  const openExisting = existing.filter((f) => f.state === "open");
  const decidedExisting = existing.filter((f) => f.state !== "open");

  let removed = 0;
  for (const decided of decidedExisting) {
    const stillPresent = decided.quote ? review.content.includes(decided.quote) : true;
    if (!stillPresent) {
      await db.delete(findings).where(eq(findings.id, decided.id));
      removed++;
    }
  }

  const survivors = (await db.select().from(findings).where(eq(findings.reviewId, review.id))).filter(
    (f) => f.state !== "open",
  );

  // Open findings are replaced wholesale: delete them before inserting the fresh set.
  // Inserting first would leave the previous run's open row in place, so every re-run
  // would add a second row for the same clause+quote (and its stale "why").
  for (const f of openExisting) {
    await db.delete(findings).where(eq(findings.id, f.id));
  }

  let carried = 0;
  let seq = survivors.length;
  for (const v of verified) {
    const key = `${v.clause.code}::${normalize(v.candidate.quote ?? "append")}`;
    const alreadyDecided = survivors.find(
      (f) => `${f.clauseCode}::${normalize(f.quote ?? "append")}` === key,
    );
    if (alreadyDecided) {
      carried++;
      continue;
    }
    seq++;
    await db.insert(findings).values({
      id: randomUUID(),
      reviewId: review.id,
      seq,
      checkGroup: v.candidate.checkGroup,
      severity: v.severity,
      ruleType: v.clause.ruleType,
      clauseId: v.clause.id,
      clauseCode: v.clause.code,
      clauseQuote: v.clauseQuote,
      why: v.candidate.why,
      quote: v.candidate.quote ?? null,
      quoteStart: v.span?.start ?? null,
      quoteEnd: v.span?.end ?? null,
      suggestion: v.candidate.suggestion ?? null,
      diff: buildDiff(v.candidate, v.span, review.content),
      confidence: v.candidate.confidence ?? "high",
      verifier: "verified",
      isBlocker: v.severity === "blocker",
    });
  }

  const engine = {
    mode: (aiConfigured() && llmFindings ? "rules+llm" : "rules-only") as "rules+llm" | "rules-only",
    provider: llmFindings?.provider,
    model: llmFindings?.model,
    candidates: candidates.length,
    verified: verified.length,
    rejected: rejections.length,
    llmFindings: llmFindings?.findings.length ?? 0,
    runMs: Date.now() - started,
    ranAt: new Date().toISOString(),
  };

  const nextStatus = review.status === "DRAFT" ? "SELF_REVIEW" : review.status;
  await db
    .update(reviews)
    .set({ engine, status: nextStatus, guidelineVersionId: guide.id, updatedAt: new Date() })
    .where(eq(reviews.id, review.id));

  await logAudit(db, {
    workspaceId: review.workspaceId,
    reviewId: review.id,
    actor: opts.actor,
    action: "preflight.run",
    detail: {
      mode: engine.mode,
      candidates: engine.candidates,
      verified: engine.verified,
      rejected: engine.rejected,
      guidelineVersion: guide.version,
      runMs: engine.runMs,
      aiConfigured: aiConfigured(),
      spend: spendState(),
    },
    prevStatus: review.status,
    nextStatus,
  });

  const finalFindings = await db
    .select()
    .from(findings)
    .where(and(eq(findings.reviewId, review.id), eq(findings.state, "open")));

  return {
    reviewId: review.id,
    status: nextStatus,
    candidates: candidates.length,
    findings: finalFindings.length,
    blockers: finalFindings.filter((f) => f.severity === "blocker").length,
    warns: finalFindings.filter((f) => f.severity === "warn").length,
    infos: finalFindings.filter((f) => f.severity === "info").length,
    carried,
    removed,
    rejections,
    engine,
  };
}

function buildDiff(
  candidate: Candidate,
  span: { start: number; end: number } | null,
  content: string,
): { op: "keep" | "del" | "ins"; text: string }[] {
  if (candidate.anchor === "append") {
    return candidate.suggestion
      ? [
          { op: "ins" as const, text: ` ${candidate.suggestion}` },
        ]
      : [];
  }
  if (!span) return [];
  const before = content.slice(span.start, span.end);
  const after = candidate.suggestion ?? "";
  if (after === "") return [{ op: "del" as const, text: before }];
  if (after === before) return [{ op: "keep" as const, text: before }];
  return wordDiff(before, after);
}
