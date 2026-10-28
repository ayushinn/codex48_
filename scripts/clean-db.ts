/**
 * clean-db.ts — Reset the LOCAL demo workspace and reseed pristine reviews.
 *
 * Safety guards:
 *   1. Refuses to run if DATABASE_URL is set in the environment (protects hosted / Neon DBs).
 *   2. Refuses to run if DATABASE_URL.txt is present (protects local files that point to a
 *      hosted DB — if you truly want to reset a hosted DB, delete the file first and confirm).
 *   3. Requires an explicit --confirm flag so the script cannot be triggered accidentally.
 *
 * Usage (local PGlite only):
 *   npx tsx scripts/clean-db.ts --confirm
 *   npm run clean-db          ← runs the above via package.json
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as fs from "node:fs";
import * as schema from "../src/lib/db/schema";
import { resetDemoWorkspace } from "../src/lib/db/seed";

// ── Guard 1: block if DATABASE_URL env var is set ──────────────────────────
if (process.env.DATABASE_URL) {
  console.error(
    "\n❌  clean-db refused: DATABASE_URL is set in the environment.\n" +
    "    This script only resets the local PGlite database (./data/preflight).\n" +
    "    Unset DATABASE_URL before running, or use your hosting dashboard to\n" +
    "    manage the remote database directly.\n"
  );
  process.exit(1);
}

// ── Guard 2: block if DATABASE_URL.txt exists (likely points to a hosted DB) ─
if (fs.existsSync("DATABASE_URL.txt")) {
  console.error(
    "\n❌  clean-db refused: DATABASE_URL.txt is present.\n" +
    "    That file typically holds a Neon / hosted Postgres URL.\n" +
    "    Remove or rename it first if you truly intend to reset the local DB only.\n"
  );
  process.exit(1);
}

// ── Guard 3: require explicit --confirm flag ────────────────────────────────
if (!process.argv.includes("--confirm")) {
  console.error(
    "\n⚠️   clean-db requires explicit confirmation.\n\n" +
    "    This will DELETE all reviews, findings, comments, revisions, audit records,\n" +
    "    guidelines, registries and the demo workspace in ./data/preflight, then\n" +
    "    reseed a fresh set of demo data.\n\n" +
    "    Re-run with --confirm to proceed:\n" +
    "      npx tsx scripts/clean-db.ts --confirm\n"
  );
  process.exit(1);
}

async function main() {
  console.log("Connecting to local PGlite (./data/preflight)...");
  const pglite = new PGlite("./data/preflight");
  const db = drizzlePglite(pglite, { schema });

  console.log("Resetting demo workspace and reseeding pristine reviews...");
  await resetDemoWorkspace(db);

  const allReviews = await db.select().from(schema.reviews);
  console.log(`\nDatabase reset successful! Current reviews (${allReviews.length}):`);
  for (const r of allReviews) {
    console.log(`  - [${r.status}] ${r.id}: ${r.title}`);
  }
}

main().catch((err) => {
  console.error("clean-db failed:", err);
  process.exit(1);
});
