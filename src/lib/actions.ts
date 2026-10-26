import { randomUUID } from "node:crypto";
import { desc, eq, max } from "drizzle-orm";
import {
  comments,
  findings,
  guidelineVersions,
  revisions,
  reviews,
  workspaces,
} from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { logAudit, reviewAudit } from "@/lib/audit";
import { checkTransition } from "@/lib/workflow";
import { locateSpan } from "@/lib/engine/text";

export type Outcome = { ok: true; data?: Record<string, unknown> } | { ok: false; status: number; error: string };

async function loadReview(db: DB, reviewId: string) {
  const rows = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  return rows[0] ?? null;
}

async function loadWorkspace(db: DB, workspaceId: string) {
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  return rows[0] ?? null;
}

async function addRevision(
  db: DB,
  reviewId: string,
  content: string,
  summary: string,
  actor: string,
): Promise<void> {
  const rows = await db
    .select({ n: max(revisions.number) })
    .from(revisions)
    .where(eq(revisions.reviewId, reviewId));
  const next = (rows[0]?.n ?? 0) + 1;
  await db.insert(revisions).values({
    id: randomUUID(),
    reviewId,
    number: next,
    content,
    summary,
    createdBy: actor,
  });
}

/**
 * The human decides: accept (apply the suggestion), edit (apply own wording)
 * or dismiss (reason required). Nothing is ever applied automatically - this
 * function is the only path that mutates content on behalf of an AI suggestion.
 */
export async function decideFinding(
  db: DB,
  args: {
    findingId: string;
    decision: "accept" | "edit" | "dismiss";
    reason?: string;
    replacement?: string;
    actor: string;
    role: string;
  },
): Promise<Outcome> {
  const found = await db.select().from(findings).where(eq(findings.id, args.findingId));
  const finding = found[0];
  if (!finding) return { ok: false, status: 404, error: "Finding not found." };
  if (!["creator", "manager", "admin"].includes(args.role)) {
    return { ok: false, status: 403, error: "Authorised Reviewers are read-only on content and findings." };
  }
  if (finding.state !== "open") {
    return { ok: false, status: 409, error: `This finding was already ${finding.state}. Re-run preflight to refresh.` };
  }

  const review = await loadReview(db, finding.reviewId);
  if (!review) return { ok: false, status: 404, error: "Review not found." };
  if (["IN_REVIEW", "APPROVED", "PUBLISH_READY"].includes(review.status)) {
    return {
      ok: false,
      status: 409,
      error: `This review is ${review.status}; findings can only be changed during self-review.`,
    };
  }

  if (args.decision === "dismiss") {
    const reason = (args.reason ?? "").trim();
    if (reason.length < 4) {
      return { ok: false, status: 422, error: "A dismissal needs a reason (4+ characters) - it feeds guideline-gap analysis." };
    }
    await db
      .update(findings)
      .set({ state: "dismissed", decisionReason: reason, decidedBy: args.actor, decidedAt: new Date() })
      .where(eq(findings.id, finding.id));
    await logAudit(db, {
      workspaceId: review.workspaceId,
      reviewId: review.id,
      actor: args.actor,
      action: "finding.dismissed",
      detail: { findingId: finding.id, clauseCode: finding.clauseCode, severity: finding.severity, reason },
    });
    return { ok: true };
  }

  if (args.decision === "edit") {
    const replacement = (args.replacement ?? "").trim();
    if (!replacement) return { ok: false, status: 422, error: "Provide the replacement text to apply." };
    return applyTextChange(db, review, finding, replacement, args.actor, "edited", args.reason);
  }

  // accept -> apply the verified suggestion
  if (finding.suggestion === null || finding.suggestion === undefined) {
    return {
      ok: false,
      status: 422,
      error: "This finding has no safe automatic fix. Use edit to supply wording, or dismiss it with a reason.",
    };
  }
  return applyTextChange(db, review, finding, finding.suggestion, args.actor, "accepted", args.reason);
}

/** Applies a text change to the draft, anchored by the finding's verified quote. */
async function applyTextChange(
  db: DB,
  review: NonNullable<Awaited<ReturnType<typeof loadReview>>>,
  finding: typeof findings.$inferSelect,
  replacement: string,
  actor: string,
  state: "accepted" | "edited",
  reason?: string,
): Promise<Outcome> {
  let nextContent: string;

  // Findings with no quoted span ("append" findings) add text to the end.
  const isAppend = !finding.quote;

  if (isAppend) {
    if (!replacement.trim()) return { ok: false, status: 422, error: "Nothing to append." };
    nextContent = `${review.content.trimEnd()}\n\n${replacement.trim()}`;
  } else {
    const span = locateSpan(review.content, finding.quote as string);
    if (!span) {
      return {
        ok: false,
        status: 409,
        error: "The quoted text no longer exists in the draft - re-run preflight to refresh the findings.",
      };
    }
    nextContent = review.content.slice(0, span.start) + replacement + review.content.slice(span.end);
  }

  await db.update(reviews).set({ content: nextContent, updatedAt: new Date() }).where(eq(reviews.id, review.id));
  await db
    .update(findings)
    .set({
      state,
      editedText: replacement,
      decisionReason: reason ?? null,
      decidedBy: actor,
      decidedAt: new Date(),
    })
    .where(eq(findings.id, finding.id));
  await addRevision(
    db,
    review.id,
    nextContent,
    `${state === "accepted" ? "Applied" : "Edited"} suggestion from ${finding.clauseCode ?? "finding"}`,
    actor,
  );
  await logAudit(db, {
    workspaceId: review.workspaceId,
    reviewId: review.id,
    actor,
    action: `finding.${state}`,
    detail: { findingId: finding.id, clauseCode: finding.clauseCode, replacement: replacement.slice(0, 200) },
  });
  return { ok: true, data: { content: nextContent } };
}

