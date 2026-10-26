import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { runPreflight } from "@/lib/engine";
import { getPersonaFromCookie } from "@/lib/session";

/** Re-run preflight: decides carry over, fixed quotes disappear, new issues appear. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const persona = await getPersonaFromCookie();
  if (!["creator", "admin", "manager"].includes(persona.role)) {
    return NextResponse.json({ error: "This role cannot run preflight." }, { status: 403 });
  }
  const { db } = await ensureDb();
  try {
    const summary = await runPreflight(db, id, { actor: persona.name });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
