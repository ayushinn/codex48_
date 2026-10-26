import { asc, desc, eq } from "drizzle-orm";
import { channels, clauses, facts, guidelineVersions, terms, toneExamples, workspaces } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { KnowledgeForms } from "@/components/KnowledgeForms";
import { getPersonaFromCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

const GROUP_LABEL: Record<string, string> = {
  tone: "Tone",
  terminology: "Terminology",
  messaging: "Messaging",
  facts: "Facts & claims",
  accessibility: "Accessibility",
  channel: "Channel rules",
};

export default async function KnowledgePage() {
  const { db } = await ensureDb();
  const persona = await getPersonaFromCookie();
  const ws = (await db.select().from(workspaces))[0];

  const versions = ws
    ? await db
        .select()
        .from(guidelineVersions)
        .where(eq(guidelineVersions.workspaceId, ws.id))
        .orderBy(desc(guidelineVersions.version))
    : [];
  const current = versions[0];

  const clauseRows = current
    ? await db.select().from(clauses).where(eq(clauses.guidelineVersionId, current.id)).orderBy(asc(clauses.code))
    : [];
  const termRows = ws ? await db.select().from(terms).where(eq(terms.workspaceId, ws.id)) : [];
  const factRows = ws ? await db.select().from(facts).where(eq(facts.workspaceId, ws.id)) : [];
  const toneRows = ws ? await db.select().from(toneExamples).where(eq(toneExamples.workspaceId, ws.id)) : [];
  const channelRows = ws ? await db.select().from(channels).where(eq(channels.workspaceId, ws.id)) : [];

  const groupsPresent = new Set(clauseRows.map((c) => c.checkGroup));
  const ALL_GROUPS = ["tone", "terminology", "messaging", "facts", "accessibility", "channel"];
  const idleGroups = ALL_GROUPS.filter((g) => !groupsPresent.has(g));
  const canEdit = ["admin", "manager"].includes(persona.role);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Knowledge base</h1>
          {current && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {current.label} · v{current.version} · {current.sourceName}
            </span>
          )}
          <span className="text-xs text-slate-500">
            Acting as {persona.name} ({persona.title})
            {!canEdit && " — switch to Admin/Manager to edit"}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {ws?.name} brand book. Every finding in Preflight cites one of these clauses verbatim with its
          code and version, so a reviewer can click through to the rule that was broken.
        </p>
        {versions.length > 1 && (
          <p className="mt-2 text-sm text-slate-600">
            Versions:{" "}
            {versions
              .map((v) => `v${v.version} ${v.label} (${v.sourceName})`)
              .join(" · ")}{" "}
            — reviews cite the version that existed when they ran.
          </p>
        )}
        {idleGroups.length > 0 && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Checks idle for lack of a clause: {idleGroups.map((g) => GROUP_LABEL[g] ?? g).join(", ")}.
            Preflight only ever cites a clause it actually retrieved, so groups missing from the guide do
            not run.
          </p>
        )}
      </header>

      <KnowledgeForms canEdit={canEdit} />

      <section className="rounded-xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Guideline clauses ({clauseRows.length})</h2>
        <div className="divide-y divide-line">
          {clauseRows.map((c) => (
            <article key={c.id} className="px-5 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent">{c.code}</span>
                <span className="font-medium">{c.title}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-slate-600">
                  {c.ruleType}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                  {GROUP_LABEL[c.checkGroup] ?? c.checkGroup}
                </span>
                {c.channel && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {c.channel} only
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs uppercase tracking-wide text-slate-400">{c.section}</p>
              <p className="mt-1 max-w-4xl leading-relaxed text-slate-700">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 font-semibold">
            Terminology ({termRows.length})
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {termRows.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-2">
                    <span className="font-medium">{t.term}</span>
                    {t.note && <span className="block text-xs text-slate-500">{t.note}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 uppercase tracking-wide text-slate-600">
                      {t.kind.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right text-xs text-slate-600">
                    {t.replacement ? `→ ${t.replacement}` : "no replacement"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 font-semibold">
            Approved facts registry ({factRows.length})
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {factRows.map((f) => (
                <tr key={f.id} className="border-b border-line align-top last:border-0">
                  <td className="px-5 py-2">
                    <span className="text-slate-800">{f.claim}</span>
                    <span className="block text-xs text-slate-500">{f.source}</span>
                  </td>
                  <td className="px-5 py-2 text-right text-xs text-slate-500">reviewed {f.reviewDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Channels</h2>
          <ul className="divide-y divide-line text-sm">
            {channelRows.map((c) => (
              <li key={c.id} className="px-5 py-2.5">
                <span className="font-medium">{c.name}</span>{" "}
                <span className="font-mono text-xs text-slate-500">({c.key})</span>
                <span className="block text-xs text-slate-600">
                  {c.maxChars ? `max ${c.maxChars} chars` : ""}
                  {c.minWords ? ` · min ${c.minWords} words` : ""}
                  {(c.rules as { maxHashtags?: number }).maxHashtags
                    ? ` · max ${(c.rules as { maxHashtags?: number }).maxHashtags} hashtags`
                    : ""}
                  {(c.rules as { subjectLine?: boolean }).subjectLine ? " · subject line rules" : ""}
                  {(c.rules as { requiredPhrases?: string[] }).requiredPhrases?.length
                    ? ` · must include "${((c.rules as { requiredPhrases?: string[] }).requiredPhrases ?? []).join('", "')}"`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Tone profile</h2>
          <ul className="divide-y divide-line text-sm">
            {toneRows.map((t) => (
              <li key={t.id} className="px-5 py-2.5">
                <span
                  className={`mb-1 block rounded px-2 py-1 text-xs ${
                    t.kind === "good" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                  }`}
                >
                  {t.kind === "good" ? "✓ good example" : "✕ bad example"}: {t.text}
                </span>
                {t.note && <span className="text-xs text-slate-500">{t.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
