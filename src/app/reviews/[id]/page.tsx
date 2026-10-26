import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import {
  clauses,
  comments,
  findings,
  guidelineVersions,
  reviews,
  revisions,
  workspaces,
} from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { reviewAudit } from "@/lib/audit";
import { locateSpan } from "@/lib/engine/text";
import { FindingCard, type CommentView, type FindingView } from "@/components/FindingCard";
import { CommentBox } from "@/components/CommentBox";
import { WorkflowBar } from "@/components/WorkflowBar";
import { SeverityBadge, StatusPill } from "@/components/ui";
import { getPersonaFromCookie } from "@/lib/session";
import { ACTIONS, type Status } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const SEVERITY_ORDER: Record<string, number> = { blocker: 0, warn: 1, info: 2 };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await ensureDb();
  const persona = await getPersonaFromCookie();

  const review = (await db.select().from(reviews).where(eq(reviews.id, id)))[0];
  if (!review) notFound();

  const ws = (await db.select().from(workspaces).where(eq(workspaces.id, review.workspaceId)))[0];
  const findingRows = await db
    .select()
    .from(findings)
    .where(eq(findings.reviewId, id))
    .orderBy(asc(findings.seq));
  const commentRows = await db
    .select()
    .from(comments)
    .where(eq(comments.reviewId, id))
    .orderBy(asc(comments.createdAt));
  const revisionRows = await db
    .select()
    .from(revisions)
    .where(eq(revisions.reviewId, id))
    .orderBy(desc(revisions.number));
  const auditRows = await reviewAudit(db, id, 40);
  const clauseRows = review.guidelineVersionId
    ? await db
        .select()
        .from(clauses)
        .where(eq(clauses.guidelineVersionId, review.guidelineVersionId))
        .orderBy(asc(clauses.code))
    : [];
  const guide = review.guidelineVersionId
    ? ((
        await db
          .select()
          .from(guidelineVersions)
          .where(eq(guidelineVersions.id, review.guidelineVersionId))
      )[0] ?? null)
    : null;

  const clauseByCode = new Map(clauseRows.map((c) => [c.code, c]));
  const open = findingRows.filter((f) => f.state === "open");
  const resolved = findingRows.filter((f) => f.state !== "open");
  const openBlockers = open.filter((f) => f.isBlocker).length;

  const orderedOpen = [...open].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
      (a.quoteStart ?? 0) - (b.quoteStart ?? 0),
  );

  // Recompute spans at render time so highlights always match the current draft.
  const highlights = orderedOpen
    .map((f) => {
      if (!f.quote) return null;
      const span = locateSpan(review.content, f.quote);
      if (!span) return null;
      return { id: f.id, severity: f.severity, start: span.start, end: span.end };
    })
    .filter((h): h is { id: string; severity: string; start: number; end: number } => Boolean(h))
    .sort((a, b) => a.start - b.start);

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of highlights) {
    if (h.start < cursor) continue;
    if (h.start > cursor) segments.push(review.content.slice(cursor, h.start));
    segments.push(
      <a
        key={h.id}
        href={`#f-${h.id}`}
        className={
          h.severity === "blocker"
            ? "draft-mark"
            : h.severity === "warn"
              ? "draft-mark-warn"
              : "draft-mark-info"
        }
        title={`${h.severity} — jump to finding`}
      >
        {review.content.slice(h.start, h.end)}
      </a>,
    );
    cursor = h.end;
  }
  if (cursor < review.content.length) segments.push(review.content.slice(cursor));

  const legalActions = ACTIONS.filter(
    (a) => a.from.includes(review.status as Status) && a.roles.includes(persona.role),
  ).map((a) => ({ key: a.key, label: a.label, requiresReason: a.requiresReason }));

  const commentsView: CommentView[] = commentRows.map((c) => ({
    id: c.id,
    findingId: c.findingId,
    author: c.author,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  }));

  const engine = review.engine;
  const density = Math.round((findingRows.length / Math.max(1, review.content.split(/\s+/).length)) * 1000) / 10;

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={review.status} />
          <h1 className="text-xl font-semibold">{review.title}</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            {review.channelKey} · {review.contentType}
          </span>
          <span className="text-xs text-slate-500">
            created by {review.createdBy} · guideline {guide ? `${guide.label} v${guide.version}` : "n/a"}
          </span>
        </div>
        <div className="mt-4">
          <WorkflowBar
            reviewId={review.id}
            actions={legalActions}
            disabledHint={
              legalActions.length === 0
                ? `No actions available to ${persona.title} at status ${review.status}. Switch persona (top right) to continue the workflow.`
                : openBlockers > 0 && legalActions.some((a) => a.key === "submit")
                  ? `${openBlockers} blocker(s) must be accepted, edited or dismissed before this can be submitted.`
                  : null
            }
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="font-semibold">Draft under review</h2>
              <span className="text-xs text-slate-500">
                {review.content.length} chars · {open.length} open finding{open.length === 1 ? "" : "s"} ·{" "}
                <span className={openBlockers ? "font-semibold text-red-600" : "text-emerald-700"}>
                  {openBlockers} blocker{openBlockers === 1 ? "" : "s"}
                </span>
              </span>
            </div>
            <div className="prose-draft px-5 py-4 text-[15px]">{segments}</div>
            <p className="border-t border-line px-5 py-2 text-xs text-slate-500">
              Highlighted spans are linked to their finding. Underlines: red = blocker, amber = warn,
              blue = info.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Findings — humans decide</h2>
              <span className="text-xs text-slate-500">
                {resolved.length} resolved · {open.length} open
              </span>
            </div>

            {orderedOpen.map((f) => {
              const clause = f.clauseCode ? clauseByCode.get(f.clauseCode) : undefined;
              const view: FindingView = {
                id: f.id,
                seq: f.seq,
                checkGroup: f.checkGroup,
                severity: f.severity,
                ruleType: f.ruleType,
                clauseCode: f.clauseCode,
                clauseQuote: f.clauseQuote,
                why: f.why,
                quote: f.quote,
                suggestion: f.suggestion,
                diff: (f.diff ?? []) as FindingView["diff"],
                confidence: f.confidence,
                state: f.state,
                editedText: f.editedText,
                decisionReason: f.decisionReason,
                decidedBy: f.decidedBy,
                decidedAt: f.decidedAt?.toISOString() ?? null,
                isBlocker: f.isBlocker,
              };
              return (
                <FindingCard
                  key={f.id}
                  reviewId={review.id}
                  finding={view}
                  role={persona.role}
                  comments={commentsView}
                  clauseTitle={clause?.title}
                  clauseSection={clause?.section}
                />
              );
            })}

            {open.length === 0 && (
              <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-5 py-6 text-sm text-emerald-800">
                No open findings. Every blocker was resolved or explicitly waived — the review can move
                forward.
              </div>
            )}

            {resolved.length > 0 && (
              <details className="rounded-xl border border-line bg-white">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium">
                  Resolved findings ({resolved.length})
                </summary>
                <div className="space-y-3 border-t border-line p-4">
                  {resolved.map((f) => {
                    const clause = f.clauseCode ? clauseByCode.get(f.clauseCode) : undefined;
                    const view: FindingView = {
                      id: f.id,
                      seq: f.seq,
                      checkGroup: f.checkGroup,
                      severity: f.severity,
                      ruleType: f.ruleType,
                      clauseCode: f.clauseCode,
                      clauseQuote: f.clauseQuote,
                      why: f.why,
                      quote: f.quote,
                      suggestion: f.suggestion,
                      diff: (f.diff ?? []) as FindingView["diff"],
                      confidence: f.confidence,
                      state: f.state,
                      editedText: f.editedText,
                      decisionReason: f.decisionReason,
                      decidedBy: f.decidedBy,
                      decidedAt: f.decidedAt?.toISOString() ?? null,
                      isBlocker: f.isBlocker,
                    };
                    return (
                      <FindingCard
                        key={f.id}
                        reviewId={review.id}
                        finding={view}
                        role={persona.role}
                        comments={commentsView}
                        clauseTitle={clause?.title}
                        clauseSection={clause?.section}
                      />
                    );
                  })}
                </div>
              </details>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="font-semibold">Review gate</h2>
            <ul className="mt-2 space-y-1.5 text-slate-600">
              <li className="flex justify-between">
                <span>Open blockers</span>
                <span className={openBlockers ? "font-semibold text-red-600" : "text-emerald-700"}>
                  {openBlockers}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Open warns / info</span>
                <span>{open.filter((f) => !f.isBlocker).length}</span>
              </li>
              <li className="flex justify-between">
                <span>Single-person sign-off</span>
                <span>{ws?.allowSelfApproval ? "allowed" : "not allowed"}</span>
              </li>
              <li className="flex justify-between">
                <span>Findings per 100 words</span>
                <span>{density}</span>
              </li>
            </ul>
            <p className="mt-3 border-t border-line pt-2 text-xs text-slate-500">
              A creator cannot approve their own content. Switch to Ishita Rao (Content Manager) or
              Arjun Mehta (Authorised Reviewer) to sign off.
            </p>
          </section>

          <section className="rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="font-semibold">AI &amp; verification disclosure</h2>
            <ul className="mt-2 space-y-1 text-slate-600">
              <li>Engine mode: <strong>{engine?.mode ?? "unknown"}</strong></li>
              {engine?.model && <li>Model: {engine.model} via {engine.provider}</li>}
              <li>Candidate findings: {engine?.candidates ?? 0}</li>
              <li>Verified against sources: {engine?.verified ?? 0}</li>
              <li className={engine?.rejected ? "text-amber-700" : ""}>
                Rejected by the citation verifier: {engine?.rejected ?? 0}
              </li>
              <li>Last run: {engine?.ranAt ? new Date(engine.ranAt).toLocaleString() : "—"} ·{" "}
                {engine?.runMs ?? 0} ms</li>
            </ul>
            <p className="mt-3 border-t border-line pt-2 text-xs text-slate-500">
              No quote reaches you without being located in the draft and matched to its clause. No
              suggestion is ever applied without an explicit human accept.
            </p>
          </section>

          <section className="rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="font-semibold">Thread</h2>
            <div className="mt-2 space-y-2">
              {commentsView.filter((c) => !c.findingId).map((c) => (
                <div key={c.id} className="rounded-md bg-slate-50 p-2 text-xs">
                  <span className="font-semibold">{c.author}</span>{" "}
                  <span className="text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                  <p className="text-slate-700">{c.body}</p>
                </div>
              ))}
              {commentsView.filter((c) => !c.findingId).length === 0 && (
                <p className="text-xs text-slate-500">No review-level comments yet.</p>
              )}
            </div>
            <div className="mt-3">
              <CommentBox reviewId={review.id} />
            </div>
          </section>

          <section className="rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="font-semibold">Revisions</h2>
            <ol className="mt-2 space-y-1 text-slate-600">
              {revisionRows.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">#{r.number}</span> {r.summary}{" "}
                  <span className="text-xs text-slate-400">by {r.createdBy}</span>
                </li>
              ))}
              {revisionRows.length === 0 && <li className="text-xs text-slate-500">No edits yet.</li>}
            </ol>
          </section>

          <section className="rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="font-semibold">Audit log (append-only)</h2>
            <ol className="mt-2 space-y-1.5">
              {auditRows.map((a) => (
                <li key={a.id} className="text-xs">
                  <span className="text-slate-400">{a.createdAt.toLocaleTimeString()}</span>{" "}
                  <span className="font-medium">{a.actor}</span> {a.action.replace(/\./g, " ")}
                  {a.prevStatus && a.nextStatus && (
                    <span className="text-slate-500">
                      {" "}
                      ({a.prevStatus} → {a.nextStatus})
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-2 border-t border-line pt-2 text-xs text-slate-500">
              Every state change records actor, time, guideline version and reason.
            </p>
          </section>

          <section className="rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="font-semibold">Cited clauses</h2>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {[...new Set(findingRows.map((f) => f.clauseCode).filter(Boolean))].map((code) => {
                const c = clauseByCode.get(code as string);
                return (
                  <li key={code as string}>
                    <Link href="/knowledge" className="font-mono text-accent hover:underline">
                      {code}
                    </Link>{" "}
                    {c ? `— ${c.title}` : "(clause no longer in this version)"}
                  </li>
                );
              })}
              {[...new Set(findingRows.map((f) => f.clauseCode).filter(Boolean))].length === 0 && (
                <li className="text-slate-500">No clauses cited yet.</li>
              )}
            </ul>
          </section>
        </aside>
      </div>

      <p className="text-xs text-slate-500">
        Severity comes from the rule type: policy → blocker, style → warn, preference → info.{" "}
        {findingRows.some((f) => f.confidence === "low") && (
          <>
            <SeverityBadge severity="info" /> Low-confidence findings are labelled judgement calls and
            never shown as errors.
          </>
        )}
      </p>
    </div>
  );
}
