import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { transitionReview } from "@/lib/actions";
import { getPersonaFromCookie } from "@/lib/session";

/** Drive the approval state machine; illegal transitions and blocked gates fail loudly. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { actionKey?: string; reason?: string };
  if (!body.actionKey) return NextResponse.json({ error: "actionKey required." }, { status: 422 });

  const persona = await getPersonaFromCookie();
  const { db } = await ensureDb();
  const result = await transitionReview(db, {
    reviewId: id,
    actionKey: body.actionKey,
    actor: persona.name,
    role: persona.role,
    reason: body.reason,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, ...(result.data ?? {}) });
}
