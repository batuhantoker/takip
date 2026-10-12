# Backend

> **Status:** design, not built. Written 2026-10-12.
> Companion files: [`backend-schema.sqlite.sql`](./backend-schema.sqlite.sql) (application data) and [`replay-database.md`](./replay-database.md) (the data platform this backend serves).

## 1. Decisions

| Topic | Decision |
|---|---|
| Starting point | **Assembled from libraries; no SaaS boilerplate.** The common starters (next-saas-starter, Makerkit, Supastarter, ShipFast, ixartz) assume Postgres plus Vercel, Supabase or Clerk, and expect to own the app. Ours is a large map app with its own data platform. Starters are reading material only. |
| Repository | **Refactored in place into a monorepo.** The current Next app moves to `apps/web` unchanged. New services sit next to it. The 85 API routes move out gradually (§13). |
| Services | `web` (Next.js UI), `api` (Hono on Node: auth, billing, public API, data serving), `ingest` (always-on worker), `intel` (existing). The `api` service owns every database write except ingest and imports. |
| Auth | **Better Auth.** Email and password with verification and reset, plus Google and GitHub OAuth. Sessions are cookies backed by the database. Plugins: `admin`, `apiKey`; `organization` and `twoFactor` are ready to switch on. It supports SQLite now and Postgres later through the same config. |
| Paywall | Subscription tiers. **Entitlements are stored as data, not code,** so "we will see" means editing rows. The billing provider sits behind an adapter and is chosen later (§7.4). |
| Paid at launch | API access and quotas. Everything else is an entitlement row that can be moved between tiers. |
| Anonymous | The live map stays open without an account. An account adds saved workspaces, API keys and whatever plans unlock. |
| Also in scope | Admin console and saved workspaces. |
| App data store | `data/db/app.db` (SQLite), separate from the data platform's files. **It gets backups** (§12.2): unlike the data platform, it can't be rebuilt from an archive. |

## 2. System shape

```text
browser ──► nginx :80/:443 ──┬─ /api/auth/*  /api/v1/*  /api/replay/*  /api/tiles/*  /api/live/*  /api/admin/*  /api/billing/*
                              │        └─► api :4100  (Hono + Better Auth)  ──► app.db, data/db/** (read)
                              │                 ▲  internal WS + HTTP (live state, open-hour chunks)
                              │                 └── ingest :4200 (internal only) ──► archive, catalog/stream/tracks
                              └─ everything else (pages, assets, legacy /api/*) ─► web :3000 (Next.js)
                                                                                    └─► api (internal) for session/SSR
                                 intel :4000 (internal) ◄── api /v1/entity/expand
```

| Service | Owns | Doesn't |
|---|---|---|
| `web` (Next.js) | Pages, the map UI, account/admin/workspace screens, SSR. Legacy `/api/*` routes until they move (§13). | Writing app data directly, or holding sessions itself |
| `api` (Hono) | Better Auth handler and sessions, plans, entitlements, billing webhooks, API keys, quotas and metering, workspaces, admin API, `/api/v1` public API with OpenAPI, replay/tiles/live serving, on-demand lookups (geocode, directions, dossiers) | Polling upstream feeds |
| `ingest` | Connectors, recorder, seal jobs, live state in memory, coverage (`replay-database.md` §7) | Serving the public |
| `intel` | Entity resolution graph (unchanged) | — |

- **One origin.** nginx routes by path, so session cookies need no CORS, and `/api/auth/*` sits on the same host as the UI.
- **The routing switch also handles migration.** Moving a legacy route group from `web` to `api` is one nginx `location` block plus the ported handler.
- **Why a separate API process rather than Next route handlers:**
  - It holds long-lived state: a pool of SQLite handles, worker threads, live WebSocket fan-out, in-memory rate limiters.
  - It serves binary WebSocket frames.
  - It produces an OpenAPI spec for paying API users.
  - Next's dev reloads and bundling make all of that fragile.
  - Hono uses the same Web `Request`/`Response` types as Next route handlers, so porting a route is mostly mechanical.

## 3. Monorepo layout

**Where it stands (2026-10-12):** `apps/api` is an npm workspace next to the Next app, which stays at the repo root. Inside it, `src/` is split by feature: `auth/`, `access/` (plans and entitlements), `db/`, `mail/`, `cli/`, `testing/`, with each test next to its code. `packages/core` exists with one module, `@takip/core/entitlements` (the entitlement catalogue and access types), because the web app and the api both need it. The move to `apps/web`, the `packages/*` split, Turborepo and project references wait until a second app needs shared code and nothing else is in flight. The tree below is the target.

