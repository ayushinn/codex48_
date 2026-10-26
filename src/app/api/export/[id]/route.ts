import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { buildExport } from "@/lib/actions";

/** Publish handoff: approved content plus the approval record (Markdown download). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { db } = await ensureDb();
  const result = await buildExport(db, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const slug = result.review.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(result.markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="preflight-approval-${slug}.md"`,
      "cache-control": "no-store",
    },
  });
}
