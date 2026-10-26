import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { workspaces } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { getPersonaFromCookie } from "@/lib/session";
import { logAudit } from "@/lib/audit";

/** Workspace settings: single-person sign-off is the honest team-of-one config. */
export async function POST(req: Request) {
  const persona = await getPersonaFromCookie();
  if (persona.role !== "admin") {
    return NextResponse.json({ error: "Only the Admin can change workspace settings." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { allowSelfApproval?: boolean };
  if (typeof body.allowSelfApproval !== "boolean") {
    return NextResponse.json({ error: "allowSelfApproval must be a boolean." }, { status: 422 });
  }
  const { db, mode } = await ensureDb();
  const ws = (await db.select().from(workspaces))[0];
  if (!ws) return NextResponse.json({ error: "No workspace." }, { status: 500 });
  await db
    .update(workspaces)
    .set({ allowSelfApproval: body.allowSelfApproval })
    .where(eq(workspaces.id, ws.id));
  await logAudit(db, {
    workspaceId: ws.id,
    actor: persona.name,
    action: "settings.self_approval",
    detail: { allowSelfApproval: body.allowSelfApproval, database: mode },
  });
  return NextResponse.json({ ok: true, allowSelfApproval: body.allowSelfApproval });
}