```text
apps/
  web/            the current Next app, moved as-is (src/, public/, next.config.ts)
  api/            Hono server: routes/, middleware/, openapi
  ingest/         worker: connectors/, recorder/, jobs/, live/
  cli/            npm run import <dataset>, db:check, db:export, admin bootstrap
  intel/          moved from ./intel
packages/
  config/         env schema (zod), loaded and validated at boot by every app
  core/           domain types, Observation, time/precision, TRK1/TRKC codecs (shared by api, ingest, web)
  db/             store interfaces + SQLite implementation (+ Postgres later), migrations per file kind
  auth/           Better Auth server config; client helpers for web
  billing/        plans, entitlement resolver, provider adapters
  connectors/     upstream connectors moved out of apps/web/src/app/api and src/lib
  ui/             later: shared React pieces (admin tables, forms)
tooling/          tsconfig, eslint, vitest presets
```

- **Tooling:** npm workspaces (keeps `package-lock.json`) plus **Turborepo** for task caching and `turbo prune` Docker builds.
- **TypeScript** uses project references. Vitest is configured per package.
- **`api`, `ingest` and `cli`** run with `tsx` in development and are bundled with `tsup` for production. `web` keeps the Next standalone build.
- **CI** gates on lint, typecheck and tests (`TODO.md` §8) before the image publish step.

## 4. Libraries

| Need | Choice | Why | Alternatives considered |
|---|---|---|---|
| HTTP server | **Hono** + `@hono/node-server` | Web-standard handlers (same types as Next routes), fast, small, first-class TS | Fastify (heavier plugin model), NestJS (heavy DI, decorators), AdonisJS (good, but brings its own ORM and conventions) |
| OpenAPI | `@hono/zod-openapi` + `@scalar/hono-api-reference` | The spec is generated from the same zod schemas that validate requests. Docs at `/api/v1/docs` replace the hand-written `apiCatalog.ts`. | tRPC (not suitable for a public API) |
| WebSocket | `@hono/node-ws` (on top of `ws`, already a dependency) | Binary live frames | Socket.IO (unnecessary) |
| Auth | **Better Auth** | Self-hosted. SQLite and Postgres through Kysely, including a `better-sqlite3` handle directly. Email+password, OAuth, `admin`, `apiKey`, `organization`, `twoFactor` and `passkey` plugins, built-in rate limiting. Auth.js is now maintained by the same team. | Auth.js (in maintenance mode), Lucia (deprecated), Clerk (hosted, not self-hosted), Keycloak/Authentik/Zitadel (an extra server for a single app) |
| Validation | zod | Shared by API, OpenAPI and workspace state | — |
| Database | `better-sqlite3` via the `packages/db` stores; Kysely for app data | Kysely is what Better Auth uses, and it runs on both SQLite and Postgres | Drizzle (fine; one query builder is enough), Prisma (weak on SQLite→PG parity, and its own engine) |
| Email | `nodemailer` (SMTP) + `react-email` templates behind an `EmailSender` interface | Any provider: Resend, Postmark, SES or self-hosted SMTP | Provider SDKs (lock-in) |
| Jobs | Small SQLite job table (`job`) in `app.db`, polled by `api` | Emails, webhook retries, billing reconciliation. No Redis needed. | BullMQ (needs Redis), pg-boss (needs Postgres; the natural swap later) |
| Logging | `pino` (JSON) | Replaces `[OSIRIS] console.*` (`TODO.md` §2) | — |
| Metrics | `prom-client` at `/metrics` (internal only) | Ingest lag, quota burn, request rates for the admin console | — |
| Admin UI | Next route group `/admin` with shadcn/ui and TanStack Table | Tailwind is already in the app; no second admin framework | refine.dev (a good accelerator if CRUD screens multiply), AdminJS, Payload (would take over the Next config) |

## 5. Request pipeline (api)

Middleware runs in this order for every request:

```text
requestId → pino logger → principal → rate limit → entitlement guard → handler → usage meter
```

1. **Principal.** Resolved from the first match:
   - **API key** (`Authorization: Bearer tk_…`). Keys are hashed at rest, and the lookup is cached for 30 s.
   - **Session cookie** (Better Auth).
   - **Anonymous**, keyed by client IP from `cf-connecting-ip` or `x-forwarded-for`. The header is only trusted from nginx.

   Result: `{ kind: 'anon' | 'user' | 'key', userId?, orgId?, keyId?, ip }`.
