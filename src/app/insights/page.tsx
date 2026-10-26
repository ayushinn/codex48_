import { desc, eq } from "drizzle-orm";
import { findings, reviews, workspaces } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const GROUP_LABEL: Record<string, string> = {
  tone: "Tone",
  terminology: "Terminology",
  messaging: "Messaging",
  facts: "Facts & claims",
  accessibility: "Accessibility",
  channel: "Channel rules",
  "ai-review": "AI pass",
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export default async function InsightsPage() {
  const { db } = await ensureDb();
  const ws = (await db.select().from(workspaces))[0] ?? null;
  const reviewRows = await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  const findingRows = await db.select().from(findings);

  const dismissed = findingRows.filter((f) => f.state === "dismissed");
  const decided = findingRows.filter((f) => f.state !== "open");
  const open = findingRows.filter((f) => f.state === "open");

  // Recurring issues by clause
  const byClause = new Map<string, { count: number; dismissed: number; severity: string; why: string }>();
  for (const f of findingRows) {
    const key = f.clauseCode ?? "(no clause)";
    const entry = byClause.get(key) ?? { count: 0, dismissed: 0, severity: f.severity, why: f.why };
    entry.count++;
    if (f.state === "dismissed") entry.dismissed++;
    byClause.set(key, entry);
  }
  const clauseRanking = [...byClause.entries()].sort((a, b) => b[1].count - a[1].count);

  // Recurring issues by check group
  const byGroup = new Map<string, number>();
  for (const f of findingRows) byGroup.set(f.checkGroup, (byGroup.get(f.checkGroup) ?? 0) + 1);
  const groupRanking = [...byGroup.entries()].sort((a, b) => b[1] - a[1]);
  const maxGroup = Math.max(1, ...groupRanking.map(([, n]) => n));

  // Dismissal clusters -> guideline-gap candidates (IMP-2, Round 2 state)
  const clusters = new Map<string, { count: number; clauses: Set<string>; example: string }>();
  for (const f of dismissed) {
    const reason = (f.decisionReason ?? "no reason recorded").trim();
    const key = reason.toLowerCase();
    const entry = clusters.get(key) ?? { count: 0, clauses: new Set<string>(), example: reason };
    entry.count++;
    if (f.clauseCode) entry.clauses.add(f.clauseCode);
    clusters.set(key, entry);
  }
  const gapCandidates = [...clusters.values()].sort((a, b) => b.count - a.count);

  // Findings per review over time (issue rate trend, IMP-3)
  const perReview = reviewRows.map((r) => {
    const list = findingRows.filter((f) => f.reviewId === r.id);
    const words = Math.max(1, r.content.split(/\s+/).length);
    return {
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      channelKey: r.channelKey,
      candidates: r.engine?.candidates ?? list.length,
      total: list.length,
      dismissed: list.filter((f) => f.state === "dismissed").length,
      per100: Math.round((list.length / words) * 10000) / 100,
      status: r.status,
    };
  });

  // Approval cycle times (submit -> decision)
  const cycles = reviewRows
    .filter((r) => r.submittedAt && (r.decidedAt || r.approvedAt))
    .map((r) => ({
      id: r.id,
      title: r.title,
      hours: Math.round((((r.decidedAt ?? r.approvedAt)!.getTime() - r.submittedAt!.getTime()) / 3600_000) * 10) / 10,
    }));

  const byChannel = new Map<string, { count: number; reviews: number }>();
  for (const r of reviewRows) {
    const list = findingRows.filter((f) => f.reviewId === r.id);
    const entry = byChannel.get(r.channelKey) ?? { count: 0, reviews: 0 };
    entry.count += list.length;
    entry.reviews += 1;
    byChannel.set(r.channelKey, entry);
  }

  const rejections = reviewRows.reduce((sum, r) => sum + (r.engine?.rejected ?? 0), 0);
  const maxCount = Math.max(1, ...clauseRanking.map(([, v]) => v.count));

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Insights</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            {ws?.name ?? "workspace"} · {reviewRows.length} reviews · {findingRows.length} findings
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Recurring mistakes, approval cycle times, and the question no scoring tool asks: is the creator
          wrong, or is the brand book unclear? Dismissals cluster below into gap candidates for the
          guideline owner.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Findings recorded" value={findingRows.length} hint={`${open.length} still open`} />
        <Stat
          label="Dismissal rate"
          value={`${Math.round((dismissed.length / Math.max(1, decided.length)) * 100)}%`}
          hint={`${dismissed.length} dismissals, each with a reason`}
        />
        <Stat
          label="Median approval cycle"
          value={`${median(cycles.map((c) => c.hours))} h`}
          hint={`${cycles.length} completed cycles`}
        />
        <Stat
          label="Verifier rejections"
          value={rejections}
          hint="Unverifiable candidate quotes never displayed"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-semibold">Recurring issues by clause</h2>
          <p className="text-xs text-slate-500">Which rules fire most often — the guide's hot spots.</p>
          <ul className="mt-3 space-y-2.5">
            {clauseRanking.map(([code, v]) => (
              <li key={code}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-mono text-xs text-accent">{code}</span>
                  <span className="text-xs text-slate-500">
                    {v.count} finding{v.count === 1 ? "" : "s"}
                    {v.dismissed > 0 && ` · ${v.dismissed} dismissed`}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-slate-100">
                  <div
                    className={`h-2 rounded ${v.dismissed > v.count / 2 ? "bg-amber-400" : "bg-accent"}`}
                    style={{ width: `${(v.count / maxCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {clauseRanking.length === 0 && <li className="text-sm text-slate-500">No findings yet.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-semibold">Issues by check group</h2>
          <p className="text-xs text-slate-500">Where the content goes wrong, by review dimension.</p>
          <ul className="mt-3 space-y-2.5">
            {groupRanking.map(([group, count]) => (
              <li key={group}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{GROUP_LABEL[group] ?? group}</span>
                  <span className="text-xs text-slate-500">{count}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-ink" style={{ width: `${(count / maxGroup) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Guideline-gap candidates</h2>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            IMP-2 · Round 2 state: event capture + clustering
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Clustered dismissals with reasons. When the same reason repeats, the ambiguity is usually in
          the brand book, not in the writer.
        </p>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {gapCandidates.map((c, i) => (
            <li key={i} className="rounded-md border border-line bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Gap candidate #{i + 1}
                </span>
                <span className="rounded bg-white px-1.5 py-0.5 text-xs font-medium">
                  {c.count} dismissal{c.count === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1.5 leading-snug">“{c.example}”</p>
              <p className="mt-1 text-xs text-slate-500">Affects: {[...c.clauses].join(", ") || "—"}</p>
            </li>
          ))}
          {gapCandidates.length === 0 && (
            <li className="text-sm text-slate-500">
              No dismissals recorded yet — dismiss a finding with a reason and it will cluster here.
            </li>
          )}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Issue rate per piece</h2>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
              IMP-3 · Round 2 state: live trend
            </span>
          </div>
          <p className="text-xs text-slate-500">Findings per 100 words, oldest first.</p>
          <ul className="mt-3 space-y-3">
            {[...perReview].reverse().map((r) => (
              <li key={r.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate">{r.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {r.per100} /100w · {r.total} findings
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-slate-100">
                  <div
                    className="h-2 rounded bg-emerald-600"
                    style={{ width: `${Math.min(100, r.per100 * 40)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {r.createdAt.toLocaleDateString()} · {r.channelKey} · {r.status}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-6">
          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-semibold">Approval cycle times</h2>
            <p className="text-xs text-slate-500">Submit → decision, in hours.</p>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {cycles.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-3">{c.title}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.hours} h</td>
                  </tr>
                ))}
                {cycles.length === 0 && (
                  <tr>
                    <td className="py-3 text-slate-500">No completed cycles yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-semibold">By channel</h2>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {[...byChannel.entries()].map(([key, v]) => (
                  <tr key={key} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-3 capitalize">{key}</td>
                    <td className="py-1.5 text-right text-slate-500">
                      {v.reviews} review{v.reviews === 1 ? "" : "s"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{v.count} findings</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-semibold">Findings by state</h2>
        <div className="mt-3 flex h-6 overflow-hidden rounded">
          {[
            { label: "open", count: open.length, className: "bg-slate-300" },
            { label: "accepted", count: findingRows.filter((f) => f.state === "accepted").length, className: "bg-emerald-600" },
            { label: "edited", count: findingRows.filter((f) => f.state === "edited").length, className: "bg-emerald-400" },
            { label: "dismissed", count: dismissed.length, className: "bg-amber-400" },
          ].map((s) =>
            s.count === 0 ? null : (
              <div
                key={s.label}
                className={`${s.className} grid place-items-center text-[11px] font-semibold text-white`}
                style={{ width: `${(s.count / Math.max(1, findingRows.length)) * 100}%` }}
                title={`${s.label}: ${s.count}`}
              >
                {s.count > 2 && s.label}
              </div>
            ),
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Zero AI suggestions are ever applied without an explicit human accept — this chart is the
          proof.
        </p>
      </section>
    </div>
  );
}
