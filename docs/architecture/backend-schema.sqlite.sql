-- app.db: application data (accounts, billing, usage, workspaces, audit). Design sketch, not a migration.
-- Same conventions as replay-schema.sqlite.sql: STRICT, epoch ms, JSON as TEXT, prefix_name -> Postgres prefix.name.
-- auth_* tables are generated and migrated by the Better Auth CLI (user, session, account, verification,
-- plus plugin tables); they are not repeated here. subject ids below reference auth_user.id (TEXT) or, later, an org id.

-- ───────────────────────────── billing ─────────────────────────────

CREATE TABLE bill_plan (
  plan_id      TEXT PRIMARY KEY,                -- 'anon', 'free', 'pro', 'api', …
  name         TEXT NOT NULL,
  public       INTEGER NOT NULL DEFAULT 1,      -- shown on /pricing
  sort         INTEGER NOT NULL DEFAULT 0,
  prices       TEXT NOT NULL DEFAULT '{}',      -- {"<provider>": {"monthly": "<price id>", "yearly": "…"}}
  created_at   INTEGER NOT NULL,
  archived_at  INTEGER
) STRICT, WITHOUT ROWID;

CREATE TABLE bill_plan_entitlement (
  plan_id  TEXT NOT NULL REFERENCES bill_plan,
  key      TEXT NOT NULL,                       -- 'api.enabled', 'api.requests_per_day', 'replay.lookback_days', …
  value    TEXT NOT NULL,                       -- JSON scalar: true, 100000, "paid"
  PRIMARY KEY (plan_id, key)
) STRICT, WITHOUT ROWID;

CREATE TABLE bill_subject_override (
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('user','org')),
  subject_id    TEXT NOT NULL,
  key           TEXT NOT NULL,
  value         TEXT NOT NULL,
  expires_at    INTEGER,
  granted_by    TEXT NOT NULL,
  reason        TEXT,
  PRIMARY KEY (subject_type, subject_id, key)
) STRICT, WITHOUT ROWID;

CREATE TABLE bill_customer (
  provider      TEXT NOT NULL,                  -- 'stripe','paddle','polar','lemonsqueezy','iyzico'
  customer_id   TEXT NOT NULL,
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('user','org')),
  subject_id    TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (provider, customer_id)
) STRICT, WITHOUT ROWID;
CREATE UNIQUE INDEX bill_customer_subject ON bill_customer (subject_type, subject_id, provider);

-- Written only by webhook handling, reconciliation, or an admin comp (provider = 'manual').
CREATE TABLE bill_subscription (
  subscription_id      INTEGER PRIMARY KEY,
  provider             TEXT NOT NULL,
  provider_sub_id      TEXT NOT NULL,
  subject_type         TEXT NOT NULL CHECK (subject_type IN ('user','org')),
  subject_id           TEXT NOT NULL,
  plan_id              TEXT NOT NULL REFERENCES bill_plan,
  status               TEXT NOT NULL CHECK (status IN
                         ('trialing','active','past_due','canceled','incomplete','paused','expired')),
  current_period_end   INTEGER,
  cancel_at            INTEGER,
  grace_until          INTEGER,
  provider_data        TEXT NOT NULL DEFAULT '{}',
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL,
  UNIQUE (provider, provider_sub_id)
) STRICT;
CREATE INDEX bill_subscription_subject ON bill_subscription (subject_type, subject_id, status);

CREATE TABLE bill_event (
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  type         TEXT NOT NULL,
  received_at  INTEGER NOT NULL,
  processed_at INTEGER,
  error        TEXT,
  payload      TEXT NOT NULL,
  PRIMARY KEY (provider, event_id)
) STRICT, WITHOUT ROWID;

-- ───────────────────────────── usage ─────────────────────────────