2. **Plan and entitlements.** The principal maps to a subject (user, or org later), then to its active subscription and plan, then to entitlements, cached for 60 s.
   - **Anonymous** gets plan `anon`; **signed-in users without a subscription** get `free`.
   - **The entitlements include `data.licence_tier`,** which feeds the licence gating in `replay-database.md` §8.7. Data access and billing therefore share one mechanism.
3. **Rate limit.** An in-memory token bucket per principal handles requests per second. Daily quotas are counted in memory and flushed to `usage_counter` every 10 s; on boot, today's counts are reloaded. While `api` is a single process, memory is authoritative. With several instances, this moves to Postgres or Redis.
   - Responses carry `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`.
   - Exceeding a limit returns `429` with `Retry-After`.
4. **Entitlement guard.** Routes declare their requirements, for example `requires: ['api.enabled']` and `limit: 'replay.lookback_days'`. A missing entitlement returns:

   ```json
   403 {"error":"entitlement_required","entitlement":"api.enabled","upgrade_url":"/pricing"}
   ```

   The UI turns this into an upgrade prompt.
5. **Usage meter.** Counts requests and bytes per subject, key, day and route group. This drives quotas, the admin console and the cost-per-user analysis in `TODO.md` §6.

## 6. Authentication

**Better Auth configuration** (`packages/auth`):

- **Methods:**
  - Email and password, with required email verification, password reset, and breach-list checks (`haveIBeenPwned` plugin).
  - Social sign-in: Google, Facebook, Apple, Microsoft, GitHub, X and Discord, each offered only when its credentials are set (`apps/api/src/auth/social-providers.ts`; the dialog asks `GET /api/v1/auth/providers`).
    - A provider that doesn't vouch for the email (often Facebook) makes the user confirm it by email first (`requireEmailVerification` per provider).
    - It joins an existing account with the same email only when both sides have proven the address. A password account that never confirmed its email is not joined, which blocks pre-registration takeovers. Better Auth's `requireLocalEmailVerified` default does this, and a test pins it. The rightful owner recovers such an address through "Forgot password?": the reset mail reaches the real mailbox.
    - Failures come back to the map as `/?account=sign-in-failed&error=<code>`.
  - Passkeys and 2FA are ready to enable. **2FA is required for `admin` role accounts** from day one.
- **Sessions:**
  - Stored in the database, valid 30 days, sliding refresh once a day.
  - Cookies `takip.session_token` and `takip.session_data` (the 5-minute cache), `HttpOnly`, `SameSite=Lax`. Over https they become `Secure` and gain the `__Secure-` prefix.
  - `session.cookieCache` is on, valid 5 minutes, so most requests don't read the database.
- **Tables** live in `app.db` with an `auth_` prefix (`auth_user`, `auth_session`, `auth_account`, `auth_verification`, `auth_apikey`), set through Better Auth's `modelName` options. The Better Auth CLI generates and applies their migrations. They map to the Postgres schema `auth.*`.
- **Plugins:**
  - `admin`: roles `user` and `admin`, ban, impersonation (audited).
  - `apiKey`: key creation, prefix `tk_`, hashing, expiry, revocation. **Check whether verifying a key writes to the database on every request** (`lastRequest`, remaining-count updates). If it does, use the plugin only to manage keys, and verify through the cached lookup and in-memory meter (§5), to keep request traffic off `app.db`'s write lock.
  - `organization`: off for now. It becomes team workspaces and team plans later.
- **Rate limits** on `/api/auth/*` use Better Auth's built-in limiter, stored in the database, with strict limits on sign-in, sign-up and reset.
- **Email** for verification and reset is sent by the `EmailSender`, queued through the `job` table, and retried. *Built so far:* sent directly in the background after the response (no queue or retry yet).
- **Emailed links land on the map,** not on separate pages: `/?account=verified` and `/?account=reset-password&token=…` open the account dialog in the right state (`src/lib/account-links.ts`). Sign-in passes no `callbackURL`, because the client follows it after every successful sign-in; when an unverified user signs in, the client asks for a fresh link itself.

