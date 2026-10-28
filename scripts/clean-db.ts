import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { eq, like, or } from "drizzle-orm";
import * as fs from "node:fs";
import * as schema from "../src/lib/db/schema";
import { resetDemoWorkspace } from "../src/lib/db/seed";

async function main() {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && fs.existsSync("DATABASE_URL.txt")) {
    dbUrl = fs.readFileSync("DATABASE_URL.txt", "utf8").trim();
  }

  let db: any;
  if (dbUrl) {
    console.log("Connecting to hosted Postgres (Neon)...");
    const sqlClient = neon(dbUrl);
    db = drizzleNeon(sqlClient, { schema });
  } else {
    console.log("Connecting to local PGlite (./data/preflight)...");
    const pglite = new PGlite("./data/preflight");
    db = drizzlePglite(pglite, { schema });
  }

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
