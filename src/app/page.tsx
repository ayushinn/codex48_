import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { findings, reviews, workspaces } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { SeverityBadge, Stat, StatusPill } from "@/components/ui";
import { getPersonaFromCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { db, mode } = await ensureDb();
  const persona = await getPersonaFromCookie();
  const ws = (await db.select().from(workspaces))[0] ?? null;
  const reviewRows = await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  const findingRows = await db.select().from(findings);

  const byReview = new Map<string, typeof findingRows>();
  for (const f of findingRows) {
    const list = byReview.get(f.reviewId) ?? [];
    list.push(f);
    byReview.set(f.reviewId, list);
  }

  const open = findingRows.filter((f) => f.state === "open");
  const openBlockers = open.filter((f) => f.isBlocker).length;
  const rejected = reviewRows.reduce((sum, r) => sum + (r.engine?.rejected ?? 0), 0);
  const decided = findingRows.filter((f) => f.state !== "open");
  const dismissals = decided.filter((f) => f.state === "dismissed");
  const approvals = reviewRows.filter((r) => ["APPROVED", "PUBLISH_READY"].includes(r.status));

  const waiting = reviewRows.filter((r) => r.status === "READY_FOR_REVIEW" || r.status === "IN_REVIEW");

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-line bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Brand governance before publication
        </p>
        <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-snug sm:text-3xl">
          Content goes in. It is checked against {ws?.name ?? "your"}&rsquo;s own guidelines, approved
          facts and terminology. Every issue quotes the clause it breaks. A human decides.
        </h1>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/reviews/new"
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            New review →
          </Link>
          <Link
            href="/reviews/r-social"
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium hover:border-slate-400"
          >
            Open the flagged sample draft
          </Link>
          <Link
            href="/knowledge"
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium hover:border-slate-400"
          >
            View the brand book
          </Link>
        </div>
        <ol className="mt-6 grid gap-3 border-t border-line pt-5 text-sm text-slate-600 sm:grid-cols-4">
          {[
            "Paste or upload content, pick a channel",
            "Preflight checks it against your clauses and registries",
            "Findings arrive with the verbatim clause, a why and a diff",
            "You accept, edit or dismiss — then a manager signs off",
          ].map((step, i) => (
            <li key={step} className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Reviews in flight"
          value={reviewRows.length}
          hint={`${waiting.length} waiting on a reviewer`}
        />
        <Stat
          label="Open blockers"
          value={openBlockers}
          hint="Gate to submission until resolved or waived"
        />
        <Stat
          label="Decisions made"
          value={decided.length}
          hint={`${dismissals.length} dismissed with reasons`}
        />
        <Stat
          label="Citation rejections"
          value={rejected}
          hint="Unverifiable quotes stopped before display"
        />
      </section>

      <section className="rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">Reviews</h2>
          <span className="text-xs text-slate-500">
            Acting as {persona.name} · {persona.title} · DB: {mode}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2 font-medium">Content</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Open findings</th>
                <th className="px-3 py-2 font-medium">Engine</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {reviewRows.map((r) => {
                const list = byReview.get(r.id) ?? [];
                const openList = list.filter((f) => f.state === "open");
                const counts = {
                  blocker: openList.filter((f) => f.severity === "blocker").length,
                  warn: openList.filter((f) => f.severity === "warn").length,
                  info: openList.filter((f) => f.severity === "info").length,
                };
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/reviews/${r.id}`} className="font-medium text-ink hover:underline">
                        {r.title}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        by {r.createdBy} · {r.contentType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{r.channelKey}</td>
                    <td className="px-3 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-3">
                      {openList.length === 0 ? (
                        <span className="text-xs text-emerald-700">clear</span>
                      ) : (
                        <span className="flex gap-1">
                          {counts.blocker > 0 && <SeverityBadge severity="blocker" />}
                          {counts.warn > 0 && <SeverityBadge severity="warn" />}
                          {counts.info > 0 && <SeverityBadge severity="info" />}
                          <span className="ml-1 text-xs text-slate-500">{openList.length}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {r.engine?.mode ?? "—"}
                      {r.engine?.rejected ? ` · ${r.engine.rejected} rejected` : ""}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/reviews/${r.id}`} className="text-accent hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {reviewRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No reviews yet —{" "}
                    <Link href="/reviews/new" className="text-accent underline">
                      run your first preflight
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/insights" className="rounded-xl border border-line bg-white p-5 hover:border-slate-400">
          <h3 className="font-semibold">Insights</h3>
          <p className="mt-1 text-sm text-slate-600">
            Recurring issues, dismissal clusters and cycle times — including where the brand book itself
            is unclear.
          </p>
          <p className="mt-3 text-sm text-accent">Open dashboard →</p>
        </Link>
        <Link href="/knowledge" className="rounded-xl border border-line bg-white p-5 hover:border-slate-400">
          <h3 className="font-semibold">Knowledge base</h3>
          <p className="mt-1 text-sm text-slate-600">
            {ws?.name} brand book, terminology, approved facts and channels — versioned, and cited by
            every finding.
          </p>
          <p className="mt-3 text-sm text-accent">Open knowledge base →</p>
        </Link>
        <Link href="/settings" className="rounded-xl border border-line bg-white p-5 hover:border-slate-400">
          <h3 className="font-semibold">Roles &amp; settings</h3>
          <p className="mt-1 text-sm text-slate-600">
            Single-person sign-off, review permissions and workspace configuration.
          </p>
          <p className="mt-3 text-sm text-accent">Open settings →</p>
        </Link>
      </section>
      <p className="text-xs text-slate-500">
        {approvals.length} piece(s) approved · {approvals.length} exportable · guidance is in-product, no
        walkthrough needed.
      </p>
    </div>
  );
}
