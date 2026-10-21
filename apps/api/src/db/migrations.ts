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
  // Pro takes the ads away (src/components/ads). OR IGNORE keeps a row an operator added first.
  `
  INSERT OR IGNORE INTO bill_plan_entitlement (plan_id, key, value) VALUES
    ('anon', 'ads.off', 'false'), ('free', 'ads.off', 'false'), ('pro', 'ads.off', 'true');
  `,
  // Saved workspaces (workspaces/). state is WorkspaceStateV<state_version> JSON; rev backs If-Match.
  `
  CREATE TABLE IF NOT EXISTS ws_workspace (
    workspace_id   TEXT PRIMARY KEY,
    owner_id       TEXT NOT NULL,
    org_id         TEXT,
    name           TEXT NOT NULL,
    state          TEXT NOT NULL,
    state_version  INTEGER NOT NULL,
    rev            INTEGER NOT NULL DEFAULT 1,
    visibility     TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','link','public')),
    share_slug     TEXT UNIQUE,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    deleted_at     INTEGER
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS ws_workspace_owner ON ws_workspace (owner_id, updated_at DESC) WHERE deleted_at IS NULL;
  `,
  // Route groups an admin switched between keyless and key-only (access/key-policy.ts); no row means the group's default.
  `
  CREATE TABLE IF NOT EXISTS api_access_policy (
    route_group   TEXT PRIMARY KEY,
    key_required  INTEGER NOT NULL CHECK (key_required IN (0,1)),
    updated_at    INTEGER NOT NULL,
    updated_by    TEXT
  ) STRICT, WITHOUT ROWID;
  `,
  // Daily map time per plan (0 = no limit), TI and the Layers sections; map_time counts the minutes (access/map-time.ts).
  `
  INSERT OR IGNORE INTO bill_plan_entitlement (plan_id, key, value) VALUES
    ('anon', 'map.minutes_per_day', '15'),  ('free', 'map.minutes_per_day', '60'),  ('pro', 'map.minutes_per_day', '0'),
    ('anon', 'ai.assistant', 'false'),       ('free', 'ai.assistant', 'true'),       ('pro', 'ai.assistant', 'true'),
    ('anon', 'map.layers.air', 'true'),       ('free', 'map.layers.air', 'true'),       ('pro', 'map.layers.air', 'true'),
    ('anon', 'map.layers.sea', 'true'),       ('free', 'map.layers.sea', 'true'),       ('pro', 'map.layers.sea', 'true'),
    ('anon', 'map.layers.land', 'true'),      ('free', 'map.layers.land', 'true'),      ('pro', 'map.layers.land', 'true'),
    ('anon', 'map.layers.space', 'true'),     ('free', 'map.layers.space', 'true'),     ('pro', 'map.layers.space', 'true'),
    ('anon', 'map.layers.weather', 'true'),   ('free', 'map.layers.weather', 'true'),   ('pro', 'map.layers.weather', 'true'),
    ('anon', 'map.layers.conflict', 'true'),  ('free', 'map.layers.conflict', 'true'),  ('pro', 'map.layers.conflict', 'true'),
    ('anon', 'map.layers.cameras', 'true'),   ('free', 'map.layers.cameras', 'true'),   ('pro', 'map.layers.cameras', 'true'),
    ('anon', 'map.layers.reference', 'true'), ('free', 'map.layers.reference', 'true'), ('pro', 'map.layers.reference', 'true');
  CREATE TABLE IF NOT EXISTS map_time (
    day           INTEGER NOT NULL,
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('anon','user')),
    subject_id    TEXT NOT NULL,
    minutes       INTEGER NOT NULL,
    last_tick_at  INTEGER NOT NULL,
    PRIMARY KEY (day, subject_type, subject_id)
  ) STRICT, WITHOUT ROWID;
  `,
  // Issue reports (reports/): the reporter's words and a JSON snapshot of their map view. user_id is null for visitors.
  `
  CREATE TABLE IF NOT EXISTS issue_report (
    report_id    INTEGER PRIMARY KEY,
    created_at   INTEGER NOT NULL,
    user_id      TEXT,
    message      TEXT NOT NULL,
    view         TEXT NOT NULL DEFAULT '{}',
    user_agent   TEXT,
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
    resolved_at  INTEGER,
    resolved_by  TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS issue_report_status ON issue_report (status, report_id);
  CREATE INDEX IF NOT EXISTS issue_report_user ON issue_report (user_id) WHERE user_id IS NOT NULL;
  `,
  // Where map minutes go (access/map-time.ts): per subject and feature ('view:history', 'panel:layers', 'layer:flights'),
  // and per UTC hour for everyone. map_time is now kept for the usage retention instead of one day.
  `
  CREATE TABLE IF NOT EXISTS feature_time (
    day           INTEGER NOT NULL,
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('anon','user')),
    subject_id    TEXT NOT NULL,
    feature       TEXT NOT NULL,
    minutes       INTEGER NOT NULL,
    PRIMARY KEY (day, subject_type, subject_id, feature)
  ) STRICT, WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS activity_hour (
    day           INTEGER NOT NULL,
    hour          INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('anon','user')),
    minutes       INTEGER NOT NULL,
    PRIMARY KEY (day, hour, subject_type)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS map_time_subject ON map_time (subject_type, subject_id, day);
  `,
  // Per-account analytics: each account's map minutes by UTC hour, and every sign-in (Better Auth deletes a session's
  // row on sign-out, so auth_session alone loses them). Both are pruned with the other activity (access/usage-prune.ts).
  `
  CREATE TABLE IF NOT EXISTS user_hour (
    user_id  TEXT NOT NULL,
    day      INTEGER NOT NULL,
    hour     INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
    minutes  INTEGER NOT NULL,
    PRIMARY KEY (user_id, day, hour)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS user_hour_day ON user_hour (day);
  CREATE INDEX IF NOT EXISTS feature_time_subject ON feature_time (subject_type, subject_id, day);
  CREATE TABLE IF NOT EXISTS sign_in (
    sign_in_id       INTEGER PRIMARY KEY,
    user_id          TEXT NOT NULL,
    at               INTEGER NOT NULL,
    ip_address       TEXT,
    user_agent       TEXT,
    impersonated_by  TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS sign_in_user ON sign_in (user_id, at);
  CREATE INDEX IF NOT EXISTS sign_in_at ON sign_in (at);
  `,
  // Visitors across days (access/map-time.ts): a random id the browser keeps in localStorage and sends with each tick.
  // Their minutes, features and hours while signed out; user_id is the account last signed in from that browser.
  `
  CREATE TABLE IF NOT EXISTS visitor (
    visitor_id     TEXT PRIMARY KEY,
    first_seen_at  INTEGER NOT NULL,
    last_seen_at   INTEGER NOT NULL,
    user_agent     TEXT,
    referrer       TEXT,
    landing        TEXT,
    user_id        TEXT,
    linked_at      INTEGER
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS visitor_last_seen ON visitor (last_seen_at);
  CREATE INDEX IF NOT EXISTS visitor_first_seen ON visitor (first_seen_at);
  CREATE INDEX IF NOT EXISTS visitor_user ON visitor (user_id) WHERE user_id IS NOT NULL;
  CREATE TABLE IF NOT EXISTS visitor_day (
    visitor_id    TEXT NOT NULL,
    day           INTEGER NOT NULL,
    minutes       INTEGER NOT NULL,
    last_tick_at  INTEGER NOT NULL,
    PRIMARY KEY (visitor_id, day)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS visitor_day_day ON visitor_day (day);
  CREATE TABLE IF NOT EXISTS visitor_feature (
    visitor_id  TEXT NOT NULL,
    day         INTEGER NOT NULL,
    feature     TEXT NOT NULL,
    minutes     INTEGER NOT NULL,
    PRIMARY KEY (visitor_id, day, feature)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS visitor_feature_day ON visitor_feature (day);
  CREATE TABLE IF NOT EXISTS visitor_hour (
    visitor_id  TEXT NOT NULL,
    day         INTEGER NOT NULL,
    hour        INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
    minutes     INTEGER NOT NULL,
    PRIMARY KEY (visitor_id, day, hour)
  ) STRICT, WITHOUT ROWID;
  `,
  // Where accounts and visitors use the map from: each address, its place in the DB-IP Lite city database, and
  // when it was seen. And the actions they take (packages/core usage.ts), counted per day: names only.
  `
  CREATE TABLE IF NOT EXISTS place_seen (
    subject_type   TEXT NOT NULL CHECK (subject_type IN ('user','visitor')),
    subject_id     TEXT NOT NULL,
    ip             TEXT NOT NULL,
    country        TEXT,
    region         TEXT,
    city           TEXT,
    latitude       REAL,
    longitude      REAL,
    first_seen_at  INTEGER NOT NULL,
    last_seen_at   INTEGER NOT NULL,
    minutes        INTEGER NOT NULL,
    PRIMARY KEY (subject_type, subject_id, ip)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS place_seen_last ON place_seen (last_seen_at);
  CREATE INDEX IF NOT EXISTS place_seen_country ON place_seen (country, last_seen_at);
  CREATE TABLE IF NOT EXISTS action_count (
    day           INTEGER NOT NULL,
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('anon','user','visitor')),
    subject_id    TEXT NOT NULL,
    action        TEXT NOT NULL,
    count         INTEGER NOT NULL,
    PRIMARY KEY (day, subject_type, subject_id, action)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS action_count_subject ON action_count (subject_type, subject_id, day);
  `,
  // Where people say they are: the browser's own fix when they use their location on the map, rounded server-side
  // (access/map-time-input.ts), and the town it's in from Nominatim. Far closer than an address's place_seen.
  `
  CREATE TABLE IF NOT EXISTS device_place (
    subject_type   TEXT NOT NULL CHECK (subject_type IN ('user','visitor')),
    subject_id     TEXT NOT NULL,
    latitude       REAL NOT NULL,
    longitude      REAL NOT NULL,
    accuracy_m     INTEGER,
    label          TEXT,
    first_seen_at  INTEGER NOT NULL,
    last_seen_at   INTEGER NOT NULL,
    fixes          INTEGER NOT NULL,
    PRIMARY KEY (subject_type, subject_id, latitude, longitude)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS device_place_last ON device_place (last_seen_at);
  `,
  // Reading the public pages (/map, /city, /guides…), which have no map minutes: per browser, day, page (its English
  // path), language and the outside site that sent it ('' for none), with how many times it was opened.
  `
  CREATE TABLE IF NOT EXISTS page_read (
    visitor_id  TEXT NOT NULL,
    day         INTEGER NOT NULL,
    path        TEXT NOT NULL,
    locale      TEXT NOT NULL,
    referrer    TEXT NOT NULL,
    views       INTEGER NOT NULL,
    PRIMARY KEY (visitor_id, day, path, locale, referrer)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS page_read_day ON page_read (day);
  `,
  // Recon probes sent from this server (port scan, TLS, vulnerability check, IP and username sweeps): Pro only.
  `
  INSERT OR IGNORE INTO bill_plan_entitlement (plan_id, key, value) VALUES
    ('anon', 'recon.scan', 'false'), ('free', 'recon.scan', 'false'), ('pro', 'recon.scan', 'true');
  `,
  // Each view of a public page and each opening of the map (path '/'), in order, which page_read's daily counts can't
  // show: when, the page read before it in the same tab, the linking page when the other site shares it, and the browser
  // and town it came from (with the town's rough position). The address isn't kept.
  `
  CREATE TABLE IF NOT EXISTS page_view (
    view_id     INTEGER PRIMARY KEY,
    visitor_id  TEXT NOT NULL,
    at          INTEGER NOT NULL,
    day         INTEGER NOT NULL,
    path        TEXT NOT NULL,
    locale      TEXT NOT NULL,
    referrer    TEXT NOT NULL,
    referrer_path TEXT,
    from_path   TEXT,
    campaign    TEXT,
    country     TEXT,
    region      TEXT,
    city        TEXT,
    latitude    REAL,
    longitude   REAL,
    browser     TEXT NOT NULL,
    os          TEXT NOT NULL,
    device      TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS page_view_day ON page_view (day);
  CREATE INDEX IF NOT EXISTS page_view_visitor ON page_view (visitor_id, at);
  `,
  // Crawlers and scripts reaching the web app's pages, robots.txt and sitemaps, as its proxy tells by their user agent
  // (packages/core crawlers.ts): requests per day, crawler and section, and per page for the last two weeks.
  `
  CREATE TABLE IF NOT EXISTS crawl_hit (
    day      INTEGER NOT NULL,
    bot      TEXT NOT NULL,
    section  TEXT NOT NULL,
    hits     INTEGER NOT NULL,
    PRIMARY KEY (day, bot, section)
  ) STRICT, WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS crawl_path (
    day      INTEGER NOT NULL,
    bot      TEXT NOT NULL,
    path     TEXT NOT NULL,
    hits     INTEGER NOT NULL,
    last_at  INTEGER NOT NULL,
    PRIMARY KEY (day, bot, path)
  ) STRICT, WITHOUT ROWID;
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
