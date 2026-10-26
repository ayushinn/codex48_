import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { clauses, facts, guidelineVersions, terms, workspaces } from "@/lib/db/schema";
import { ensureDb } from "@/lib/db";
import { getPersonaFromCookie } from "@/lib/session";
import { logAudit } from "@/lib/audit";

function classify(text: string): { checkGroup: string; ruleType: string } {
  const t = text.toLowerCase();
  const checkGroup = /\b(tone|voice|style|hype|writing|plain language|readab)/.test(t)
    ? "tone"
    : /\b(name|terminolog|banned term|approved term|spelling|capitalis|capitaliz)/.test(t)
      ? "terminology"
      : /\b(claim|fact|evidence|statistic|source|citation|registry)/.test(t)
        ? "facts"
        : /\b(accessib|alt text|contrast|acronym|wcag|screen reader|palette|logo)/.test(t)
          ? "accessibility"
          : /\b(channel|social|email|subject|hashtag|word count|character|press release|blog)/.test(t)
            ? "channel"
            : "messaging";
  const ruleType = /\b(must|never|prohibit|required|do not|block|policy|always)\b/.test(t)
    ? "policy"
    : /\b(should|avoid|prefer|guideline|encourage)\b/.test(t)
      ? "style"
      : "preference";
  return { checkGroup, ruleType };
}

/**
 * Add a clause, term or fact - or import an entire pasted guideline as a new
 * version (F1: import and versioning; future reviews cite the new version).
 */
export async function POST(req: Request) {
  const persona = await getPersonaFromCookie();
  if (!["admin", "manager"].includes(persona.role)) {
    return NextResponse.json(
      { error: `Role "${persona.title}" cannot change the knowledge base. Switch to Admin or Content Manager.` },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.kind !== "string") {
    return NextResponse.json({ error: "kind is required." }, { status: 422 });
  }

  const { db } = await ensureDb();
  const ws = (await db.select().from(workspaces))[0];
  if (!ws) return NextResponse.json({ error: "No workspace." }, { status: 500 });

  if (body.kind === "term") {
    const term = String(body.term ?? "").trim();
    if (!term) return NextResponse.json({ error: "term is required." }, { status: 422 });
    await db.insert(terms).values({
      id: randomUUID(),
      workspaceId: ws.id,
      kind: String(body.termKind ?? "banned"),
      term,
      replacement: (body.replacement as string) || "",
      note: (body.note as string) || null,
    });
    await logAudit(db, {
      workspaceId: ws.id,
      actor: persona.name,
      action: "knowledge.term_added",
      detail: { term },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (body.kind === "fact") {
    const claim = String(body.claim ?? "").trim();
    const source = String(body.source ?? "").trim();
    if (!claim || !source) {
      return NextResponse.json({ error: "claim and source are required." }, { status: 422 });
    }
    await db.insert(facts).values({
      id: randomUUID(),
      workspaceId: ws.id,
      claim,
      source,
      reviewDate: String(body.reviewDate ?? new Date().toISOString().slice(0, 10)),
      notes: (body.notes as string) || null,
    });
    await logAudit(db, {
      workspaceId: ws.id,
      actor: persona.name,
      action: "knowledge.fact_registered",
      detail: { claim: claim.slice(0, 120), source },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (body.kind === "guideline") {
    const text = String(body.text ?? "").trim();
    const label = String(body.label ?? "").trim() || "Imported guideline";
    if (text.length < 40) {
      return NextResponse.json(
        { error: "Paste at least a few sentences of guideline text (40+ characters)." },
        { status: 422 },
      );
    }
    const prior = await db
      .select()
      .from(guidelineVersions)
      .where(eq(guidelineVersions.workspaceId, ws.id))
      .orderBy(desc(guidelineVersions.version));
    const version = (prior[0]?.version ?? 0) + 1;
    const guideId = randomUUID();
    await db.insert(guidelineVersions).values({
      id: guideId,
      workspaceId: ws.id,
      version,
      label,
      sourceName: String(body.sourceName ?? "pasted text"),
    });

    const blocks = text
      .split(/\n{2,}|(?=\n?\s*(?:\d+[.)]\s|#{1,3}\s))/)
      .map((b) => b.trim())
      .filter((b) => b.length > 25);
    let n = 0;
    for (const block of blocks) {
      n++;
      const { checkGroup, ruleType } = classify(block);
      const firstLine = block.split("\n")[0];
      const title = firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine;
      await db.insert(clauses).values({
        id: randomUUID(),
        guidelineVersionId: guideId,
        code: `GB-${version}-${n}`,
        section: `Imported block ${n}`,
        title,
        body: block,
        ruleType,
        checkGroup,
        channel: null,
        config: {},
      });
    }
    await logAudit(db, {
      workspaceId: ws.id,
      actor: persona.name,
      action: "knowledge.guideline_imported",
      detail: { label, version, clauses: n },
    });
    return NextResponse.json({ ok: true, version, clauses: n }, { status: 201 });
  }

  if (body.kind === "clause") {
    const title = String(body.title ?? "").trim();
    const bodyText = String(body.body ?? "").trim();
    if (!title || !bodyText) {
      return NextResponse.json({ error: "title and body are required." }, { status: 422 });
    }
    const guide = (
      await db
        .select()
        .from(guidelineVersions)
        .where(eq(guidelineVersions.workspaceId, ws.id))
        .orderBy(desc(guidelineVersions.version))
    )[0];
    if (!guide) return NextResponse.json({ error: "Import a guideline first." }, { status: 422 });
    const existing = await db.select().from(clauses).where(eq(clauses.guidelineVersionId, guide.id));
    const { checkGroup, ruleType } = classify(`${title} ${bodyText}`);
    await db.insert(clauses).values({
      id: randomUUID(),
      guidelineVersionId: guide.id,
      code: String(body.code ?? `GB-${existing.length + 1}`),
      section: String(body.section ?? "Custom"),
      title,
      body: bodyText,
      ruleType: String(body.ruleType ?? ruleType),
      checkGroup: String(body.checkGroup ?? checkGroup),
      channel: (body.channel as string) || null,
      config: {},
    });
    await logAudit(db, {
      workspaceId: ws.id,
      actor: persona.name,
      action: "knowledge.clause_added",
      detail: { title },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  return NextResponse.json({ error: `Unknown kind "${body.kind}".` }, { status: 422 });
}
