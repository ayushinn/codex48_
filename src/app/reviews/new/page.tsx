import { desc, eq } from "drizzle-orm";
import { channels, workspaces } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { IntakeForm } from "@/components/IntakeForm";
import { getPersonaFromCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewReviewPage() {
  const { db } = await ensureDb();
  const ws = (await db.select().from(workspaces))[0];
  const channelRows = ws
    ? await db.select().from(channels).where(eq(channels.workspaceId, ws.id)).orderBy(desc(channels.key))
    : [];
  const persona = await getPersonaFromCookie();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New review</h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste or upload content, choose the channel, and Preflight checks it against the{" "}
          {ws?.name ?? "workspace"} brand book: clauses, terminology, approved facts, tone and channel
          rules. You are acting as {persona.name} ({persona.title}).
        </p>
      </div>
      <IntakeForm
        channels={channelRows.map((c) => ({
          key: c.key,
          name: c.name,
          maxChars: c.maxChars,
          minWords: c.minWords,
        }))}
      />
    </div>
  );
}
