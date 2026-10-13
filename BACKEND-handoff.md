# Backend: upcoming work

_Updated 2026-10-12. This file lists only the work still planned. The history (what was built, the user's decisions, working rules, Better Auth gotchas and how to land branches in the shared working copy) is in [`docs/architecture/backend-log.md`](docs/architecture/backend-log.md). The design is in [`docs/architecture/backend.md`](docs/architecture/backend.md)._

## 1. Next

### 1.1 Commit the shell, then mount the workspaces chip
The workspaces api, client library and UI have landed, but the chip isn't mounted. `src/app/page.tsx` can't be committed yet: its uncommitted import closure includes osiris-82's space work, which is still in progress.

1. **Whoever commits `page.tsx` next** (most naturally with the space work) takes its whole closure:
   - **osiris-5f's orphaned shell redesign** (the user approved committing it): `src/components/shell/{dock-tools,mobile-shell,nav-items,use-cursor-readout,use-splash,use-startup,use-theme}`, `shell/splash/*`, and the edits to `dock`, `map-options`, `view-controls` and `splash-screen`.
   - **The hooks it imports:** `cameras/use-live-feed`, `directions/{route-planner,use-directions}`, `draw/use-areas`, `layers/use-arcgis-layers`, `map/use-region-dossier`, `oi/use-oi-share-link` and `recon/use-recon-overlays`.
   - **`src/components/replay/use-replay-satellites.ts`:** orphaned; fix its 2 eslint `any`s at line 17.
   - **The replay lines (osiris-92) and History lines (osiris-a5)** in `page.tsx`, `dock.tsx`, `nav-items.ts` and `dock-tools.tsx`.
   - **osiris-82's space files and hunks.**
2. **Mount the chip:**
   - `page.tsx`: `<WorkspaceHost />` (from `@/components/workspaces/workspace-host`), right after `<AccountDialog />`.
   - Desktop, `search-spotlight.tsx`: put `<WorkspaceChip />` beside `<SearchTrigger>` in one flex row, at the trigger's current position and width.
   - Phone, `mobile-shell.tsx`: after `<AppHeader … isMobile />`, add `<div data-hud className="absolute top-4 right-4 z-[210]"><WorkspaceChip align="right" /></div>`.
3. **Register the map state** in `page.tsx` with `useWorkspacePart` (from `@/components/workspaces/use-workspace`; the adapters are in `@/lib/workspaces/adapters`):
   - `basemap`: `mapStyle`/`mapProjection`.
   - `layers`: `activeLayers`, set with `layersOver`.
   - `viewport`: `mapCenter` and `mapView.zoom`, set through `setFlyToLocation`.
   - `areas`: `areas.drawnPolygons`, through `storedAreas`/`areasFrom`.
   - `tool`: `activeTool`/`openTool`.
   - `time`: needs `useReplay` to expose `openAt(t)`, `close()` and an `anchor` that changes only on open, seek or pause.
4. **Skip `useStartup`'s IP auto-locate** when `localStorage['takip.workspaces.current']` is set.
5. **Plan copy:** add `'workspaces.max', 'workspaces.share'` to `BUILT` in `src/components/account/settings/plan-highlights.ts`, and rewrite its "leaves out saved workspaces" test.
6. **Browser check:**
   - signed out: "Save view";
   - autosave states;
   - a conflict from a second tab;
   - share, rotate and revoke;
   - `/w/<slug>?t=`;
   - the one-time import;
   - phone width.

### 1.2 Finish the region-dossier switch
`GET /api/v1/region-dossier` has landed and matches the legacy route in parity tests. The map still calls the legacy route.
- Add `{ source: '/api/region-dossier', destination: \`${api}/api/v1/region-dossier\` }` to `next.config.ts` (a mixed-CRLF file), or point `use-region-dossier.ts` at `/api/v1/region-dossier` once it's committed.
- Delete `src/app/api/region-dossier/` and `apps/api/src/v1/testing/legacy.ts`. Turn the parity cases into contract tests, move the old unit tests to `v1/region-dossier/{place,wikidata}.test.ts`, and update `src/app/docs/apiCatalog.ts`.

### 1.3 Make CI green
Image publishing waits on the CI gate, which fails on two tests outside the backend:
- **`src/app/api/cctv/route.test.ts`:** `writeSnapshot()` ignores `…_CCTV_SNAPSHOT=off`, so the test writes a file named `off` at the repo root (untracked; never `git add -A`).
- **`src/lib/oi/context.test.ts`:** "carries on without a source that fails".

Lint is scoped to `apps packages tools`. Widen it as the web app's lint errors are cleared.

## 2. Waiting on the user's decisions
- **Hosting** (Cloudflare Tunnel or nginx with TLS), which unblocks deployment:
  - an api image (a tsup bundle or `tsx`), and an `api` service in compose with `API_INTERNAL_URL=http://api:4100` at web build time;
  - nginx routing `/api/{auth,v1,admin,billing,replay}` to the api with a proper `X-Forwarded-For`, plus `TRUSTED_PROXIES`. Until nginx is in front, a client of `npm run dev` or of the web image can choose the api's view of its IP;
  - a `data/backups` volume, and Litestream with a bucket (also a decision);
  - nginx caching sealed replay chunks.
- **Billing provider and legal entity:** write the real adapter behind `apps/api/src/billing/`:
  - register it, with its keys and webhook secret in `env.ts`;
  - map its events to the three `BillingEvent` types and its statuses to ours;
  - pass the user id through checkout metadata;
  - verify signatures over the raw body, with a timestamp tolerance;
  - `fetchSubscription` returns canceled/expired rather than throwing;
  - time out every provider call;
  - re-fetch state on each event, because deliveries arrive out of order;
  - price ids go in `bill_plan.prices[provider].{monthly,yearly}`.

  Also needed:
  - an "Upgrade" action in the Plan section;
  - a way to set `bill_plan.prices`;
  - reconciliation that lists subscriptions by customer, so a lost first webhook is caught;
  - rate limits on checkout and portal.
- **Email provider:** `SMTP_URL` and `MAIL_FROM` are required in production.
- **Privacy text:** rewrite `docs/privacy-draft.md` (19 `TODO(user)`) into `/privacy` before accounts launch.

## 3. Remaining legacy routes (backend.md §13)
- **Live feeds** (flights, maritime, satellites, cctv, quakes, fires, weather, news and so on): fetching moves to `apps/ingest` connectors, serving to `/api/v1` and `/api/live`. This is the data platform's work.
- **Media proxies** (cctv proxy, frame, resolve, stream-status, proxy-tiles): move to the api as a closed proxy that takes ids, never URLs.
- **AI and OI** (`ai/*`, `oi/*`, `mcp`): move to the api. The `ai.hosted` gate and `X-OI-Key` are done in `web`. Drop the deprecated `Authorization: Bearer <model key>` form one release after the change.
- **OSINT and recon** (`osint/*`, `scanner`): move to the api. The account gate and per-account limits are done in `web` (`src/lib/recon-gate.ts`).
- **Platform** (`sdk/ingest`, `sdk/stream`, `github-webhook`, `health`, `stats`, `reference`): move to the api. `sdk/ingest` should take API keys with a `write:entities` scope instead of `SDK_INGEST_KEY`.

## 4. Smaller follow-ups
- **Migrations are positional** (`user_version`), and concurrent sessions have collided on a slot. Consider named migrations (a `schema_migration` table seeded from the current `user_version`).
- **Key scopes:**
  - OSINT can't check scopes, because `me/access` doesn't expose them; add an `osint` scope.
  - Workspaces refuse scoped keys (`insufficient_scope`); add a workspaces scope.
- **Workspaces:**
  - the state schema exists twice (`apps/api/src/workspaces/state.ts` and `src/lib/workspaces/state.ts`); move it to `packages/core`;
  - nothing purges soft-deleted rows;
  - a share link survives a plan that loses `workspaces.share`;
  - closing a tab saves only states under ~60 KB.
- **Impersonation:**
  - an expired window isn't audited, and it leaves the admin signed out;
  - the "30 minutes" in the copy isn't read from `IMPERSONATION_S`;
  - `impersonation-guard.ts` relies on a Better Auth internal; re-check it on upgrades.
- **Usage:** response bytes are counted only when `Content-Length` is set; replay chunks aren't metered in bytes.
- **Region dossier:** a failed data.police.uk lookup reads as "no data", and missing `lat`/`lng` isn't refused. Both were kept for parity.
- **Satellite orbits:** `/api/v1/satellites/orbit` reads the TLE cache the web app writes (`.next/cache/satellites-tle-cache.json`). Replace it with ingest's TLE before the api runs apart from Next.
- **Recon leftovers:** the sweep's own limiter keys on a header the client writes, and several OSINT routes share one bare-IP bucket.
- **`stealthFetch`** still sends fake browser user agents and `X-Forwarded-For` for about 60 CCTV adapters and `/api/{conflicts,gdelt,weather}`. The aviation lookups are already honest; the CCTV owners decide the rest.
- **Orphaned change:** an uncommitted `--data-dir` fix in `tools/import/cli.ts` with no owner. Review it and commit or drop it.
- **Shutdown** waits for in-flight mail, so a hung SMTP connection delays SIGTERM until nodemailer's timeout.

## 5. Still to check in a browser
- The Keys and Usage admin pages: they return 404 until `npm run dev` is restarted (the dev server's route manifest missed them).
- The impersonation banner at phone width.
- The recon "Sign in to use recon tools" notice, and the delete-account refusal while a paid subscription is active.