**In `web`:**
- `better-auth/react` is used for sign-in and sign-up forms and for session hooks against the same origin.
- **Server components** get the session through `packages/auth.getSession(headers)`. It calls `http://api:4100/api/auth/get-session` internally and forwards the cookie. There is one owner of sessions, and no second Better Auth instance.
- **`middleware.ts`** gains a cheap cookie-presence redirect for `/account/*` and `/admin/*`. The real check happens on the server.
- **Map shell:** an account button sits in the top bar (`ui-direction.md`: search and controls live there). Sign-in opens as a dialog over the map, not as a page change.

**Header conflict to fix:**
- **Today:** OI, OI Assist and MCP accept a *model provider key* in `Authorization: Bearer` (`lib/oi/service.ts:5`, `api/mcp/route.ts:19`).
- **Change:** model keys move to `X-OI-Key` only, and `Authorization` is reserved for our own API keys and sessions. This breaks existing MCP client configurations, so it needs a changelog note and a transition period of one release that accepts both forms, logging a warning.

## 7. Plans, entitlements and billing

### 7.1 Model

- **Tables:**
  - `bill_plan`: `anon`, `free`, then paid plans such as `pro` or `api`.
  - `bill_plan_entitlement`: one row per plan and entitlement key.
  - `bill_subscription`: per subject, written **only** by provider webhooks or an admin comp.
  - `bill_customer`: provider customer ids.
  - `bill_event`: received webhooks, for idempotency and audit.
- **Resolver:** `entitlements(subject) = plan(subscription(subject)) ⊕ per-subject overrides (admin grants)`.
  - A subscription counts as active when its status is `active` or `trialing`, or when it is `past_due` but still within a 7-day grace period.
  - The result is cached for 60 s and invalidated by webhooks.
- **Subjects** are users now; `org` is already a valid subject type for later.

### 7.2 Entitlement catalogue (starting values are placeholders)

| Key | Type | anon | free | paid (example) |
|---|---|---|---|---|
| `map.live` | bool | ✓ | ✓ | ✓ |
| `api.enabled` | bool | ✗ | ✗ | ✓ |
| `api.keys.max` | int | 0 | 0 | 5 |
| `api.requests_per_day` | int | — | — | 100,000 |
| `api.rps` | int | — | — | 20 |
| `web.rps` (UI-originated data calls) | int | 10 | 20 | 50 |
| `replay.lookback_days` | int | 1 | 7 | 3650 |
| `replay.window_hours` | int | 6 | 24 | 720 |
| `workspaces.max` | int | 0 (local only) | 5 | 100 |
| `workspaces.share` | bool | ✗ | ✓ | ✓ |
| `export.enabled` | bool | ✗ | ✗ | ✓ |
| `ai.hosted` | bool | ✗ | ✗ | later |
| `data.licence_tier` | enum | `anon` | `free` | `paid` |

Moving a feature between tiers is a row edit made in the admin console. No deploy is needed.

*Built:* the rows are seeded by `apps/api/src/db/migrations.ts`. Until the admin console exists, `npm run plan -- set <plan> <key> <value>` edits them, and `grant`, `revoke`, `override` and `show` manage users; every change writes an `audit_event`. A running api picks changes up within its 60-second cache.

### 7.3 Billing flow (provider-agnostic)

```ts
interface BillingProvider {
  id: 'stripe' | 'paddle' | 'polar' | 'lemonsqueezy' | 'iyzico';
  checkout(p: { subject: Subject; planPriceId: string; successUrl: string; cancelUrl: string }): Promise<{ url: string }>;
  portal(p: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  verifyWebhook(req: Request): Promise<BillingEvent[]>;      // signature check + normalise
  fetchSubscription(providerSubId: string): Promise<SubscriptionSnapshot>;  // reconciliation
}
type BillingEvent =
  | { type: 'subscription.upserted'; eventId: string; snapshot: SubscriptionSnapshot }
  | { type: 'subscription.canceled'; eventId: string; providerSubId: string; endsAt: number }
  | { type: 'payment.failed';        eventId: string; providerSubId: string };
```

