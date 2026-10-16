# Self-Hosting TAKIP with Docker

TAKIP ships as a self-contained Next.js standalone build. This guide covers
running it with Docker / Docker Compose, deploying it as a [CasaOS](https://casaos.io)
app, and configuring the optional API keys.

> **TL;DR:** TAKIP runs fully **without any API keys**. All core feeds
> (aviation, satellites, fires, earthquakes, weather, news, CVEs) use public
> keyless sources, including the whole RECON toolkit. Keys only matter for
> raising rate limits on a few feeds.

---

## 1. Docker Compose (recommended)

```bash
git clone https://github.com/batuhantoker/takip.git
cd takip

# optional: configure keys to raise rate limits
cp .env.example .env         # then edit .env

docker compose up -d
```

Open <http://localhost:3000>.

> **Upgrading from an OSIRIS-named deployment:** the compose project, services and
> containers are now `takip*`. Run `docker compose -p osiris down` once first, or the old
> containers keep ports 3000, 8080 and 4000. `OSIRIS_PORT` and `OSIRIS_ARCHIVE_*` in `.env` still work.

What the compose file does:

- **`build:`** — compose builds the image locally from the `Dockerfile`, so
  you always run the code you just cloned. To run the prebuilt registry image
  instead, add `image: ghcr.io/batuhantoker/takip:latest` to the `takip`
  service and drop the `build:` block.
- **`env_file: .env` (`required: false`)** — if a `.env` file exists its
  values are injected into the container; if it's missing, TAKIP still starts
  with the keyless feeds.
- **`ports: ${TAKIP_PORT:-3000}:3000`** — the web UI. The container always
  listens on 3000; the published **host** port is `TAKIP_PORT` (default
  `3000`). Set `TAKIP_PORT` in `.env` to remap it, e.g. `TAKIP_PORT=3005`
  when 3000 is already in use — no need to edit the compose file.
- **`restart: unless-stopped`** — survives reboots.

Common commands:

```bash
docker compose logs -f          # follow logs
docker compose up -d --build    # rebuild locally after pulling new code
docker compose down             # stop & remove
```

### Pull the prebuilt image from GHCR

A prebuilt image for `linux/amd64` and `linux/arm64` is published to the GitHub
Container Registry on every push to `master` and every `v*.*.*` tag, so you can
run TAKIP without building anything:

```bash
docker pull ghcr.io/batuhantoker/takip:latest   # or a pinned tag, e.g. :0.1.0
docker run -d --name takip \
  -p 3005:3000 --env-file .env --restart unless-stopped \
  ghcr.io/batuhantoker/takip:latest
```

The package is public — no `docker login` is required to pull it.

### Plain `docker run`

```bash
docker build -t takip:latest .
docker run -d --name takip -p 3000:3000 --env-file .env --restart unless-stopped takip:latest
```

### Image details

Multi-stage build on `node:22-alpine`, runs as a non-root user (`nextjs`,
uid 1001), serves Next.js standalone via `node server.js` on port 3000.
Final image is ~220 MB. Build excludes `node_modules`, `.next`, `.git` and the
repo's large `*.diff` artifacts via `.dockerignore`.

---

## 2. CasaOS

The compose file includes an `x-casaos:` metadata block (title, description,
icon, port map, env descriptions) that plain Docker Compose ignores but CasaOS
reads.

**Install:**

1. On the CasaOS host, clone the repo somewhere persistent (e.g.
   `/DATA/AppData/takip`).
2. CasaOS dashboard → **`+`** → **Install a customized app** → paste the
   contents of `docker-compose.yml`.
   *(or simply run `docker compose up -d` from the cloned directory).*
3. TAKIP appears on the dashboard with its icon, reachable on host port
   `3000` (or whatever `TAKIP_PORT` you set in `.env`).

The app icon is the gold Eye-of-Horus mark in
`public/casaos-icon.png` (512×512 PNG), referenced by the `icon:` URL in the
metadata.

> CasaOS stores imported compose files under `/var/lib/casaos/apps/`, so a
> relative `build:` context may not resolve there. If importing the YAML
> directly, either build/tag `takip:latest` first
> (`docker build -t takip:latest /path/to/takip`) or replace the `build:`
> block with `image: ghcr.io/batuhantoker/takip:latest`.

---

## 3. API keys & data sources

Copy `.env.example` to `.env` and fill in only what you need.

### What the code actually reads today

The RECON toolkit (TLS, port scan, security headers, tech fingerprint,
subdomains, vulnerabilities, reputation, WHOIS, DNS, …) is **fully keyless** and
needs no scanner backend — the web tier runs the probes itself against public
feeds and its own sockets. There is nothing to configure to turn it on.

### Optional keys (reserved / for higher rate limits)

These are documented for completeness and forward-compatibility. The current
data routes use **keyless** public feeds, so these are not consumed yet — set
them only if you extend the relevant route or hit rate limits.

| Variable | Service | How to get it (all free) |
|----------|---------|--------------------------|
| `FIRMS_API_KEY` | NASA FIRMS active fires | Enter an email at <https://firms.modaps.eosdis.nasa.gov/api/map_key/> — the `MAP_KEY` is emailed instantly. Limit 5000 req / 10 min. |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | OpenSky aviation | Create an account at <https://opensky-network.org/>, open **Account → API client**, create a client and copy id/secret. **OAuth2 only since March 2025** (username/password auth removed). |
| `N2YO_API_KEY` | N2YO satellites | Register at <https://www.n2yo.com/login/register/>, then **Profile → generate API key**. Limit 1000 req / hour; key can't be regenerated. |
| `AIS_API_KEY` | aisstream.io maritime | Sign up at <https://aisstream.io/>, create a key on the **API Keys** page. Used over `wss://stream.aisstream.io/v0/stream`. |

> Keep `.env` out of version control — it is already in `.gitignore`. Only
> `.env.example` (no secrets) is committed.

### Optional runtime overrides

| Variable | Purpose | Default |
|----------|---------|---------|
| `TAKIP_PORT` | Host port the compose file publishes (container itself always listens on 3000). | `3000` |
| `AI_LOCAL_BASE_URL` | Lets TI run on your own models: any OpenAI-compatible server (Ollama, LM Studio, llama.cpp, vLLM). From inside the container the host is `http://host.docker.internal:11434/v1` (Ollama). Every visitor's TI can use it, so set it only on a private server. `AI_LOCAL_MODEL`, `AI_LOCAL_API_KEY`, `AI_LOCAL_CONCURRENCY` and `AI_LOCAL_ALLOW_CUSTOM` (readers may type their own address) are in `.env.example`. | off (in development: the usual local ports) |

### Keyless sources (no configuration needed)

Aviation → `adsb.lol` · Satellites → `celestrak.org` (TLE) · Fires →
NASA FIRMS open-data CSV · Earthquakes → USGS · Weather → NASA EONET · Space
weather → NOAA SWPC · CVEs → NVD · News → public RSS / HLS streams · CCTV →
public traffic-authority feeds · Crypto (BTC) → `blockstream.info` · Crypto
(ETH) → `eth.blockscout.com` ([Blockscout](https://github.com/blockscout/blockscout)
open-source explorer) · OFAC SDN sanctions → [OpenSanctions](https://www.opensanctions.org)
mirror (CC-BY 4.0) · Telegram OSINT → public `t.me/s/<channel>` web preview.
