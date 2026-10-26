import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Preflight data model.
 *
 * Knowledge base (versioned guidelines, terms, facts, channels) -> reviews ->
 * findings -> workflow (comments, revisions, append-only audit log).
 *
 * Column names in SQL are mirrored by src/lib/db/bootstrap.ts (idempotent DDL),
 * which is executed on first database access.
 */

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  website: text("website"),
  allowSelfApproval: boolean("allow_self_approval").notNull().default(false),
  palette: jsonb("palette").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guidelineVersions = pgTable("guideline_versions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  version: integer("version").notNull(),
  label: text("label").notNull(),
  sourceName: text("source_name").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clauses = pgTable(
  "clauses",
  {
    id: text("id").primaryKey(),
    guidelineVersionId: text("guideline_version_id")
      .notNull()
      .references(() => guidelineVersions.id),
    code: text("code").notNull(),
    section: text("section").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    ruleType: text("rule_type").notNull(), // policy | style | preference
    checkGroup: text("check_group").notNull(), // tone | terminology | messaging | facts | accessibility | channel
    channel: text("channel"), // optional channel scoping (null = all channels)
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [uniqueIndex("clauses_code_uq").on(t.guidelineVersionId, t.code)],
);

export const terms = pgTable("terms", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  kind: text("kind").notNull(), // banned | approved | product_name
  term: text("term").notNull(),
  replacement: text("replacement"),
  note: text("note"),
});

export const facts = pgTable("facts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  claim: text("claim").notNull(),
  source: text("source").notNull(),
  reviewDate: text("review_date").notNull(),
  notes: text("notes"),
});

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  key: text("key").notNull(),
  name: text("name").notNull(),
  maxChars: integer("max_chars"),
  minWords: integer("min_words"),
  rules: jsonb("rules")
    .$type<{ maxHashtags?: number; requiredPhrases?: string[]; subjectLine?: boolean }>()
    .notNull(),
});

export const toneExamples = pgTable("tone_examples", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  kind: text("kind").notNull(), // good | bad
  text: text("text").notNull(),
  note: text("note"),
});

export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  title: text("title").notNull(),
  channelKey: text("channel_key").notNull(),
  contentType: text("content_type").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("DRAFT"),
  createdBy: text("created_by").notNull(),
  guidelineVersionId: text("guideline_version_id").references(() => guidelineVersions.id),
  images: jsonb("images")
    .$type<{ id: string; name: string; alt?: string; palette?: string[]; contrastRatio?: number }[]>()
    .notNull()
    .default([]),
  engine: jsonb("engine")
    .$type<{
      mode: "rules+llm" | "rules-only";
      provider?: string;
      model?: string;
      candidates: number;
      verified: number;
      rejected: number;
      llmFindings: number;
      runMs: number;
      ranAt: string;
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const findings = pgTable("findings", {
  id: text("id").primaryKey(),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id),
  seq: integer("seq").notNull(),
  checkGroup: text("check_group").notNull(),
  severity: text("severity").notNull(), // blocker | warn | info
  ruleType: text("rule_type").notNull(), // policy | style | preference
  clauseId: text("clause_id").references(() => clauses.id),
  clauseCode: text("clause_code"),
  clauseQuote: text("clause_quote"),
  why: text("why").notNull(),
  quote: text("quote"), // offending span from the content
  quoteStart: integer("quote_start"),
  quoteEnd: integer("quote_end"),
  suggestion: text("suggestion"),
  diff: jsonb("diff").$type<{ op: "keep" | "del" | "ins"; text: string }[]>().notNull().default([]),
  confidence: text("confidence").notNull().default("high"), // high | medium | low ("judgement call")
  state: text("state").notNull().default("open"), // open | accepted | edited | dismissed | verified
  editedText: text("edited_text"),
  decisionReason: text("decision_reason"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  verifier: text("verifier").notNull().default("verified"), // verified | rejected
  isBlocker: boolean("is_blocker").notNull().default(false),
});

export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id),
  findingId: text("finding_id").references(() => findings.id),
  author: text("author").notNull(),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const revisions = pgTable("revisions", {
  id: text("id").primaryKey(),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id),
  number: integer("number").notNull(),
  content: text("content").notNull(),
  summary: text("summary").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  reviewId: text("review_id"),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  prevStatus: text("prev_status"),
  nextStatus: text("next_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type Clause = typeof clauses.$inferSelect;
export type Term = typeof terms.$inferSelect;
export type Fact = typeof facts.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Revision = typeof revisions.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