1. **Checkout.** `POST /api/billing/checkout {plan}` → `provider.checkout` → redirect to the hosted checkout page. No card data ever touches our servers.
2. **Webhook.** `POST /api/billing/webhook/:provider` verifies the signature, then inserts into `bill_event` (a unique `(provider, event_id)`, so replays are no-ops). In one transaction it upserts `bill_subscription`, invalidates the entitlement cache, and writes an `audit_event`.
3. **Reconciliation.** A daily job calls `fetchSubscription` for every non-final subscription, which catches missed webhooks.
4. **Portal.** `POST /api/billing/portal` → `provider.portal` (the provider's hosted page for plan changes, invoices and cancellation).
5. **Comps and trials.** An admin can grant a plan with an end date (`bill_subscription.provider = 'manual'`).

### 7.4 Choosing the provider (open decision)

It depends on where the business is registered. Stripe doesn't onboard every country, including Turkey. **Verify each option's current country support before choosing.**

| Option | Seller of record | Sales tax / VAT | Fits when | Better Auth plugin |
|---|---|---|---|---|
| Stripe (+ Stripe Tax) | You | You file, with Stripe's help | The entity is in a Stripe-supported country (or via Stripe Atlas, a US LLC) | Official (`@better-auth/stripe`) |
| Paddle | Paddle | Included | You want global tax handled for you | Community |
| Polar | Polar | Included | Developer or API product; check that payouts reach your country | Official (`@polar-sh/better-auth`) |
| Lemon Squeezy | Lemon Squeezy | Included | Simple subscriptions, broad payouts | Community |
| iyzico (or PayTR) | You (Turkish entity) | You | Turkish customers, TRY pricing, local cards | None (write the adapter) |

- **Recommendation:** a merchant of record (Paddle or Polar) unless there is already a company in a Stripe country. It removes global VAT and sales-tax work for a solo builder.
- **Either way,** the adapter interface stays the same, and plugins are only used inside an adapter, if at all.

## 8. Public API and quotas

- **`/api/v1/*`**: versioned, zod-validated, and documented by the generated OpenAPI spec at `/api/v1/docs` (Scalar).
- **The web app also uses `/api/v1`,** authenticated by session cookie with the `web.rps` limits. There is one API, not a private one and a public one.
- **Keys:**
  - Users create them in Account → API keys. A key is shown once and stored hashed with its prefix.
  - It carries optional scopes (`read:tracks`, `read:events`, `read:series`, `export`) and an expiry.
  - A key counts against its owner's plan.
- **Quotas (§5):** per-second token buckets and daily counters, with `RateLimit-*` headers. A `GET /api/v1/usage` endpoint shows the caller's own usage.
- **The MCP server** (`/api/mcp`) moves under `api` and authenticates with the same keys. A bring-your-own model key stays free through `X-OI-Key`.
- **What `v1` covers first:**
  - replay manifest, tracks chunks, event and feature tiles, series, TLE, entity as of a time;
  - search;
  - on-demand lookups: geocode, reverse geocode, aircraft and flight detail, directions, region dossier.

  Their contracts are the ones in `replay-database.md` §8.
- **Existing upstream rate limits still apply** (Nominatim, OpenSky, Photon). Upstream-heavy lookups get their own lower per-key limits and shared server-side caches, so no single user can burn an upstream quota.

## 9. Data ingest and serving

- **Ingest** is the worker from `replay-database.md` §7. It is not reachable from the public internet.
- **Internal channel from ingest to the API:**
  - `ws://ingest:4200/internal/live`, authenticated by a shared secret. The worker pushes compact binary deltas per layer about once a second (positions changed, entities appeared or expired).
  - `GET http://ingest:4200/internal/open-hour/{class}/{z}/{x}/{y}` serves provisional chunks for the hour that isn't sealed yet.
  - The API holds the latest delta state and fans it out to clients.
- **Live to the browser:**
  - **`/api/live/ws` (WebSocket, binary)** for moving entities. The client sends `subscribe {layers, bbox, zoom, filters}` and updates it as the map moves. The server pushes only the changes inside the subscription. This replaces the full 2.9 MB maritime and 3.1 MB flights snapshots polled every 10 s.
  - **`/api/live/events` (SSE)** for low-rate pushes such as new events, alert pins and source status.
- **Replay and tiles:** the `/api/replay/*` and `/api/tiles/*` routes in `replay-database.md` §8 live in `api`. They use read-only SQLite handles and a `piscina` worker pool. The principal's `data.licence_tier` and replay limits are applied to every query.
- **Health:** `ingest` exposes `/internal/health` and `/metrics`. The admin console shows connector status, lag, coverage gaps and upstream quota burn (`TODO.md` §6).

## 10. Saved workspaces

- **What a workspace stores:** basemap, active layers and filters, viewport, time state (`t`, window, rate), drawn areas, pins, open dock tool.
- **Format:** one JSON document validated by a versioned zod schema (`WorkspaceStateV1` in `packages/core`), at most 256 KB.
- **Table** `ws_workspace`: `id` (ULID), owner, org (later), name, state, `state_version`, `rev` for optimistic concurrency, visibility (`private`, `link`, `public`), `share_slug`, timestamps, soft delete.
- **API:**
  - `GET /api/v1/workspaces` and `POST /api/v1/workspaces`.
  - `GET /api/v1/workspaces/:id` and `PUT /api/v1/workspaces/:id`. The `PUT` takes `If-Match: <rev>`, and a stale `rev` returns `409`.
  - `DELETE /api/v1/workspaces/:id`.
  - `GET /api/v1/w/:slug` reads a shared workspace.
- **Share links:** `/w/<slug>?t=<epoch>` opens the workspace read-only at a point in time, which makes it a replay deep link. Owners can revoke a link by rotating the slug.
- **Moving from localStorage:** today's keys hold state per device (`osiris.layers`, `osiris.aoi.shapes.v1`, `osiris.recent-places`, `osiris.markets.watchlist`). On first sign-in, the client offers to import them as a workspace named "Imported from this device". Anonymous users keep using localStorage as now.
- **Autosave:** the current workspace is debounced and saved after 2 s of inactivity, and only when it has changed.

## 11. Admin console

- **Where it runs:** web route group `/admin`, allowed only for role `admin` with 2FA. It calls `/api/admin/*`, and every mutation writes an `audit_event`.
- *Built (2026-10-12):*
  - **Gate:** `apps/api/src/admin/gate.ts`.
    - It needs the `admin` role, 2FA turned on, and a 2FA code entered on this session within the last 12 hours, stored in `admin_unlock`.
    - Wrong codes are counted per user: 5 within 15 minutes lock it.
    - The step-up is needed because Better Auth's `twoFactor` plugin only guards password sign-in. A session from Google or GitHub never saw a code.
    - Admin routes read the session with the cookie cache off, so demotions and bans apply at once.
  - **Better Auth plugins:** `admin` (roles, bans) and `twoFactor` (TOTP, backup codes). The admin plugin's own `/api/auth/admin/*` endpoints are blocked, because they would skip the gate; the console calls the plugin server-side.
  - **First admin:** `npm run admin -- promote <email>`. Role changes stay in the CLI, so the console can't lock its own admins out.
  - **Pages:**
    - Overview: counts and recent changes.
    - Users: search, and a detail page to grant or revoke a plan, add or remove exceptions, ban or unban, and sign the user out everywhere.
    - Plans: edit entitlement values in place.
    - Audit log.
  - **Tables:** plain Tailwind; shadcn/ui and TanStack Table can come in when the tables need sorting and column filters.
  - **Not built:** impersonation (it needs a banner in the map shell); the API keys, billing, sources, datasets, licences, cameras and system pages wait for their features.
- **Not part of the map shell.** The UI-direction rule about the dock and inspect card applies to the map, not to `/admin`.

| Page | Contents |
|---|---|
| Users | Search, view, ban or unban, impersonate (audited), reset sessions, grant or comp a plan, per-user entitlement overrides |
| Plans and entitlements | Edit plans, entitlement values and provider price ids |
| Subscriptions and billing | Subscriptions by status, `bill_event` log, re-run reconciliation for a subject |
| API keys and usage | Keys per user, revoke, usage charts by route group and day, top consumers |
| Sources and ingest | `meta_source` registry (enable, disable, config), connector health, lag, last run, coverage gaps, upstream quota burn |
| Datasets | Import history, reports, unresolved values, superseded versions, re-run an import |
| Licences and access | `meta_licence`, `meta_access_policy` per tier |
| Cameras | Blocklist, tombstones, catalogue diff per run |
| Audit log | Filter by actor, action, subject, time |
| System | Disk use per `data/` area, backup status, job queue, feature flags |

## 12. Application data

### 12.1 `app.db`

Better Auth tables (`auth_*`, generated by its CLI) plus ours, in [`backend-schema.sqlite.sql`](./backend-schema.sqlite.sql):
- billing: `bill_plan`, `bill_plan_entitlement`, `bill_subject_override`, `bill_customer`, `bill_subscription`, `bill_event`;
- usage: `usage_counter`;
- workspaces: `ws_workspace`;
- operations: `audit_event`, `job`, `feature_flag`.

It follows the same portability rules as the data platform (`replay-database.md` §11): `STRICT` tables, epoch milliseconds, JSON as `TEXT`, and table names that map to Postgres schemas (`bill_plan` → `bill.plan`). **`app.db` is the first candidate to move to Postgres** once there's more than one `api` instance. Better Auth and Kysely make that a configuration change plus a data copy.

### 12.2 Backups (required for `app.db`)

- **Litestream** replicates `app.db`'s WAL continuously to an S3-compatible bucket (Backblaze B2 or Cloudflare R2, a few cents a month at this size). It runs as a small sidecar container.
- **A nightly `VACUUM INTO` snapshot** goes to `data/backups/` as a second copy on the box.
- **A restore drill** is in the runbook and is tested once before launch.
- The rest of `data/` stays under the earlier "no backups for now" decision.

### 12.3 Privacy

- **Account deletion:**
  - Removes sessions, accounts, API keys and workspaces.
  - Pseudonymises usage and audit rows, which keep the subject id but lose the email.
  - Keeps billing records only as long as tax law requires, stored at the provider.
- **Data export:** `GET /api/v1/account/export` returns the user's data as JSON.
- **Umami:** removed. It reported page views and every visitor's IP to the upstream author's Umami instance.
- **Session cookies are strictly necessary,** so no consent banner is needed for them. Revisit if marketing analytics are added.
- **Applicable law:** GDPR, and KVKK if the business is Turkish. Update `/privacy` before accounts launch.

## 13. Moving the 85 legacy routes

The move follows the strangler pattern: one group at a time, each behind an nginx `location` switch, with its tests ported alongside.

| Group | Today | Target | When |
|---|---|---|---|
| Live feeds: flights, maritime, satellites, cctv, earthquakes, fires, weather, weather-grid, news, gdelt, gdelt-events, conflicts, cyber-attacks, malware (+stream), cloudflare-radar, space-weather, markets | Fetch upstream inside `web` | Fetching moves to `ingest` connectors; serving moves to `api` `/api/v1` and `/api/live` | With data phases 1c and 2. The browser switches layer by layer. |
| On-demand lookups: aircraft, flight-route, geosearch, geo/reverse, region-dossier, directions, arcgis, satellites/orbit, markets/history, entity/expand | `web` | `api` `/api/v1/*`, with per-key upstream limits | Early; mostly mechanical ports |
| Media proxies: cctv/proxy, frame, resolve, stream-status, texas/snapshot, proxy-tiles | `web` | `api`, as a **closed proxy** that takes ids, never URLs (`INSPIRATION.md` L169) | With the camera move to `catalog.db` |
| AI and OI: ai/*, oi/*, mcp | `web` | `api`; BYO key free; hosted AI gated by `ai.hosted` | After auth, because ai/* can spend the server's Gemini keys today |
| OSINT and recon: osint/*, scanner | `web` | `api`, account required, stricter limits. **Or removed** (`TODO.md` §7 decision). | After the §7 scope decision |
| Platform: sdk/ingest, sdk/stream, github-webhook, health, stats, reference | `web` | `api`. `sdk/ingest` uses API keys with a `write:entities` scope instead of the shared `SDK_INGEST_KEY`. | Alongside the routes that depend on them |

## 14. Security baseline

- **Same origin; Better Auth `trustedOrigins`** limited to our domains. Cookies are `HttpOnly`, `Secure` and `SameSite=Lax`, and Better Auth's CSRF/origin checks are on.
- **API keys never appear in URLs.** They are hashed at rest, shown once, and revocable. Key prefixes are logged; full keys never are.
- **Webhooks** have their signatures verified, and repeated deliveries are rejected through `bill_event` uniqueness.
- **Admin accounts** require 2FA. Impersonation and all admin mutations are audited.
- **Secrets** come only from the environment. `packages/config` validates them at boot and refuses to start if one is missing.
- **Internal ports** (ingest 4200, intel 4000, `/metrics`) are not published by Docker, only exposed on the internal network.
- **Still open from `TODO.md` §2:** SSRF review of every URL-fetching route, popup XSS, CSP and CORS. The closed media proxy (§13) removes the largest SSRF surface.

## 15. Deployment

| Service | Image | Port | Memory |
|---|---|---|---|
| `web` | `apps/web` Next standalone | 3000 (internal) | 1.5 GB (drops further as feeds leave it) |
| `api` | `apps/api` (tsup bundle, `node:22-alpine`) | 4100 (internal) | 1.5 GB |
| `ingest` | `apps/ingest` | 4200 (internal) | 1.5 GB |
| `intel` | `apps/intel` | 4000 (internal) | 0.5 GB |
| `nginx` | `nginx:alpine` | 80/443 (public) | 0.25 GB |
| `litestream` | `litestream/litestream` | — | 64 MB |

- **That adds up to about 5.3 GB,** which leaves about 10 GB of the NUC's 16 GB for the OS page cache that SQLite reads through.
- **Volumes:** `./data` is mounted into `api`, `ingest` and `web` (read-only for `web` once it no longer writes caches). Ownership is uid 1001.
- **One `.env`.** Each app reads its subset through `packages/config`. New variables:
  - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
  - `GOOGLE_CLIENT_ID`/`_SECRET`, `GITHUB_CLIENT_ID`/`_SECRET`
  - `SMTP_URL`, `MAIL_FROM`
  - `BILLING_PROVIDER` and that provider's keys and webhook secret
  - `INGEST_INTERNAL_SECRET`
  - `LITESTREAM_*`
- **`deploy.sh`** was removed: it deployed to the upstream author's server. A new deploy script builds per-app images once hosting is chosen.

## 16. Build order (interleaved with the data platform phases)

| Phase | Backend | Data platform (`replay-database.md` §13) |
|---|---|---|
| **B0** | Monorepo skeleton: move the app to `apps/web` unchanged; `packages/config`, `packages/core`; Turborepo; CI gates (lint, typecheck, test). ~~Remove the Umami IP event~~ (done: Umami removed). | Phase 0 recorder (inside `apps/web`) |
| **B1** | **Started:** `apps/api` (Hono), Better Auth email+password sign-up, sign-in and sign-out, `app.db`, the account button and dialog; `web` proxies `/api/auth/*` to `api`. Required email verification and password reset, mailed through an `EmailSender` (SMTP, or the console in development). Social sign-in (Google, Facebook, Apple, Microsoft, GitHub, X, Discord). An Account settings dialog: name, password (change, or set one via the reset email), connect and disconnect providers (not Facebook, which never vouches for the email), signed-in devices, and account deletion confirmed by an email link opened in the signed-in browser. **Still to do:** nginx path routing. Litestream for `app.db`. The `X-OI-Key` header change starts. (Admin role and 2FA: built, see §11.) | 1a: `packages/db`, seeds |
| **B2** | Saved workspaces, share links, localStorage import | 1b: importers, historical atlas |
| **B3** | **Started:** plans and entitlements as rows, the resolver (plan ⊕ overrides, manual grants with end dates, a `past_due` grace period), the `withAccess`/`requires` middleware with the §5.4 403 body, `GET /api/v1/me/access` and `/api/v1/plans`, the operator CLI, the Plan section in Account settings, and `requireEntitlement()` for routes still in `web`. **Still to do:** rate limits and quotas, metering. Plans, entitlements resolver, API keys, quotas and metering, `/api/v1` with OpenAPI docs. On-demand lookups ported. **Billing adapter for the chosen provider:** checkout, portal, webhooks, reconciliation. | 1c: ingest worker |
| **B4** | **Started:** admin role, 2FA for admins with a per-session step-up, and the console's users, plans, audit and overview pages (§11). **Still to do:** keys and usage, sources and ingest health, datasets, licences, impersonation. | — |
| **B5** | Live WebSocket and SSE, replay and tiles in `api`. Remaining legacy route groups move (§13). | 2: replay feature |

**B0 and B1 come first, regardless of anything else.** No paid feature can ship without them, and they also close today's open spending risk on the server's Gemini keys.

## 17. Open decisions

1. **Billing provider and legal entity** (§7.4). This blocks only the B3 billing adapter; everything before it can proceed.
2. **Email delivery:** SMTP through a provider (Resend, Postmark, SES) or self-hosted. Self-hosted mail from a home NUC tends to land in spam.
3. **Plan contents and prices.** The entitlement rows (§7.2) are placeholders.
4. **Anonymous limits** (`replay.lookback_days`, `web.rps`).
5. **Teams now or later.** The `organization` plugin and `org` subjects are ready but off.
6. **OSINT and recon tools:** keep behind an account, or remove (`TODO.md` §7).
7. **Product name.** It affects the cookie name, the key prefix (`tk_`) and email sender domains (`TODO.md` §1). Settle it before B1 ships.
