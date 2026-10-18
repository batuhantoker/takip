# Running TAKIP on the NUC

Since 2026-10-18 the NUC runs TAKIP around the clock, for using it away from the Mac while it's still in development. It is a production build of `dev`, served through a temporary Cloudflare link.

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

- **Overrides:** `~/.config/takip/env`. Real environment variables beat `.env.local`, so this file holds only what differs from the Mac.
- **Status and logs:** `systemctl --user status takip-web`, then `journalctl --user -u takip-web -f`.
- **Restart:** `systemctl --user restart takip-web takip-api`.
- **`intel` doesn't run.** `npm run dev` doesn't start it either, and its server binds every interface. `intel/node_modules` is tracked in git, so an `npm ci` there leaves a change that blocks `git pull`.

## The link

`cat ~/.config/takip/link` prints the current address.

- It is a Cloudflare quick tunnel, `https://<four-words>.trycloudflare.com`, and **the link changes every time `takip-tunnel` restarts**, including after a reboot.
- `tunnel.sh` keeps sign-in working: it writes the new link into `BETTER_AUTH_URL` and restarts the api.
- Quick tunnels don't carry Server-Sent Events, so TI's live run updates don't stream through the link.
- When the name is chosen (roadmap §3.1), buy the domain on Cloudflare and replace the quick tunnel with a named one (`cloudflared tunnel login`, `tunnel create`, `tunnel route dns`), with a fixed `BETTER_AUTH_URL`.

## Updating

```sh
cd ~/takip && systemctl --user stop takip-web takip-ingest && git pull --ff-only && npm ci && npm run build \
  && systemctl --user start takip-web takip-ingest && systemctl --user restart takip-api
```

- It takes about three minutes, and the site is down meanwhile. The web app is stopped because the build rewrites the `.next` it serves from; the recorder, because both are memory-hungry on 7.5 GB. `takip-tunnel` keeps running, so the link stays the same.
- If the build sits at "Creating an optimized production build" with no CPU use, a client bundle has pulled in something Turbopack can't compile. `next build --experimental-build-mode=compile --debug-build-paths 'app/page.tsx'` compiles one page, which makes it quick to narrow down (satellite.js 7's WASM module was the first such case, handled in `tools/satellite-js-loader.cjs`).
- The api runs migrations on start. Take an `app.db` snapshot before a risky update (`npm run backup -w @takip/api`).

## Known limits

- **The api runs with `NODE_ENV=development`.** Production refuses to start without `SMTP_URL` and `MAIL_FROM`, so until mail is set up, verification and reset links go to `journalctl --user -u takip-api`. Better Auth's sign-in rate limiter is also off outside production.
- **Shared OpenSky client.** The Mac's dev server and the NUC use the same `OPENSKY_CLIENT_ID`, so they share its daily credits.
- **Raw files pile up.** `data/archive` grows about 0.5 GB a day and nothing deletes it yet (roadmap §1.3).
- **Firewall:** ufw is off. The services listen only on 127.0.0.1, but SSH listens on every interface.