-- Flushed from in-memory counters every ~10 s; quota checks read memory, not this table.
CREATE TABLE usage_counter (
  day           INTEGER NOT NULL,               -- epoch day (UTC)
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('anon','user','org')),
  subject_id    TEXT NOT NULL,                  -- user/org id, or a salted IP hash for anon
  key_id        TEXT NOT NULL DEFAULT '',       -- '' = session/anonymous traffic
  route_group   TEXT NOT NULL,                  -- 'replay', 'tiles', 'lookup', 'live', 'mcp', …
  requests      INTEGER NOT NULL DEFAULT 0,
  bytes         INTEGER NOT NULL DEFAULT 0,
  denied        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, subject_type, subject_id, key_id, route_group)
) STRICT, WITHOUT ROWID;

-- ───────────────────────────── API keys ─────────────────────────────

-- Our own table, not Better Auth's apiKey plugin (backend.md §6). The key itself is never stored.
CREATE TABLE api_key (
  key_id        TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,                 -- auth_user.id; rows are deleted with the account
  name          TEXT NOT NULL,
  prefix        TEXT NOT NULL,                 -- 'tk_ab12cd34', shown to the owner
  key_hash      BLOB NOT NULL UNIQUE,          -- SHA-256 of the full key
  scopes        TEXT NOT NULL DEFAULT '[]',    -- JSON array; [] = unrestricted
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER,
  last_used_at  INTEGER,                       -- written at most once a minute
  revoked_at    INTEGER
) STRICT, WITHOUT ROWID;
CREATE INDEX api_key_user ON api_key (user_id, created_at);

-- ───────────────────────────── workspaces ─────────────────────────────

CREATE TABLE ws_workspace (
  workspace_id   TEXT PRIMARY KEY,              -- ULID
  owner_id       TEXT NOT NULL,                 -- auth_user.id
  org_id         TEXT,
  name           TEXT NOT NULL,
  state          TEXT NOT NULL,                 -- WorkspaceStateV<n> JSON, ≤ 256 KB
  state_version  INTEGER NOT NULL,
  rev            INTEGER NOT NULL DEFAULT 1,    -- optimistic concurrency (If-Match)
  visibility     TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','link','public')),
  share_slug     TEXT UNIQUE,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER
) STRICT, WITHOUT ROWID;
CREATE INDEX ws_workspace_owner ON ws_workspace (owner_id, updated_at DESC) WHERE deleted_at IS NULL;

-- ───────────────────────────── operations ─────────────────────────────

CREATE TABLE audit_event (
  audit_id      INTEGER PRIMARY KEY,
  at            INTEGER NOT NULL,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('user','admin','system','provider')),
  actor_id      TEXT,
  impersonator  TEXT,
  action        TEXT NOT NULL,                  -- 'plan.grant', 'user.ban', 'apikey.revoke', 'subscription.update', …
  subject_type  TEXT,
  subject_id    TEXT,
  ip_hash       TEXT,
  data          TEXT NOT NULL DEFAULT '{}'
) STRICT;
CREATE INDEX audit_event_at ON audit_event (at);
CREATE INDEX audit_event_subject ON audit_event (subject_type, subject_id, at);
CREATE INDEX audit_event_actor ON audit_event (actor_id, at);

CREATE TABLE job (
  job_id       INTEGER PRIMARY KEY,
  queue        TEXT NOT NULL,                   -- 'email', 'webhook-retry', 'billing-reconcile', …
  payload      TEXT NOT NULL,
  run_at       INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  locked_until INTEGER,
  last_error   TEXT,
  done_at      INTEGER,
  dedupe_key   TEXT UNIQUE
) STRICT;
CREATE INDEX job_ready ON job (queue, run_at) WHERE done_at IS NULL;

-- Claim one job (single api process; the UPDATE is atomic under SQLite's write lock):
--   UPDATE job SET locked_until = :now + 60000, attempts = attempts + 1
--   WHERE job_id = (SELECT job_id FROM job WHERE queue = :q AND done_at IS NULL AND run_at <= :now
--                   AND (locked_until IS NULL OR locked_until < :now) ORDER BY run_at LIMIT 1)
--   RETURNING job_id, payload, attempts;

CREATE TABLE feature_flag (
  key         TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 0,
  rules       TEXT NOT NULL DEFAULT '{}',       -- {"plans": [...], "users": [...], "percent": 0}
  updated_at  INTEGER NOT NULL
) STRICT, WITHOUT ROWID;
