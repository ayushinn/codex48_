import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { auditLog } from "@/lib/db/schema";
import type { DB } from "@/lib/db";

/** Append-only audit trail. Nothing in the product updates or deletes rows here. */
export async function logAudit(
  db: DB,
  entry: {
    workspaceId: string;
    reviewId?: string | null;
    actor: string;
    action: string;
    detail?: Record<string, unknown>;
    prevStatus?: string | null;
    nextStatus?: string | null;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    id: randomUUID(),
    workspaceId: entry.workspaceId,
    reviewId: entry.reviewId ?? null,
    actor: entry.actor,
    action: entry.action,
    detail: entry.detail ?? {},
    prevStatus: entry.prevStatus ?? null,
    nextStatus: entry.nextStatus ?? null,
  });
}

export async function reviewAudit(db: DB, reviewId: string, limit = 50) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.reviewId, reviewId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
