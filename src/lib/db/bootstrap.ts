/**
 * Idempotent DDL, executed statement-by-statement on first database access.
 * Kept in sync with src/lib/db/schema.ts (the typed Drizzle schema).
 *
 * Executing per statement keeps this compatible with both drivers: PGlite
 * (local) and the Neon HTTP driver (production) only accept one statement
 * per round trip.
 */
export const BOOTSTRAP_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS workspaces (
    id text PRIMARY KEY,
    name text NOT NULL,
    tagline text,
    website text,
    allow_self_approval boolean NOT NULL DEFAULT false,
    palette jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS guideline_versions (
    id text PRIMARY KEY,
    workspace_id text NOT NULL REFERENCES workspaces(id),
    version integer NOT NULL,
    label text NOT NULL,
    source_name text NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS clauses (
    id text PRIMARY KEY,
    guideline_version_id text NOT NULL REFERENCES guideline_versions(id),
    code text NOT NULL,
    section text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    rule_type text NOT NULL,
    check_group text NOT NULL,
    channel text,
    config jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS clauses_code_uq ON clauses (guideline_version_id, code)`,
  `CREATE TABLE IF NOT EXISTS terms (
    id text PRIMARY KEY,
    workspace_id text NOT NULL REFERENCES workspaces(id),
    kind text NOT NULL,
    term text NOT NULL,
    replacement text,
    note text
  )`,
  `CREATE TABLE IF NOT EXISTS facts (
    id text PRIMARY KEY,
    workspace_id text NOT NULL REFERENCES workspaces(id),
    claim text NOT NULL,
    source text NOT NULL,
    review_date text NOT NULL,
    notes text
  )`,
  `CREATE TABLE IF NOT EXISTS channels (
    id text PRIMARY KEY,
    workspace_id text NOT NULL REFERENCES workspaces(id),
    key text NOT NULL,
    name text NOT NULL,
    max_chars integer,
    min_words integer,
    rules jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS tone_examples (
    id text PRIMARY KEY,
    workspace_id text NOT NULL REFERENCES workspaces(id),
    kind text NOT NULL,
    text text NOT NULL,
    note text
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id text PRIMARY KEY,
    workspace_id text NOT NULL REFERENCES workspaces(id),
    title text NOT NULL,
    channel_key text NOT NULL,
    content_type text NOT NULL,
    content text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    created_by text NOT NULL,
    guideline_version_id text REFERENCES guideline_versions(id),
    images jsonb NOT NULL DEFAULT '[]'::jsonb,
    engine jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    decided_at timestamptz,
    approved_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS findings (
    id text PRIMARY KEY,
    review_id text NOT NULL REFERENCES reviews(id),
    seq integer NOT NULL,
    check_group text NOT NULL,
    severity text NOT NULL,
    rule_type text NOT NULL,
    clause_id text REFERENCES clauses(id),
    clause_code text,
    clause_quote text,
    why text NOT NULL,
    quote text,
    quote_start integer,
    quote_end integer,
    suggestion text,
    diff jsonb NOT NULL DEFAULT '[]'::jsonb,
    confidence text NOT NULL DEFAULT 'high',
    state text NOT NULL DEFAULT 'open',
    edited_text text,
    decision_reason text,
    decided_by text,
    decided_at timestamptz,
    verifier text NOT NULL DEFAULT 'verified',
    is_blocker boolean NOT NULL DEFAULT false
  )`,
  `CREATE INDEX IF NOT EXISTS findings_review_idx ON findings (review_id)`,
  `CREATE TABLE IF NOT EXISTS comments (
    id text PRIMARY KEY,
    review_id text NOT NULL REFERENCES reviews(id),
    finding_id text REFERENCES findings(id),
    author text NOT NULL,
    body text NOT NULL,
    resolved boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS revisions (
    id text PRIMARY KEY,
    review_id text NOT NULL REFERENCES reviews(id),
    number integer NOT NULL,
    content text NOT NULL,
    summary text NOT NULL,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id text PRIMARY KEY,
    workspace_id text NOT NULL,
    review_id text,
    actor text NOT NULL,
    action text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    prev_status text,
    next_status text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS audit_review_idx ON audit_log (review_id)`,
];

/** Joined form, useful for logs/tests. */
export const BOOTSTRAP_SQL = BOOTSTRAP_STATEMENTS.join(";\n");
