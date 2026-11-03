import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { channels, findings, reviews, workspaces } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { runPreflight } from "@/lib/engine";
import { getPersonaFromCookie } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const CreateReview = z.object({
  title: z.string().min(1).max(160),
  channelKey: z.string().min(1),
  contentType: z.string().min(1).max(60).optional(),
  content: z.string().min(1).max(200_000),
  images: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        name: z.string().min(1).max(255),
        alt: z.string().max(2000).optional(),
        kind: z.enum(["photo", "logo"]).optional(),
        palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(12).optional(),
        /** Mark-vs-background WCAG ratio for logos, tonal spread for photos; null when unmeasurable. */
        contrastRatio: z.number().finite().min(1).max(21).nullable().optional(),
        photoContrastRatio: z.number().finite().min(1).max(21).nullable().optional(),
        logoContrastRatio: z.number().finite().min(1).max(21).nullable().optional(),
        /** 0..1 share of sampled pixels outside the approved palette. */
        offPaletteShare: z.number().finite().min(0).max(1).optional(),
        /** 0..1 clear space around logo content box, fraction of logo height. */
        clearSpaceRatio: z.number().finite().min(0).max(10).optional(),
        /** Width in pixels. */
        width: z.number().int().positive().max(100_000).optional(),
        /** Height in pixels. */
        height: z.number().int().positive().max(100_000).optional(),
        /** Width / height ratio (when kind === "logo"). */
        aspectRatio: z.number().finite().positive().max(1000).optional(),
      }),
    )
    .optional(),
});

/** List reviews with their open finding counts. */
export async function GET() {
  const { db } = await ensureDb();
  const reviewRows = await db.select().from(reviews);
  const findingRows = await db.select().from(findings);
  return NextResponse.json(
    reviewRows.map((r) => {
      const list = findingRows.filter((f) => f.reviewId === r.id);
      return {
        id: r.id,
        title: r.title,
        channelKey: r.channelKey,
        status: r.status,
        createdBy: r.createdBy,
        engine: r.engine,
        findings: {
          total: list.length,
          open: list.filter((f) => f.state === "open").length,
          openBlockers: list.filter((f) => f.state === "open" && f.isBlocker).length,
          dismissed: list.filter((f) => f.state === "dismissed").length,
          accepted: list.filter((f) => f.state === "accepted" || f.state === "edited").length,
        },
      };
    }),
    { headers: { "cache-control": "no-store" } },
  );
}

/** Create a review and run preflight in one step (the judge's core path). */
export async function POST(req: Request) {
  const persona = await getPersonaFromCookie();
  if (!["creator", "admin", "manager"].includes(persona.role)) {
    return NextResponse.json({ error: `Role "${persona.title}" cannot create reviews.` }, { status: 403 });
  }

  const parsed = CreateReview.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const { db } = await ensureDb();
  const workspaces_ = await db.select().from(workspaces);
  const workspace = workspaces_[0];
  if (!workspace) return NextResponse.json({ error: "No workspace configured." }, { status: 500 });

  const channelList = await db.select().from(channels).where(eq(channels.workspaceId, workspace.id));
  const channel = channelList.find((c) => c.key === input.channelKey);
  if (!channel) {
    return NextResponse.json(
      { error: `Unknown channel "${input.channelKey}". Available: ${channelList.map((c) => c.key).join(", ")}` },
      { status: 422 },
    );
  }

  const id = randomUUID();
  await db.insert(reviews).values({
    id,
    workspaceId: workspace.id,
    title: input.title,
    channelKey: channel.key,
    contentType: input.contentType ?? channel.name,
    content: input.content,
    status: "DRAFT",
    createdBy: persona.name,
    images: input.images ?? [],
    engine: {} as never,
  });
  await logAudit(db, {
    workspaceId: workspace.id,
    reviewId: id,
    actor: persona.name,
    action: "review.created",
    detail: { channel: channel.key, chars: input.content.length, images: input.images?.length ?? 0 },
  });

  try {
    const summary = await runPreflight(db, id, { actor: persona.name });
    return NextResponse.json({ ok: true, id, summary }, { status: 201 });
  } catch (err) {
    console.error("[preflight] failed", err);
    return NextResponse.json(
      { ok: true, id, error: `Preflight failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
