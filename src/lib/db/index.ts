import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { BOOTSTRAP_STATEMENTS } from "./bootstrap";
import { seedDemoWorkspace } from "./seed";

export type DB = PgliteDatabase<typeof schema>;

/**
 * Dual driver, one schema:
 *  - DATABASE_URL set  -> Neon serverless Postgres (production, Vercel)
 *  - no DATABASE_URL   -> file-backed PGlite (zero-install local development,
 *                         and a functional ephemeral fallback in /tmp when the
 *                         app is deployed without a database configured)
 */
function createPglite(): PGlite {
  // Cloudflare Workers / some serverless runtimes have no durable filesystem.
  // In-memory PGlite still seeds a working demo per isolate.
  const forceMemory =
    process.env.PGLITE_MEMORY === "1" ||
    Boolean(process.env.CF_PAGES) ||
    Boolean(process.env.OPEN_NEXT_CLOUDFLARE);
  if (forceMemory) {
    return new PGlite();
  }
  const dir =
    process.env.PGLITE_DIR ??
    (process.env.VERCEL ? "/tmp/preflight-pglite" : `${process.cwd()}/data/preflight`);
  try {
    mkdirSync(dir, { recursive: true });
    return new PGlite(dir);
  } catch (err) {
    console.warn(
      "[preflight] file-backed PGlite unavailable, using in-memory:",
      (err as Error).message,
    );
    return new PGlite();
  }
}

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sqlClient = neon(url);
    return drizzleNeon(sqlClient, { schema }) as unknown as DB;
  }
  return drizzlePglite(createPglite(), { schema });
}

type Global = { db: DB; mode: "postgres" | "pglite"; ready: Promise<void> | null };
const g = globalThis as unknown as { __preflightDb?: Global };

async function bootstrap(db: DB, mode: "postgres" | "pglite"): Promise<void> {
  for (const statement of BOOTSTRAP_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
  await seedDemoWorkspace(db);
}

export function getDb(): { db: DB; mode: "postgres" | "pglite" } {
  if (!g.__preflightDb) {
    const mode = process.env.DATABASE_URL ? "postgres" : "pglite";
    const db = createDb();
    const entry: Global = { db, mode, ready: null };
    entry.ready = bootstrap(db, mode).catch((err) => {
      // allow retry on next access
      entry.ready = null;
      throw err;
    });
    g.__preflightDb = entry;
  }
  const entry = g.__preflightDb;
  if (entry.ready) {
    // awaited by callers through ensureDb()
  }
  return { db: entry.db, mode: entry.mode };
}

export async function ensureDb(): Promise<{ db: DB; mode: "postgres" | "pglite" }> {
  const { db, mode } = getDb();
  const entry = g.__preflightDb!;
  if (entry.ready) {
    await entry.ready;
  }
  return { db, mode };
}

export { randomUUID };
