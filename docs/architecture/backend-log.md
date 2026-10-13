# Backend: log and reference

> The history of the backend build, kept for reference: the original hand-off (§0–7, written at 15:53 on 2026-10-12), the user's decisions (§6 Answers) and the lead's progress log (§8). Working rules and gotchas are in §2–3; the procedure for landing branches in the shared working copy is in §8. **Planned work is in [`BACKEND-handoff.md`](../../BACKEND-handoff.md)**; some follow-ups listed in §8 have since been done.

_Written 2026-10-12 against `ui/shell-reorg` at `4794154`, plus a large amount of **uncommitted** work (§0). The plan this implements is [`docs/architecture/backend.md`](backend.md); read it first, then this._

## TL;DR

- **Built and tested:**
  - Accounts and sign-in (email, verification, reset, seven social providers, 2FA).
  - Account settings.
  - Free/paid access rules (plans and entitlements stored as rows).
  - An admin console behind role + 2FA + a per-session step-up.
  - 60 api tests pass; every UI piece was also checked in a real browser.
- **Not built:**
  - Rate limits, quotas and usage metering.
  - API keys.
  - The public `/api/v1` with OpenAPI.
  - Moving the 85 legacy routes.
  - Workspaces, billing, deployment, CI.
- **You are the lead.** Run at most **3 subagents at a time** (§5): the user's laptop kernel-panicked once under a full-core job.
- **Step 0:** the work is uncommitted, so worktree-isolated subagents would not see it. Get the user's go-ahead to commit it on a branch before fanning out.
- **Ask, don't decide:** §6 lists the product decisions only the user makes. Several workstreams wait on them.

---

## 0. Before anything: commit and branch

Everything below exists only in the working tree of `ui/shell-reorg`, interleaved with two other sessions' uncommitted work (CCTV adapters, drawing tools). Ask the user to approve, then:

1. `git switch -c backend/auth`
2. Stage **by name**, never `-A`:
   - `apps/`, `packages/`
   - `src/components/account/`, `src/components/admin/`, `src/app/admin/`
   - `src/components/ui/{menu-styles,use-dismiss}.ts`
   - `src/lib/{auth-client,access,access-server,account-links,device-label}*`
   - `tools/{dev,screenshot}.mjs`
   - `BACKEND-handoff.md`, `docs/architecture/`
   - the edits to `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `.gitignore`, `README.md`, `TODO.md`, `src/app/globals.css`, `src/components/shell/{more-menu,status-cluster}.tsx`
   - already staged: the deletions of `deploy.sh` and `src/middleware.ts`, and the renames `src/middleware.test.ts` → `src/maplibre-vendor.test.ts` and `vitest.config.ts` → `vitest.config.mts`
3. **`src/app/page.tsx` is shared.** Only two lines are ours: the `AccountDialog` import and the `<AccountDialog />` mount. The `queryArea`/`selectInArea` hunks are the drawing session's. Stage HEAD's file plus our two lines, whatever else is in the working copy:

   ```bash
   git show HEAD:src/app/page.tsx > /tmp/page.tsx
   python3 - /tmp/page.tsx <<'PY'
   import sys
   p = sys.argv[1]; s = open(p).read()
   imp = "import RegionDossier from '@/components/map/region-dossier';\n"
   mount = "      {isMobile && !showDirections && !navSession && <MobileStatus revealed={revealed} onOpenMarkets={() => setMobilePanel('markets')} />}\n"
   assert s.count(imp) == 1 and s.count(mount) == 1
   open(p, 'w').write(s.replace(imp, imp + "import AccountDialog from '@/components/account/account-dialog';\n").replace(mount, mount + "      <AccountDialog />\n"))
   PY
   git show HEAD:src/app/page.tsx | diff - /tmp/page.tsx    # expect exactly the two added lines
   git update-index --cacheinfo 100644,$(git hash-object -w /tmp/page.tsx),src/app/page.tsx
   ```

   The working file keeps everyone's edits. Dry-run on 2026-10-12: the diff showed exactly the two lines.
4. **`docs/architecture/`** (the plan) was untracked before this work began. It is the user's; ask whether it goes in this commit.
5. Leave alone; these belong to other sessions:
   - CCTV: `src/app/api/cctv/*`, `src/lib/cctv/*`, `DATA-SOURCES.md`, `docs/cctv-adding-sources.md`, `scratch/*`, `off`
   - drawing and boundaries: `src/lib/{draw,aoi,aoi-export,boundaries,boundary-store,geoboundaries}*`, `src/components/draw/*`, `src/components/map/*`, `src/app/api/boundaries/*`, `public/data/boundaries/`, `tools/build-boundaries.mjs`
   - other: `docs/SPACE-expension.md`
6. Check `git diff --cached --stat` before committing. A file showing a whole-file rewrite means line endings flipped (§3.3).

## 1. Where we are

> **§1 describes the state at 15:53 on 2026-10-12, before the lead session.** §8 is current and supersedes it, especially §1.5's gaps (gating, plan copy, the delete link elsewhere, session IPs and `getClientIp` are all done) and the test counts (the api suite is now about 600 tests).

### 1.1 Shape

```
browser ── Next dev :3000 ──┬─ pages, map, /admin (web)
                            └─ rewrites /api/auth/*, /api/v1/*, /api/admin/* ──► apps/api :4100 (Hono + Better Auth) ──► data/db/app.db
```

- **`npm run dev`** (`tools/dev.mjs`) starts both. Ctrl-C stops both, and the api's console email links print in the same terminal.
- **Rewrites** live in `next.config.ts` and are fixed at build time (`API_INTERNAL_URL`, default `http://127.0.0.1:4100`).
- **Env:** the api loads `.env.local`, then `.env`, in code (`apps/api/src/env.ts`, `loadEnvFiles`). `.env.local` and real env vars win. `tsx watch` restarts the api when either file changes.
- **`packages/core`** holds one module, `@takip/core/entitlements`: the entitlement catalogue and access types. Both apps use it; Next compiles it via `transpilePackages`.
- **Pinned versions** (all checked against installed types, not memory):

  | Package | Version |
  |---|---|
  | `better-auth` | 1.7.7 |
  | `hono` | 4.13.13 |
  | `@hono/node-server` | 2.1.4 |
  | `better-sqlite3` | 13.0.3 |
  | `nodemailer` | 10.0.11, exact |
  | `zod` | 4 |
  | `uqr` | 0.1.3 (QR codes) |
  | `vitest` | 4.1.11 (bumped from 2 for Better Auth's peer ranges) |

### 1.2 Files

```
apps/api/src/
  index.ts  app.ts  env.ts       boot, route mounting, env schema
  auth/      Better Auth config (auth.ts), emails, social providers, routes (+ email-password, social, account-settings tests)
  access/    resolver (plan ⊕ overrides, 60 s cache), grants (operator writes + audit), middleware (withAccess, requires), routes
  admin/     gate (role + 2FA + 12 h step-up), queries, routes (+ tests)
  db/        app-db.ts (pragmas), migrations.ts (our tables, PRAGMA user_version, append-only)
  mail/      EmailSender: console in dev, SMTP via nodemailer
  cli/       plan.ts (npm run plan), admin.ts (npm run admin)
  testing/   helpers.ts (startApp, Inbox, Jar, signUpVerified, googleApproves, viaGoogle), totp.ts
packages/core/src/entitlements.ts
src/components/account/   sign-in dialog, account menu, settings/ (plan, profile, sign-in methods, 2FA, devices, delete)
src/components/admin/     console shell + gate, overview, users, user detail cards, plans editor, audit log
src/app/admin/            thin route files for the console
src/lib/  auth-client.ts  access.ts (useAccess, usePlans)  access-server.ts (requireEntitlement for web routes)
          account-links.ts (the /?account=… landing URLs)  device-label.ts
tools/    dev.mjs (web + api)  screenshot.mjs (headless Chrome with a session cookie; see §2)
```

### 1.3 Behaviour that tests pin (`npx vitest run apps/api`, 60 tests)

- **Sign-up and verification:**
  - Email verification is required; there's no session until the emailed link is opened.
  - An unverified sign-in returns `EMAIL_NOT_VERIFIED`, and the client asks for a new link.
  - A repeat sign-up answers the same as a new one and mails the existing owner.
  - A reset for an unknown address sends nothing.
  - Mail goes out after the response, so response times don't reveal which addresses exist.
- **Origin check:** pinned on. Better Auth turns it off when `NODE_ENV=test`.
- **Social sign-in:** offered only for providers whose ID and secret are both set; the api refuses to boot with half a pair.
  - A provider that doesn't vouch for the email triggers email confirmation first (`requireEmailVerification` per provider).
  - It joins an existing account only if both sides have proven the email (Better Auth's `requireLocalEmailVerified`). A squatter's unconfirmed account is never joined.
  - Explicitly connecting a provider needs the same email, and a provider that vouches for it. **Facebook never vouches, so it can't be connected**; it can only sign in.
- **Account settings:**
  - rename; change password (other devices signed out)
  - a Google-only user sets a password through the reset email
  - list devices, sign out one or all others; the server-side sessions end at once (§1.5 covers the browser-side lag)
  - connect and disconnect providers (never the last one)
  - deletion via an emailed link that only works in the signed-in browser
- **Access:**
  - Visitors get `anon`, signed-in users `free`. A manual grant applies until its date. A provider subscription stays active through `past_due` within its grace period.
  - Per-user overrides apply until their expiry.
  - Bad plans, keys and values are refused.
  - `requires(key)` answers `403 {error:"entitlement_required", entitlement, upgrade_url}`.
- **Admin:**
  - The gate turns away anon (401), non-admins and admins without 2FA (403). The role is read fresh from the database, with the cookie cache off.
  - A step-up code is required per session and lasts 12 h. 5 bad codes in 15 min lock it. Backup codes work once.
  - The plugin's own `/api/auth/admin/*` returns 404, even to an unlocked admin.
  - Demotion applies at once.
  - Users: list and search, detail, grant and revoke, overrides, ban (ends sessions, blocks sign-in) and unban, no self-ban, sign out everywhere.
  - Plan edits; every mutation is in `audit_event` with the admin as actor.
- **2FA sign-in:** the password step returns `twoFactorRedirect`, and the code completes the sign-in.

### 1.4 Data (`data/db/app.db`)

- **Better Auth's tables:** `auth_user`, `auth_session`, `auth_account`, `auth_verification`, `auth_two_factor`. It migrates them at boot (`createAuth` migrates before constructing).
- **Ours** (`db/migrations.ts`):
  - `bill_plan`, `bill_plan_entitlement` (seeded `anon`, `free`, `pro` with the §7.2 placeholders), `bill_subject_override`, `bill_subscription`
  - `audit_event`
  - `admin_unlock`
- **Not created yet:** `bill_customer`, `bill_event`, `usage_counter`, `ws_workspace`, `job`, `feature_flag`. Schemas are in `docs/architecture/backend-schema.sqlite.sql`.
- **Operator CLIs:**
  - `npm run plan -- plans | show <email> | grant <email> <plan> [--until YYYY-MM-DD] | revoke | set <plan> <key> <value> | override | unoverride`
  - `npm run admin -- list | promote <email> | demote <email>`
- **The user is an admin:** `hello@takip.dev`, Google sign-in, 2FA on. Opening `/admin` asks them for a code every 12 hours.

### 1.5 Known gaps (not bugs in what's built; things not done)

- **Nothing is gated yet:** no production route uses `requires()` or `requireEntitlement()`. The server-key AI routes (`src/app/api/ai/*`) still spend Gemini quota for anyone (per-IP limits only).
- **Plan copy:** the Plan section advertises Pro features that don't exist (API access, 10-year replay, 100 workspaces, export).
- **`/privacy`** still says "no accounts".
- **No IP for sessions:** `ipAddress` is empty behind the Next rewrite (no `x-forwarded-for` reaches the api).
- **Spoofable client IP:** `src/lib/ssrf-guard.ts` `getClientIp` trusts `cf-connecting-ip` / `true-client-ip` from any peer.
- **Delete link elsewhere:** opened in a different browser, it answers raw JSON 404.
- **Cookie cache lag:** revocations (sign-out elsewhere, password reset, ban) take up to 5 min to reach a device still holding the cached session cookie. Server-side revocation is immediate and tested.
- **Docker untested:** the web image now installs workspace packages; there's no api image or compose service.
- **Unrelated failing tests:** `src/lib/oi/context.test.ts` and `src/app/api/cctv/route.test.ts`. Don't chase them.

## 2. How work is done here

- **The user's rules** (`~/.claude/CLAUDE.md` and project memory):
  - Comments sparse: one line, only what code can't say. Never narrate a change in a comment.
  - Kebab-case files in feature folders; no god files; split by responsibility.
  - `src/lib` must not import from `src/components`.
  - Ask before adding new rail-level UI features (dock model; see memory `ui-direction`).
  - Don't commit or push unless asked.
- **Library APIs:** read installed `.d.ts`/source before using any library API. Better Auth 1.7 differs from older docs in many small ways (§3.1). Every surprise in this work was caught that way.
- **Tests drive real endpoints:**
  - `startApp()` gives a fresh in-memory app.
  - `Inbox` captures mail (`await inbox.next()`); `Jar` holds cookies like a browser.
  - `googleApproves()` + `viaGoogle()` run a real OAuth callback against a stubbed token endpoint.
  - `totp(secret)` computes codes the way an authenticator app does.
  - Test the failure paths too, and assert error **codes**, not just statuses. One test once passed for the wrong reason.
- **Browser check for UI:**
  - `node tools/screenshot.mjs <url> <out.png> [--phone] [--cookies jar.txt] [--script steps.js]`
  - A signed-in jar comes from `curl -c jar.txt` against `localhost:3000/api/auth/sign-in/email` with `Origin: http://localhost:3000`.
  - Screenshots caught three real bugs this round (empty boolean dropdowns, a broken table row, wrong-zone dates).
- **Dev database etiquette:** `data/db/app.db` holds the user's real dev account.
  - If a check needs an account, create a throwaway (`*@example.invalid`), mark it verified by SQL if needed, then delete every row it touched (auth tables, `admin_unlock`, `audit_event`, `bill_*`), and tell the user.
  - Test migrations on a copy first: `db.backup()` into a temp file, then boot the api against it with `APP_DB_PATH`.
- **Secrets** go into `.env.local`; never print them. Count keys with `grep -c '^KEY=' .env.local`, not `cat`.
- **Other sessions share this working tree** (CCTV: `osiris-b3`, `osiris-a6`; drawing: `osiris-3f`).
  - If the app stops compiling because of their files, message them (`ListAgents`, `SendMessage`); don't edit their code.
  - Check `git status` before assuming a change is yours.
- **Report honestly:** what was tested and how, what wasn't, which failures aren't yours.

## 3. Gotchas already paid for

### 3.1 Better Auth 1.7.7

- **Migrate before constructing.** `betterAuth()` checks the schema at startup, so `createAuth` runs `getMigrations(options)` first. All plugin columns are optional, so migrations on a populated DB are safe (checked on a copy).
- **`callbackURL` on `signIn.email` makes the client navigate on success.** Sign-in passes none. Verification and reset links carry `/?account=…` landing URLs instead (`src/lib/account-links.ts`), and the account dialog opens itself from them.
- **Social sign-in options:** `signIn.social` takes `callbackURL` (back to the same map view) and `errorCallbackURL: '/?account=sign-in-failed'`. `onAPIError.errorURL` covers errors before state is known.
- **`unlinkAccount({ accountId })` wants Better Auth's account row `id`,** not the provider's account id.
- **A fresh session is required** (signed in within `freshAge`, 1 day) for `list-sessions` and `unlink-account`. The UI shows "sign in again" on `SESSION_NOT_FRESH`.
- **2FA covers only `/sign-in/email|username|phone-number`.** Social sign-in never sees a code; hence the admin step-up.
- **On an existing session, `verify-totp`/`verify-backup-code` have no lockout.** Count failures yourself.
- **Enabling 2FA replaces the session** (new session, old deleted). The client's session atom refreshes on `/two-factor/*` by itself.
- **Admin plugin calls server-side:** `auth.api.banUser`, `unbanUser` and `revokeUserSessions` with the admin's forwarded headers. Keep `/api/auth/admin/*` blocked (`auth/routes.ts`).
- **Use `disableCookieCache: true`** on `getSession` anywhere authorization must be current.
- **Storage format:** Better Auth stores dates as ISO text and booleans as 0/1 in SQLite. Our tables use epoch ms.
- **Background sends:** `advanced.backgroundTasks.handler` makes mail go after the response. Tests must `await inbox.next()`, not check synchronously.

### 3.2 Next, React, the web app

- **Viewport lock:** `html, body { overflow: hidden }` for the map. Scrollable pages opt out with `.docs-root` / `.admin-root` (`globals.css`).
- **Effects:** the React-compiler lint forbids synchronous `setState` in effects. Load in the effect with `.then()` and a `live` flag (see `devices-section.tsx`).
- **Next 16 route params** are a `Promise` (`users/[id]/page.tsx`).
- **Mounted-but-hidden UI:** the desktop status cluster is mounted but hidden on phones, so global UI (the account dialog) is mounted once in `page.tsx` and driven by a tiny store (`account-dialog-state.ts`).
- **Reload after config changes:** the providers list and plans are fetched once per page load.

### 3.3 Repo

- **Mixed CRLF/LF files:** `next.config.ts`, some components. Edit with `newline=''`.
- **Check line endings:**
  - Before committing, compare `git diff --stat` with `git diff --ignore-cr-at-eol --stat`.
  - To restore endings, rebuild from `git show HEAD:<file>`, keeping unchanged lines (`difflib` over CR-stripped lines).
- **`npm install` peer conflicts** come from Better Auth's optional framework peers (SvelteKit, TanStack Start). vitest 4 resolved them; don't use `--legacy-peer-deps`.
- **New workspace packages** must also be copied in the `Dockerfile` deps stage (`COPY packages/<name>/package.json`).

## 4. Workstreams

Ordered by dependency. Each lists what it owns, so parallel subagents don't collide. Plan sections refer to `backend.md`.

**A. Principal, rate limits, quotas, usage** (§5.1, §5.3, §5.5). *Owns `apps/api/src/access/middleware.ts` and a new `access/limits.ts`, `access/usage.ts`.*
- **Anonymous principal by client IP:** trust proxy headers only from our own proxy, and fix the spoofable `getClientIp` pattern while there. Get `x-forwarded-for` through the Next rewrite so sessions record IPs.
- **Rate limits:** an in-memory token bucket per principal (`web.rps`, `api.rps`), `RateLimit-*` headers, and `429` with `Retry-After`.
- **Daily quotas:** `api.requests_per_day` in memory, flushed to `usage_counter` every 10 s and reloaded at boot.
- **Usage meter** by subject, key, day and route group; `GET /api/v1/usage`.
- **Done when:** fake-timer tests cover bucket refill, quota rollover at UTC midnight, the flush and reload, and the headers.

**B. API keys** (§6 apiKey note, §8). *Owns new `apps/api/src/keys/`. Depends on A's principal shape: agree the `Principal` type with A first.*
- **Decide plugin vs own table** by reading the Better Auth `apiKey` plugin source. If verification writes to the DB per request, use the plugin only to manage keys (or write our own small table) and verify through a cached lookup.
- **Keys:** prefix `tk_`, hashed at rest, shown once, scopes, expiry, `api.keys.max` and `api.enabled` enforced. `Authorization: Bearer tk_…` resolves to principal kind `key`.
- **UI:** an "API keys" section in Account settings, and keys on the admin user page.
- **Done when:** a key works, is limited by its owner's plan, and revocation applies within the cache TTL (tested).

**C. Public `/api/v1` and moving lookups** (§8, §13). *Owns new `apps/api/src/v1/` and the matching legacy route deletions.*
- **OpenAPI:** `@hono/zod-openapi`, with Scalar docs at `/api/v1/docs`.
- **First ports** (mechanical, strangler style): geosearch, `geo/reverse`, aircraft, `flight-route`, directions, `region-dossier`, each with server-side caches and per-key upstream limits.
- **Shared libs:** de-Next-ify them first. Some return `NextResponse` (`src/lib/oi/service.ts`).
- **Done when:** each port passes parity tests against the old route, the browser uses the new path, and the old route is deleted.

**D. Gate legacy features.** *Blocked on §6 decision 1.*
- Server-key AI behind `ai.hosted`, keeping the bring-your-own-key path free.
- The `X-OI-Key` header change for OI and MCP (§6 of the plan), with one release accepting both forms.

**E. Saved workspaces** (B2, §10). *Owns new `apps/api/src/workspaces/` and `src/components/workspaces/`.*
- `ws_workspace` table and CRUD with `If-Match`; share slugs (`/w/<slug>?t=`); import from localStorage on first sign-in; autosave (last-writer-wins for autosave, `rev` for explicit saves); `workspaces.max` and `workspaces.share` enforced.
- **Ask the user where it lives in the UI before building it** (dock rule).

**F. Billing** (§7.3). *Blocked on §6 decision 4. Owns new `apps/api/src/billing/`.*
- Adapter interface, webhook route with `bill_event` idempotency, `manual` + a fake provider for tests, reconciliation, the `job` table and runner (shared with email retries).
- The skeleton could be built before a provider is chosen, but ask first.

**G. Operations** (§2, §12.2, §15).
- **Can start now:** CI gates (lint, typecheck, test), `pino` logging, internal `/metrics`.
- **Waits on hosting (§6 decision 6):** api Dockerfile (tsup bundle) and compose service, nginx in front, Litestream plus nightly `VACUUM INTO`.

**H. Privacy and account data** (§12.3).
- `GET /api/v1/account/export`.
- Deletion cleans up every new table (`beforeDelete`/`afterDelete` hooks) and pseudonymises usage and audit rows.
- Draft `/privacy` changes for the user to rewrite; the user owns that text.

**I. Admin console, more pages** (§11). *Owns `src/components/admin/*` and `apps/api/src/admin/*`.*
- Keys and usage pages (after A and B).
- Impersonation with a map-shell banner (ask first).
- Hide self-ban for the signed-in admin.
- A "too many attempts" countdown.

## 5. Running it as a team

- **Concurrency:** at most 3 subagents at once, and run test suites one at a time with `nice` (memory `cap-local-parallelism`). One Next dev server only, the user's, on :3000. Subagents don't start dev servers. Check `uptime` before heavy work.
- **Isolation:** give subagents worktrees (`isolation: "worktree"`) after §0's commit. Each worktree needs its own `npm ci`; unit tests use `:memory:` databases, so no data or env files are needed there.
- **The lead alone:** merges, runs the full suite, and does browser checks in the main tree.
- **Shared files:** one writer at a time, through the lead.
  - `apps/api/src/app.ts` (route mounting)
  - `db/migrations.ts`: append-only; the lead assigns migration order
  - `auth/auth.ts`
  - `testing/helpers.ts`
  - `packages/core`
  - `next.config.ts`: CRLF
  - `package.json` / `package-lock.json`: one dependency change at a time, pinned exact if the package releases often
- **Suggested waves:**
  1. **A, C, G-lite.** Ask the §6 decisions in parallel.
  2. **B** (after A's principal lands), **E** (after the UI answer), **H**.
  3. **I**, then **D** and **F** as decisions arrive, and **G** infrastructure once hosting is chosen.
- **Briefing a subagent:** give it
  - this file's §2–3
  - its workstream text from §4 and the plan sections it cites
  - the files it owns, and the shared files it must not touch
  - the done criteria
  - the instruction to read installed library types before writing
  - the report format: changes, tests added and their output, what it didn't verify, open questions

## 6. Decisions only the user makes

My recommendation, where I have one:

1. **What to gate first.** Recommend the server-key AI (`/api/ai/*`) behind `ai.hosted`. Every plan seeds `ai.hosted` false, Pro included, so either `npm run plan -- set pro ai.hosted true` first, or leave hosted AI ungated for now.
2. **Free API access.** `TODO.md` §5 gives free users a rate-limited API and MCP; the seeds follow `backend.md` §7.2 (`api.enabled` false for free). Decide before workstream B.
3. **Plan copy.** Hide the "Pro adds" list or edit the rows before anyone outside sees it.
4. **Billing provider and legal entity** (`backend.md` §7.4).
5. **Email provider** for `SMTP_URL`/`MAIL_FROM` (required in production).
6. **Hosting and edge:** nginx/TLS or a Cloudflare tunnel. The old `osirisai.live` and `deploy.sh` were the upstream author's and are gone.
7. **Product name:** it sets the cookie prefix `takip`, the key prefix `tk_`, the email sender and the 2FA issuer.
8. **Session trade-offs:** `freshAge` (1 day) and the 5-minute cookie cache.
9. **OSINT and recon tools:** keep behind an account, or remove (`TODO.md` §7).
10. **Impersonation:** yes or no.
11. **Workspaces placement** in the UI.

### Answers (the user, 2026-10-12)

1. **Gate hosted AI first:** `/api/ai/*` behind `ai.hosted`, with `pro` set to true. Bring-your-own-key stays free.
2. **Free gets a small API:** `api.enabled` on, 1 key, a low daily quota and rps. Pro raises the limits.
3. **Plan copy:** keep the list, but show only features that are built.
4. **Billing:** undecided. Build the provider-neutral skeleton (adapter interface, `bill_event` idempotency, `job` runner, a fake provider); no real adapter yet.
5. **Email provider:** decide later.
6. **Hosting:** undecided. Client-IP trust is configuration, defaulting to loopback only.
7. **Name:** not settled. Build with `takip` / `tk_` as placeholders and rename before launch.
8. **Sessions:** keep `freshAge` 1 day and the 5-minute cookie cache.
9. **OSINT and recon:** keep them, behind an account, with stricter limits.
10. **Impersonation:** yes, audited, with a banner in the map shell.
11. **Workspaces:** a name chip in the top bar beside search, showing the current workspace and its saved state. Its menu holds save, save as, share link, open and import from this device. Signed-out users see "Save view", which asks them to sign in.

Committed on `ui/shell-reorg` (the user's choice), not `backend/auth`: the other sessions stay on the same branch.

## 7. Reference

- Plan: `docs/architecture/backend.md`, schema sketch `backend-schema.sqlite.sql`, data platform `replay-database.md`.
- Run: `npm run dev`, then http://localhost:3000. The admin console is at `/admin` (role + 2FA + code).
- Test: `npx vitest run apps/api` · `npm run typecheck -w @takip/api` · `npx tsc --noEmit` (filter out other sessions' files) · `npx eslint <paths>`.
- Provider setup notes and redirect URIs: `.env.example` (Accounts section). Configured locally: Google, Facebook, GitHub.

## 8. Progress log (lead, 2026-10-12)

### Landed on `ui/shell-reorg`
- **G-lite** (`84d206d`): request ids, pino request logs (dev: one short line each), internal `/metrics` (loopback or `METRICS_ALLOW` only, 404 to forwarded requests), `.github/workflows/ci.yml` gating `docker-publish.yml`. Lint is scoped to `apps packages tools` until the web app's 428 existing errors are cleared.
- **C, part 1** (`d290a03`, `395e5a1`):
  - `/api/v1` on `OpenAPIHono`; spec at `/api/v1/openapi.json`, Scalar docs at `/api/v1/docs` (script pinned to 1.72.1).
  - `@takip/connectors` holds `http-json`, `source-cache` and `nominatim`; `src/lib/{httpJson,sourceCache,nominatim}.ts` are shims. `OSIRIS_UA` stays aliased in the shim until the OSIRIS → TAKIP rename is committed.
  - Ported, with parity tests, then deleted from `web`: `geo/search`, `geo/reverse` and `directions`. `/api/geo/reverse` is still called from `page.tsx` and reaches v1 through a `next.config.ts` rewrite.
- **A** (`87ceaa6`):
  - `Principal` carries `ip`. Client IP comes from the socket peer, and `X-Forwarded-For` is trusted only from `TRUSTED_PROXIES` (default loopback); `CLOUDFLARE_EDGE` is off.
  - Token buckets per principal on `/api/v1/*` (one second of burst). Daily quotas for keys, and a usage meter flushed to `usage_counter` every 10 s. `GET /api/v1/usage`.
  - Migrations 2 (`usage_counter`) and 3 (§6 seeds: free gets a small API, pro gets `ai.hosted`). Tested on a copy of the dev DB, which is now at `user_version` 4.
  - Web `getClientIp` trusts one hop by default (`TRUSTED_PROXY_HOPS`, `CLIENT_IP_HEADER`).
- **D** (`4258b90`):
  - The server-key fallback of `ai/analyze` and `ai/briefing` needs `ai.hosted`; `ai/overview` degrades to its keyless read-out. Bring-your-own-key is free.
  - `X-OI-Key` carries model keys; `Authorization: Bearer <model key>` works for one more release, with a warning, and never for `tk_` tokens.
  - `getAccess` forwards the client IP to the api.
- **C, part 2** (`bc31d4c`, `35c6816`): `/api/v1/aircraft` and `/api/v1/flight-route` (with `airports` and `stealth-fetch` moved to `@takip/connectors`), plus rewrites for the legacy paths still used by `bind-flight-clicks.ts`. Failed reverse lookups are sent with `no-store`.
- **Burst** (`a04ad38`): web callers get 3 s of token-bucket burst, so a Flight Watch panel or a tile fetch fits; keys keep 1 s.
- **Consolidation** (`5953407`, another session, at the user's request): everything uncommitted, including the OSIRIS → TAKIP rename, the replay data platform, osiris-92's replay routes and Sources admin page, and their wiring in `app.ts`, `env.ts` and `index.ts`. Pushed to `origin/ui/shell-reorg`. `4d0577a` then dropped the `OSIRIS_UA` alias.

- **B** (`6b91384`): API keys in our own `api_key` table (migration 4):
  - `tk_` + 32 random bytes; SHA-256 at rest; the lookup cached for 30 s; `last_used_at` written at most once a minute.
  - Session-only `GET/POST/DELETE /api/v1/keys`, plus admin list and revoke on the user page. Account settings → API keys.
  - A banned owner gets 403 `account_banned`; at the plan's cap, 403 `limit_reached`.
- **F** (`a5dc965`, `7dded85`): a provider-neutral billing skeleton (migration 5: `bill_customer`, `bill_event`, `job`).
  - `BILLING_PROVIDER` is unset, so checkout and portal answer 501 `billing_unavailable`. The fake provider exists only under `NODE_ENV=test`.
  - Webhooks: idempotent via `bill_event`; the subscription upsert, cache invalidation and audit row happen in one transaction.
  - A job runner with leases and backoff, and a daily `billing.reconcile`. A real adapter's checklist is in F's report and §7.3.
- **C, part 3** (`45e1ff4`, `6bbe904`): `/api/v1/{arcgis, satellites/orbit, markets/history, entity/expand}`.
  - The old `/api/arcgis` would fetch any URL a caller named. The v1 route pins https and the ArcGIS REST shape, and `safeFetch` refuses private and reserved addresses on every hop.
  - `ssrf-guard`, `orbit` and `market-tickers` moved to `@takip/connectors`.
  - `/api/satellites/orbit` is still called from `bind-satellite-pick.ts`, through a rewrite.
- **H** (`d69bf74`): privacy.
  - `GET /api/v1/account/export`: session only, recent sign-in, no secrets.
  - Deletion goes through `privacy/erase.ts`: one list of owned tables (a new user-data table adds a line). `audit_event` rows keep their ids but lose emails, IPs and user agents; a `user.delete` row records who deleted the account.
  - The "Your data" section in Account settings. Deletion links opened elsewhere land on the map.
  - `docs/privacy-draft.md` is for the user to rewrite (19 `TODO(user)`).
  - Verified live with a throwaway account, removed afterwards.
- **A2** (`1deb308`): hardening.
  - `/api/replay/*`: its own buckets (burst 200, refill 2 × the plan rate), metered as `replay`. API keys are accepted, and `read:tracks` is needed when a key has scopes.
  - Bad API keys are throttled per address block (10 a minute).
  - The daily `usage.prune` job keeps usage for 400 days (accounts and keys) and 35 days (anonymous); set by `USAGE_RETENTION_DAYS` and `USAGE_ANON_RETENTION_DAYS`.
  - `app.onError` returns `{error:'internal_error', request_id}`. There's one CIDR parser, `net/cidr.ts`.
- **I** (`ad3bcf0`): the admin console.
  - New pages: API keys (all users, filters, revoke), Usage (30 days by group, top consumers per day), and Billing (subscriptions, webhook log, job queue, re-run reconciliation).
  - Impersonation: started from the user page with a reason; at most 30 min; refused for admins and banned users. The impersonated session gets 403 `impersonating` on admin APIs and on key creation. `POST /api/admin/impersonation/stop` works without admin powers. Start and stop are audited with `impersonator`.
  - The "Viewing as … · Stop" banner mounts from `account-dialog.tsx`. `admin/impersonation-guard.ts` stops Better Auth's sliding refresh from extending an impersonated session (it relies on an internal detail: re-check it on better-auth upgrades).
  - The step-up countdown (`retryAfterSeconds`); no ban form on your own page.
  - Verified live (start and stop through Next, the banner on desktop, the audit rows). Keys and Usage returned 404 from a dev server whose route manifest missed the new folders; they need a restart of `npm run dev` before checking.
- **The four decisions** (the user's answers, 2026-10-12):
  - **Honest aviation lookups** (`fe2d82a`): adsbdb, hexdb and airplanes.live get `TAKIP_UA` and no `X-Forwarded-For`/`X-Real-IP`. `stealthFetch` itself stays for the CCTV adapters (`src/lib/cctv/*`), `/api/{conflicts,gdelt,weather}` and the `src/lib/stealthFetch.ts` shim.
  - **No deletion while paying** (`1f56864`): `POST /api/auth/delete-user` answers 409 `subscription_active` before any email goes out, and `user.deleteUser.beforeDelete` checks again when the link is opened. Active means the resolver's rule, from a provider other than `manual`. The response's `billing_portal` says whether Settings can offer Manage billing.
    - Not in `databaseHooks.user.delete.before`: Better Auth deletes sessions and accounts before that hook runs, outside a transaction, so refusing there locks the user out.
    - The admin plugin's `removeUser` skips `beforeDelete`; nothing calls it over HTTP.
  - **Encrypted OAuth tokens** (`9a38e7e`): `account.encryptOAuthTokens` covers access and refresh tokens. Better Auth never encrypts ID tokens, so an account hook drops them. Each boot clears plaintext tokens (`auth/oauth-tokens.ts`); on a copy of the dev DB that was one Google access token and one ID token. Rotating `BETTER_AUTH_SECRET` makes stored tokens unreadable, and nothing reads them.
  - **Audit retention, 30 days** (`b0f614f`): a daily `audit.prune` job (`AUDIT_RETENTION_DAYS`). `docs/privacy-draft.md` now states 30 days.
- **E** (`cd37fb6`): saved workspaces.
  - `ws_workspace` (migration 7); `/api/v1/workspaces` CRUD with `If-Match`/`rev`, `POST|DELETE /:id/share`, and `GET /api/v1/w/:slug` (no session, never names the owner).
  - `workspaces.max` and `workspaces.share` enforced; erase and export include workspaces.
  - Client library `src/lib/workspaces/*`: parts registered with `useWorkspacePart`, autosave (2 s, `If-Match: *`), and a one-time import from this device. UI in `src/components/workspaces/*`; landing `src/app/w/[slug]`.
  - **Not mounted yet**: see the shell commit below.
- **`ads.off`** (`27c35d3`, osiris-98's): an entitlement seeded by migration 6, off for anon and free, on for pro. Workspaces went to migration 7 after it. `f493407` adds "No ads" to the plan copy, shown only when `NEXT_PUBLIC_ADSENSE_CLIENT` is set.
- **G2a** (`c3571fd`): backups and the mail queue.
  - The `db.backup` job runs at 02:00 UTC (and on the first start each day): `VACUUM INTO` a temp file, fsync, `integrity_check`, rename. It keeps `APP_BACKUP_KEEP` (14) in `APP_BACKUP_DIR` (`data/backups`, gitignored: snapshots hold password hashes).
  - `npm run backup -w @takip/api` takes one on demand; `-- check <file>` verifies one. Runbook: `docs/runbooks/app-db-restore.md`, drilled by hand and as a test.
  - Mail goes through an `email.send` job with its own runner (2 min base delay, 6 attempts). Better Auth's callbacks only enqueue, so responses don't depend on SMTP.
- **D3** (`fa8a201`): every `/api/osint/*` route and `/api/scanner` needs an account or an API key (`src/lib/recon-gate.ts`).
  - Per-account limits by family: breach 20/h, people 30/h, scan 30/h, network 15/min, reference 30/min.
  - `me/access` returns `subject`; `getAccess` forwards only `Bearer tk_…`. The plan copy lists only built features (`BUILT` in `plan-highlights.ts`).
- **F2** (`67c0cd8`):
  - `jobs.prune` drops finished jobs after `JOB_RETENTION_DAYS` (7).
  - Signed-out users see the sign-in notice on the browser-side recon tabs (leaks, Shodan, sweep).
  - The OSINT decision is recorded in `TODO.md` §7 and `backend.md` §13 and §17.
  - The api-keys logger and the `bucketKey` reuse.
- **History note:** `d4bd69d` (History, another session) was built from a tree that predates `fa8a201`, so taken alone it drops D3's files. `f493407` restores them, and the tip is correct. Bisecting across `d4bd69d` will see the OSINT gate missing.
- **C, part 4** (`94d153f`): the advisories module (`lookup`, issuers, `source-memo`, `country-codes`, `rss`) moved to `@takip/connectors/advisories`, with shims, so `/api/advisories` and outbreaks are unchanged. `unhcr` and `police-uk` moved too.
  - `GET /api/v1/region-dossier` matches the legacy route in 11 parity cases, including the 2.5 s budget and stale copies.
  - **The legacy route is still live, and the map still calls it.** See the follow-ups.
- The dev DB is at `user_version` 8.

### Wrap-up state (2026-10-12, evening)
The user asked everyone to wrap up. Every backend workstream above has landed; no backend branches or worktrees remain.

**The shell commit has landed; the workspaces chip is not done.**
- `src/app/page.tsx` landed with its whole import closure, as listed here: osiris-5f's shell redesign, the hooks it imports, `replay/use-replay-satellites`, osiris-92's replay lines, osiris-a5's History lines and osiris-82's space mount (`feat(shell): mount the space view…`, after `61870f2`, the space work). Lint errors in it were committed as found.
- **Next, mount the workspaces chip** (E's lines):
  - `page.tsx`: `import WorkspaceHost from '@/components/workspaces/workspace-host';` and `<WorkspaceHost />` right after `<AccountDialog />`.
  - Desktop, `search-spotlight.tsx`: wrap the trigger as `<div data-hud className="absolute top-3 z-[450] flex items-center gap-2 transition-[left] duration-200" style={{ left: AT_LEFT, width: 'min(560px, calc(100vw - var(--shell-left, 0px) - 120px))' }}><div className="flex-1 min-w-0"><SearchTrigger onOpen={() => setShowDesktopSearch(true)} /></div><WorkspaceChip /></div>`.
  - Phone, `mobile-shell.tsx`, after `<AppHeader … isMobile />`: `<div data-hud className="absolute top-4 right-4 z-[210]"><WorkspaceChip align="right" /></div>`.
- **Register the parts** in `page.tsx`, after `openTool` (`useWorkspacePart` from `@/components/workspaces/use-workspace`; `areasFrom`, `layersOver`, `oneOf` and `storedAreas` from `@/lib/workspaces/adapters`):
  - `basemap` from `mapStyle`/`mapProjection`;
  - `layers` from `activeLayers` (setter `setActiveLayers(cur => layersOver(cur, saved))`);
  - `viewport` from `mapCenter` and `mapView.zoom` (setter `setFlyToLocation({ …, ts: Date.now() })`);
  - `areas` from `areas.drawnPolygons` via `storedAreas`/`areasFrom`;
  - `tool` from `activeTool`/`openTool`;
  - `time` needs `useReplay` to expose `openAt(t)`, `close()` and an `anchor` that changes only on open, seek or pause (not `clock.time()`, or autosave fires every ~12 s).
  - Also skip `useStartup`'s IP auto-locate when `localStorage['takip.workspaces.current']` is set.
- Then add `'workspaces.max', 'workspaces.share'` to `BUILT` in `plan-highlights.ts`, and rewrite its "leaves out saved workspaces" test.

### Landing branches here
Several sessions share one working copy, so `git merge` refuses whenever a merged file has someone's uncommitted edits. Use `python3 tools/land-branch.py <branch> "<message>"`:
- The dry run lists every file as clean, 3-way merged or conflicting, and writes conflict files with markers to a temp folder.
- Resolve them into a folder and pass `--resolved=<dir>`, then `--apply`. The commit gets the branch's content; other sessions' edits stay unstaged in the working copy.
- `--delete-dirty` lets a branch delete files that others have edited. Check those edits first.

### Deferred by the user
- **Deployment** (the api's Docker image, the compose service, nginx routing `/api/*` to the api, Litestream): waits for the hosting decision (Cloudflare Tunnel vs nginx/TLS).

### Follow-ups
- **Spoofable api IP without nginx.** Next's external rewrites pass the client's `X-Forwarded-For` through unchanged (httpxy without `xfwd`). In dev, or the Docker image without nginx, a client can choose its api IP. Fix: nginx in front, as planned, or a `src/proxy.ts` that strips forwarding headers on `/api/(auth|v1|admin|replay)`.
- **Replay rate limits.** `/api/replay/*` is unlimited. Before the replay UI ships it needs its own bucket with a burst allowance: a viewport change fetches 9–27 chunks, and anon `web.rps` is 10 with one second of burst. nginx should also cache sealed chunks.
- **Usage meter:**
  - nothing prunes `usage_counter`;
  - bytes are counted only when `Content-Length` is set;
  - the flush logs through `console.error`, not pino;
  - the CIDR parsing is duplicated in `access/client-ip.ts` and `obs/peer-allow.ts`.
- **Errors print twice** (Hono's default `onError` and pino); set `app.onError`.
- **Finish the region-dossier switch:**
  - add `{ source: '/api/region-dossier', destination: \`${api}/api/v1/region-dossier\` }` to `next.config.ts` (the caller, `use-region-dossier.ts`, is still uncommitted);
  - delete `src/app/api/region-dossier/` and `apps/api/src/v1/testing/legacy.ts`;
  - turn the parity cases into contract tests;
  - move the old unit tests to `place.test.ts`/`wikidata.test.ts`;
  - update `apiCatalog.ts`.
- **Kept for parity, worth fixing:** a failed data.police.uk lookup reads as "no data", and missing `lat`/`lng` isn't refused in the region dossier.
- **Coupling:** `/api/v1/satellites/orbit` reads the TLE cache the web app writes (`.next/cache/satellites-tle-cache.json`). It breaks if the api runs apart from Next; ingest's TLE should replace it.
- **Production default:** `INTEL_URL` falls back to `http://takip-intel:4000` in production.
- **Key scopes** exist (`requiresScope`), but no route needs one yet.
- **Billing open items:** reconciliation can't discover a subscription whose first webhook was lost (adapters should list subscriptions by customer); checkout and portal have no rate limit; the Next rewrite's handling of raw webhook bytes is unverified.
- **API keys:** a revocation made directly in the DB takes up to 30 s to apply (the API and admin paths are immediate).
- **CI test gate** fails on two tests outside the backend: `src/app/api/cctv/route.test.ts`, whose `writeSnapshot()` ignores the `…_CCTV_SNAPSHOT=off` env and writes `./off`, and `src/lib/oi/context.test.ts`.
