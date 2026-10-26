import { desc } from "drizzle-orm";
import { auditLog, workspaces } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { getPersonaFromCookie } from "@/lib/session";
import { PERSONAS } from "@/lib/personas";
import { SelfApprovalToggle } from "@/components/SelfApprovalToggle";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { db, mode } = await ensureDb();
  const persona = await getPersonaFromCookie();
  const ws = (await db.select().from(workspaces))[0] ?? null;
  const recent = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(25);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-xl border border-line bg-white p-5">
        <h1 className="text-xl font-semibold">Workspace settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Acting as <strong>{persona.name}</strong> ({persona.title}). Round 2 ships without sign-in: the
          persona switcher is how a judge plays each role, while permissions themselves are enforced
          server-side by the state machine below.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Roles</h2>
        <ul className="mt-3 space-y-3">
          {PERSONAS.map((p) => (
            <li key={p.key} className="rounded-md border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600">
                  {p.role}
                </span>
              </div>
              <p className="mt-1 text-slate-600">{p.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Sign-off policy</h2>
        <p className="mt-1 text-slate-600">
          Single-person sign-off is off by default: a creator cannot approve their own content. The
          honest configuration for a team of one is available as an explicit, audited switch.
        </p>
        <div className="mt-3">
          <SelfApprovalToggle initial={Boolean(ws?.allowSelfApproval)} isAdmin={persona.role === "admin"} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Runtime</h2>
        <ul className="mt-2 space-y-1 text-slate-600">
          <li>
            Database: <strong>{mode}</strong>{" "}
            {mode === "pglite" && !process.env.DATABASE_URL
              ? "(embedded; set DATABASE_URL for a hosted Postgres in production)"
              : "(hosted Postgres)"}
          </li>
          <li>Workspace: {ws?.name ?? "—"}</li>
          <li>Retention: workspace content stays until deleted with the workspace (demo data is seeded).</li>
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Recent audit entries</h2>
        <ol className="mt-2 space-y-1.5">
          {recent.map((a) => (
            <li key={a.id} className="text-xs">
              <span className="text-slate-400">{a.createdAt.toLocaleString()}</span>{" "}
              <span className="font-medium">{a.actor}</span> {a.action.replace(/\./g, " ")}
              {a.reviewId && <span className="text-slate-400"> · review {a.reviewId.slice(0, 8)}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
