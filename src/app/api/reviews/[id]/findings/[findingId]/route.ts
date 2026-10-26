import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { decideFinding } from "@/lib/actions";
import { getPersonaFromCookie } from "@/lib/session";

/** The human decides: accept (apply suggestion), edit (own wording), dismiss (reason required). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; findingId: string }> },
) {
  const { findingId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    decision?: "accept" | "edit" | "dismiss";
    reason?: string;
    replacement?: string;
  };
  if (!body.decision || !["accept", "edit", "dismiss"].includes(body.decision)) {
    return NextResponse.json({ error: "decision must be accept, edit or dismiss." }, { status: 422 });
  }
  const persona = await getPersonaFromCookie();
  const { db } = await ensureDb();
  const result = await decideFinding(db, {
    findingId,
    decision: body.decision,
    reason: body.reason,
    replacement: body.replacement,
    actor: persona.name,
    role: persona.role,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, ...(result.data ?? {}) });
}
