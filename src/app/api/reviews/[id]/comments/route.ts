import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { addComment } from "@/lib/actions";
import { getPersonaFromCookie } from "@/lib/session";

/** Comments anchored to a finding (or to the review as a whole). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { body?: string; findingId?: string | null };
  const persona = await getPersonaFromCookie();
  const { db } = await ensureDb();
  const result = await addComment(db, {
    reviewId: id,
    findingId: body.findingId ?? null,
    body: body.body ?? "",
    actor: persona.name,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
