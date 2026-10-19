# Running TAKIP on the NUC

Since 2026-10-18 the NUC runs TAKIP around the clock, for using it away from the Mac while it's still in development. It is a production build of `dev`, served at https://takip.dev through a Cloudflare tunnel.

- **Machine:** Tailscale name `test` (nuc), Ubuntu 24.04, 8 cores, 7.5 GB RAM and 4 GB swap, user `sik`.
- **Get in:** `ssh user@nuc`. That is Tailscale SSH: the first connection may print a `login.tailscale.com` link to approve.
- **Checkout:** `~/takip`, cloned from GitHub on `dev`. `.env.local` is a copy of the Mac's, and the data folders (`data/db`, `data/archive`, `data/reference`, `.cache`) started as copies too.

## Services

All of them are systemd **user** services. Linger is on, so they start at boot without anyone logging in.

| Unit | Runs | Listens on |
|---|---|---|
| `takip-web` | `next start -H localhost` from `~/takip` | 127.0.0.1:3000 |
| `takip-api` | `apps/api` through tsx | 127.0.0.1:4100 |
| `takip-ingest` | the recorder (`apps/ingest`, `worker`) | — |
| `takip-tunnel` | `~/.config/takip/tunnel.sh` (cloudflared) | — |

- **Overrides:** `~/.config/takip/env` at run time (`SITE_URL`, `BETTER_AUTH_URL` and what else differs from the Mac); real environment variables beat `.env.local`. Build-time values (`NEXT_PUBLIC_*`, such as the AdSense publisher ID) go in `~/takip/.env.production.local`, which `next build` reads and git ignores.
- **Status and logs:** `systemctl --user status takip-web`, then `journalctl --user -u takip-web -f`.
- **Restart:** `systemctl --user restart takip-web takip-api`.
- **`intel` doesn't run.** `npm run dev` doesn't start it either, and its server binds every interface. `intel/node_modules` is tracked in git, so an `npm ci` there leaves a change that blocks `git pull`.

## The link

https://takip.dev, and `www.takip.dev` (both in `~/.cloudflared/config.yml`). The domain is registered on Cloudflare (2026-10-19).

- `takip-tunnel` runs the named tunnel `takip` (`cloudflared tunnel run takip`). Its credentials are `~/.cloudflared/<tunnel id>.json` and `cert.pem`; `cloudflared tunnel route dns takip <host>` adds a hostname, and the hostname also needs an `ingress` entry.
- `BETTER_AUTH_URL` and `SITE_URL` are fixed at `https://takip.dev` in `~/.config/takip/env`. Sign-in works on that host only. OAuth apps redirect to `https://takip.dev/api/auth/callback/<provider>`. Facebook sign-in is off here (its keys are set empty in `~/.config/takip/env`; set both or neither, or the api won't start); Google and GitHub are on.
- Quick tunnels didn't carry Server-Sent Events (TI's live run updates); nobody has checked yet whether the named tunnel does.
- The quick-tunnel script it replaced is `~/.config/takip/tunnel-quick.sh.bak`.

## Updating

From the Mac, after pushing to `origin/dev`:

```sh
tools/deploy-nuc.sh
```

It builds `origin/dev` in a throwaway worktree with the NUC's own `.env.local` and `.env.production.local` (for the build-time `NEXT_PUBLIC_*` values), fast-forwards the NUC's checkout to the same commit, reinstalls packages there only when the lockfile changed, backs up `app.db` when the deploy adds a migration, copies `.next` over and restarts the services. The site is down for about a minute.

- **Don't build on the NUC.** Since the public pages (2026-10-19) the compile alone needs about 6.5 GB. On three cores with swap full it fitted twice, then a build froze the machine until a reboot: Tailscale, SSH and the tunnel all stopped answering. If it ever has to build there, cap it so it gets killed instead of the box: `systemd-run --user --scope -p MemoryMax=5G -p MemorySwapMax=2G npm run build` (it will likely fail at that size, but the NUC stays up). More swap needs `sudo`, which asks for a password.
- **A Mac build runs on Linux** because `next start` loads packages, native ones included (better-sqlite3), from the NUC's own `node_modules`; the script refuses a build whose server code names a Mac path.
- **`-H localhost`, not `127.0.0.1`:** Next writes the request's host as `localhost` inside `proxy.ts`. With the server started on `127.0.0.1`, the rewrite that serves `/tr/…` pages no longer matches the server's own address, so Next proxies it to `https://localhost:3000` (Cloudflare sends `X-Forwarded-Proto: https`) and every non-English page returns 500. `localhost` resolves to 127.0.0.1 here, so it is still loopback only.

- If the build sits at "Creating an optimized production build" with no CPU use, a client bundle has pulled in something Turbopack can't compile. `next build --experimental-build-mode=compile --debug-build-paths 'app/page.tsx'` compiles one page, which makes it quick to narrow down (satellite.js 7's WASM module was the first such case, handled in `tools/satellite-js-loader.cjs`).
- The api runs migrations on start. Take an `app.db` snapshot before a risky update (`npm run backup -w @takip/api`).
- The IP location database (`data/geoip/dbip-city-lite.mmdb`, DB-IP Lite, ~130 MB) isn't in git. DB-IP publishes a new one each month: `npm run geoip -w @takip/api`, then restart `takip-api`.

## Pictures for the public pages

The `/map/…` pages lead with pictures of the map kept in `.cache/site-shots/`, outside git. Take them on the Mac against the dev server (`nice npx tsx tools/site/shots.ts`) and copy them over: `rsync -a .cache/site-shots/ user@nuc:takip/.cache/site-shots/`. Without them the pages show a sketch of the world instead.

## Known limits

- **The api runs with `NODE_ENV=development`.** Production refuses to start without `SMTP_URL` and `MAIL_FROM`, so until mail is set up, verification and reset links go to `journalctl --user -u takip-api`. Better Auth's sign-in rate limiter is also off outside production.
- **Shared OpenSky client.** The Mac's dev server and the NUC use the same `OPENSKY_CLIENT_ID`, so they share its daily credits.
- **Raw files pile up.** `data/archive` grows about 0.5 GB a day and nothing deletes it yet (roadmap §1.3).
- **Firewall:** ufw is off. The services listen only on 127.0.0.1, but SSH listens on every interface.