/** Move a review through the approval state machine. */
export async function transitionReview(
  db: DB,
  args: { reviewId: string; actionKey: string; actor: string; role: string; reason?: string },
): Promise<Outcome> {
  const review = await loadReview(db, args.reviewId);
  if (!review) return { ok: false, status: 404, error: "Review not found." };
  const workspace = await loadWorkspace(db, review.workspaceId);
  if (!workspace) return { ok: false, status: 404, error: "Workspace not found." };

  const openFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.reviewId, review.id));
  const openBlockers = openFindings.filter((f) => f.state === "open" && f.isBlocker).length;

  const check = checkTransition({
    actionKey: args.actionKey,
    currentStatus: review.status,
    role: args.role,
    allowSelfApproval: workspace.allowSelfApproval,
    openBlockers,
  });
  if (!check.ok) return { ok: false, status: check.status, error: check.error };

  if (check.action.requiresReason && !(args.reason ?? "").trim()) {
    return { ok: false, status: 422, error: "A reason is required for this transition." };
  }

  const now = new Date();
  const patch: Partial<typeof reviews.$inferInsert> = {
    status: check.action.to,
    updatedAt: now,
  };
  if (check.action.key === "submit") patch.submittedAt = now;
  if (check.action.key === "approve") patch.decidedAt = now;
  if (check.action.key === "approve" || check.action.key === "mark_publish_ready") patch.approvedAt = now;

  await db.update(reviews).set(patch).where(eq(reviews.id, review.id));
  await logAudit(db, {
    workspaceId: review.workspaceId,
    reviewId: review.id,
    actor: args.actor,
    action: `status.${check.action.key}`,
    detail: { reason: args.reason ?? null, openBlockers },
    prevStatus: review.status,
    nextStatus: check.action.to,
  });
  return { ok: true, data: { status: check.action.to } };
}

export async function addComment(
  db: DB,
  args: { reviewId: string; findingId?: string | null; body: string; actor: string },
): Promise<Outcome> {
  const body = args.body.trim();
  if (!body) return { ok: false, status: 422, error: "Comment cannot be empty." };
  const review = await loadReview(db, args.reviewId);
  if (!review) return { ok: false, status: 404, error: "Review not found." };
  await db.insert(comments).values({
    id: randomUUID(),
    reviewId: args.reviewId,
    findingId: args.findingId ?? null,
    author: args.actor,
    body,
  });
  await logAudit(db, {
    workspaceId: review.workspaceId,
    reviewId: review.id,
    actor: args.actor,
    action: "comment.added",
    detail: { findingId: args.findingId ?? null, body: body.slice(0, 120) },
  });
  return { ok: true };
}

/** The publish handoff: approved content + an approval record with AI disclosure. */
export type ExportOutcome =
  | { ok: true; markdown: string; review: NonNullable<Awaited<ReturnType<typeof loadReview>>> }
  | { ok: false; status: number; error: string };

export async function buildExport(db: DB, reviewId: string): Promise<ExportOutcome> {
  const review = await loadReview(db, reviewId);
  if (!review) return { ok: false, status: 404, error: "Review not found." };
  const all = await db.select().from(findings).where(eq(findings.reviewId, reviewId));
  const audit = await reviewAudit(db, reviewId, 200);
  const guideRows = review.guidelineVersionId
    ? await db.select().from(guidelineVersions).where(eq(guidelineVersions.id, review.guidelineVersionId))
    : [];
  const guide = guideRows[0];
  const accepted = all.filter((f) => f.state === "accepted" || f.state === "edited");
  const dismissed = all.filter((f) => f.state === "dismissed");

  const lines = [
    `# Preflight approval record`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| Content | ${review.title} |`,
    `| Channel | ${review.channelKey} |`,
    `| Status | ${review.status} |`,
    `| Guideline version | ${guide ? `${guide.label} (${guide.sourceName})` : "n/a"} |`,
    `| Findings | ${all.length} total, ${accepted.length} fixed, ${dismissed.length} dismissed |`,
    `| Approved at | ${review.approvedAt?.toISOString() ?? "pending"} |`,
    ``,
    `## Approved content`,
    ``,
    review.content,
    ``,
    `## Decisions`,
    ...all.map(
      (f) =>
        `- **${f.severity.toUpperCase()} ${f.clauseCode ?? ""}** (${f.state}) — ${f.why}${
          f.decisionReason ? ` — reason: ${f.decisionReason}` : ""
        }`,
    ),
    ``,
    `## Sign-off chain`,
    ...audit
      .filter((a) => a.action.startsWith("status."))
      .map((a) => `- ${a.actor} — ${a.action.replace("status.", "")}: ${a.prevStatus} → ${a.nextStatus} @ ${a.createdAt.toISOString()}`),
    ``,
    `> AI-assisted review disclosure: findings were produced by Preflight's rule engine${
      review.engine?.mode === "rules+llm" ? ` with model assistance (${review.engine.model})` : " (model pass disabled for this workspace)"
    }. Every quote was checked against the source by a deterministic citation verifier (${review.engine?.rejected ?? 0} candidate(s) rejected). A human decided every change; nothing was auto-applied.`,
    ``,
    `Exported by Preflight — brand governance before publication.`,
  ];

  return { ok: true, markdown: lines.join("\n"), review };
}

export async function reviewRevisions(db: DB, reviewId: string) {
  return db
    .select()
    .from(revisions)
    .where(eq(revisions.reviewId, reviewId))
    .orderBy(desc(revisions.number));
}
