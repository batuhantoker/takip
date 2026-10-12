import type { AppDb } from './app-db';

/*
 * Our own app.db tables (Better Auth migrates its auth_* tables itself). Each entry runs once,
 * tracked by PRAGMA user_version; append new entries, never edit applied ones.
 * Conventions follow docs/architecture/backend-schema.sqlite.sql.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE bill_plan (
    plan_id      TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    public       INTEGER NOT NULL DEFAULT 1,
    sort         INTEGER NOT NULL DEFAULT 0,
    prices       TEXT NOT NULL DEFAULT '{}',
    created_at   INTEGER NOT NULL,
    archived_at  INTEGER
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE bill_plan_entitlement (
    plan_id  TEXT NOT NULL REFERENCES bill_plan,
    key      TEXT NOT NULL,
    value    TEXT NOT NULL,
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

  CREATE TABLE audit_event (
    audit_id      INTEGER PRIMARY KEY,
    at            INTEGER NOT NULL,
    actor_type    TEXT NOT NULL CHECK (actor_type IN ('user','admin','system','provider')),
    actor_id      TEXT,
    impersonator  TEXT,
    action        TEXT NOT NULL,
    subject_type  TEXT,
    subject_id    TEXT,
    ip_hash       TEXT,
    data          TEXT NOT NULL DEFAULT '{}'
  ) STRICT;
  CREATE INDEX audit_event_at ON audit_event (at);
  CREATE INDEX audit_event_subject ON audit_event (subject_type, subject_id, at);
  CREATE INDEX audit_event_actor ON audit_event (actor_id, at);

  -- Starting values from backend.md §7.2. They are placeholders: change rows, not code.
  INSERT INTO bill_plan (plan_id, name, public, sort, created_at) VALUES
    ('anon', 'Anonymous', 0, 0, unixepoch() * 1000),
    ('free', 'Free',      1, 1, unixepoch() * 1000),
    ('pro',  'Pro',       1, 2, unixepoch() * 1000);

  INSERT INTO bill_plan_entitlement (plan_id, key, value) VALUES
    ('anon', 'map.live', 'true'),             ('free', 'map.live', 'true'),             ('pro', 'map.live', 'true'),
    ('anon', 'api.enabled', 'false'),         ('free', 'api.enabled', 'false'),         ('pro', 'api.enabled', 'true'),
    ('anon', 'api.keys.max', '0'),            ('free', 'api.keys.max', '0'),            ('pro', 'api.keys.max', '5'),
    ('anon', 'api.requests_per_day', '0'),    ('free', 'api.requests_per_day', '0'),    ('pro', 'api.requests_per_day', '100000'),
    ('anon', 'api.rps', '0'),                 ('free', 'api.rps', '0'),                 ('pro', 'api.rps', '20'),
    ('anon', 'web.rps', '10'),                ('free', 'web.rps', '20'),                ('pro', 'web.rps', '50'),
    ('anon', 'replay.lookback_days', '1'),    ('free', 'replay.lookback_days', '7'),    ('pro', 'replay.lookback_days', '3650'),
    ('anon', 'replay.window_hours', '6'),     ('free', 'replay.window_hours', '24'),    ('pro', 'replay.window_hours', '720'),
    ('anon', 'workspaces.max', '0'),          ('free', 'workspaces.max', '5'),          ('pro', 'workspaces.max', '100'),
    ('anon', 'workspaces.share', 'false'),    ('free', 'workspaces.share', 'true'),     ('pro', 'workspaces.share', 'true'),
    ('anon', 'export.enabled', 'false'),      ('free', 'export.enabled', 'false'),      ('pro', 'export.enabled', 'true'),
    ('anon', 'ai.hosted', 'false'),           ('free', 'ai.hosted', 'false'),           ('pro', 'ai.hosted', 'false'),
    ('anon', 'data.licence_tier', '"anon"'),  ('free', 'data.licence_tier', '"free"'),  ('pro', 'data.licence_tier', '"paid"');
  `,
  // A session that passed the admin console's 2FA check, and when.
  `
  CREATE TABLE admin_unlock (
    session_id   TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    unlocked_at  INTEGER NOT NULL
  ) STRICT, WITHOUT ROWID;
  `,
  // Requests per UTC day, flushed from memory every 10 s (access/usage.ts). subject_id is a salted hash for anon.
  `
  CREATE TABLE usage_counter (
    day           INTEGER NOT NULL,
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('anon','user','org')),
    subject_id    TEXT NOT NULL,
    key_id        TEXT NOT NULL DEFAULT '',
    route_group   TEXT NOT NULL,
    requests      INTEGER NOT NULL DEFAULT 0,
    bytes         INTEGER NOT NULL DEFAULT 0,
    denied        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, subject_type, subject_id, key_id, route_group)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX usage_counter_subject ON usage_counter (subject_type, subject_id, day);
  `,
  // The user's answers of 2026-10-12: free gets a small API, pro gets hosted AI. Rows an operator already changed stay.
  `
  UPDATE bill_plan_entitlement SET value = 'true' WHERE plan_id = 'free' AND key = 'api.enabled'          AND value = 'false';
  UPDATE bill_plan_entitlement SET value = '1'    WHERE plan_id = 'free' AND key = 'api.keys.max'         AND value = '0';
  UPDATE bill_plan_entitlement SET value = '1000' WHERE plan_id = 'free' AND key = 'api.requests_per_day' AND value = '0';
  UPDATE bill_plan_entitlement SET value = '2'    WHERE plan_id = 'free' AND key = 'api.rps'              AND value = '0';
  UPDATE bill_plan_entitlement SET value = 'true' WHERE plan_id = 'pro'  AND key = 'ai.hosted'            AND value = 'false';
  `,
  // API keys (keys/). Only the key's SHA-256 is kept; the prefix lets its owner recognise it. scopes '[]' means unrestricted.
  `
  CREATE TABLE IF NOT EXISTS api_key (
    key_id        TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    name          TEXT NOT NULL,
    prefix        TEXT NOT NULL,
    key_hash      BLOB NOT NULL UNIQUE,
    scopes        TEXT NOT NULL DEFAULT '[]',
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER,
    last_used_at  INTEGER,
    revoked_at    INTEGER
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS api_key_user ON api_key (user_id, created_at);
  `,
  // Billing provider records (billing/) and the background job queue (jobs/). Re-runnable: a test rewinds user_version.
  `
  CREATE TABLE IF NOT EXISTS bill_customer (
    provider      TEXT NOT NULL,
    customer_id   TEXT NOT NULL,
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('user','org')),
    subject_id    TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    PRIMARY KEY (provider, customer_id)
  ) STRICT, WITHOUT ROWID;
  CREATE UNIQUE INDEX IF NOT EXISTS bill_customer_subject ON bill_customer (subject_type, subject_id, provider);

  CREATE TABLE IF NOT EXISTS bill_event (
    provider     TEXT NOT NULL,
    event_id     TEXT NOT NULL,
    type         TEXT NOT NULL,
    received_at  INTEGER NOT NULL,
    processed_at INTEGER,
    error        TEXT,
    payload      TEXT NOT NULL,
    PRIMARY KEY (provider, event_id)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS job (
    job_id       INTEGER PRIMARY KEY,
    kind         TEXT NOT NULL,
    payload      TEXT NOT NULL DEFAULT '{}',
    run_at       INTEGER NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 8,
    locked_until INTEGER,
    last_error   TEXT,
    done_at      INTEGER,
    failed_at    INTEGER,
    dedupe_key   TEXT UNIQUE,
    created_at   INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS job_ready ON job (run_at) WHERE done_at IS NULL AND failed_at IS NULL;
  `,
];

export function migrateAppSchema(db: AppDb) {
  const applied = db.pragma('user_version', { simple: true }) as number;
  for (let version = applied; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version]);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
