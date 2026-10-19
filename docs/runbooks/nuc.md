# Running TAKIP on the NUC

Since 2026-10-18 the NUC runs TAKIP around the clock, for using it away from the Mac while it's still in development. It is a production build of `dev`, served at https://takip.dev through a Cloudflare tunnel.

- **Machine:** Tailscale name `test` (nuc), Ubuntu 24.04, 8 cores, 7.5 GB RAM and 4 GB swap, user `sik`.
- **Get in:** `ssh user@nuc`. That is Tailscale SSH: the first connection may print a `login.tailscale.com` link to approve.
- **Checkout:** `~/takip`, cloned from GitHub on `dev`. `.env.local` is a copy of the Mac's, and the data folders (`data/db`, `data/archive`, `data/reference`, `.cache`) started as copies too.

## Services

All of them are systemd **user** services. Linger is on, so they start at boot without anyone logging in.

| Unit | Runs | Listens on |
|---|---|---|
| `takip-web` | `next start` from `~/takip` | 127.0.0.1:3000 |
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
- `BETTER_AUTH_URL` and `SITE_URL` are fixed at `https://takip.dev` in `~/.config/takip/env`. Sign-in works on that host only. OAuth apps redirect to `https://takip.dev/api/auth/callback/<provider>`.
- Quick tunnels didn't carry Server-Sent Events (TI's live run updates); nobody has checked yet whether the named tunnel does.
- The quick-tunnel script it replaced is `~/.config/takip/tunnel-quick.sh.bak`.

## Updating

```sh
cd ~/takip && systemctl --user stop takip-web takip-ingest && git pull --ff-only && npm ci && npm run build \
  && systemctl --user start takip-web takip-ingest && systemctl --user restart takip-api
```

- It takes about three minutes, and the site is down meanwhile. The web app is stopped because the build rewrites the `.next` it serves from; the recorder, because both are memory-hungry on 7.5 GB. `takip-tunnel` keeps running, so the link stays the same.
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
