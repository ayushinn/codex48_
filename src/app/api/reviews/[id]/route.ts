import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auditLog, comments, findings, reviews, revisions } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { getPersonaFromCookie } from "@/lib/session";
import { ACTIONS, type Status } from "@/lib/workflow";

/** Read a review with its findings and comments (also used by API consumers). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { db } = await ensureDb();
  const persona = await getPersonaFromCookie();

  const review = (await db.select().from(reviews).where(eq(reviews.id, id)))[0];
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  const findingRows = await db.select().from(findings).where(eq(findings.reviewId, id)).orderBy(asc(findings.seq));
  const commentRows = await db.select().from(comments).where(eq(comments.reviewId, id)).orderBy(asc(comments.createdAt));

  const actions = ACTIONS.filter(
    (a) => a.from.includes(review.status as Status) && a.roles.includes(persona.role),
  ).map((a) => ({ key: a.key, label: a.label, requiresReason: Boolean(a.requiresReason) }));

  return NextResponse.json(
    {
      review: { ...review, createdAt: review.createdAt.toISOString(), updatedAt: review.updatedAt.toISOString() },
      findings: findingRows.map((f) => ({
        ...f,
        decidedAt: f.decidedAt?.toISOString() ?? null,
        diff: f.diff ?? [],
      })),
      comments: commentRows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
      availableActions: actions,
      actingAs: { name: persona.name, role: persona.role, title: persona.title },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Delete a review and its associated findings, comments, revisions, and audit records. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { db } = await ensureDb();
  const persona = await getPersonaFromCookie();
  if (!["creator", "manager", "admin"].includes(persona.role)) {
    return NextResponse.json({ error: "This role cannot delete reviews." }, { status: 403 });
  }

  const review = (await db.select().from(reviews).where(eq(reviews.id, id)))[0];
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  await db.delete(findings).where(eq(findings.reviewId, id));
  await db.delete(comments).where(eq(comments.reviewId, id));
  await db.delete(revisions).where(eq(revisions.reviewId, id));
  await db.delete(auditLog).where(eq(auditLog.reviewId, id));
  await db.delete(reviews).where(eq(reviews.id, id));

  return NextResponse.json({ ok: true, deletedId: id });
}
