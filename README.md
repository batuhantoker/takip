<div align="center">

# TAKIP

### Public data, from one place

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MapLibre](https://img.shields.io/badge/MapLibre_GL-GPU_Rendered-396CB2?style=for-the-badge)](https://maplibre.org)
[![License](https://img.shields.io/badge/License-MIT-D4AF37?style=for-the-badge)](LICENSE)

**A live map of the world's public data: flights, ships, cameras, earthquakes, fires, weather, news and more, in one GPU-accelerated interface.**

[Report Bug](https://github.com/batuhantoker/takip/issues) · [Request Feature](https://github.com/batuhantoker/takip/issues)

</div>

---

## Overview

TAKIP makes publicly available data available to everyone, from one place. It is built around three modes:

1. **Live:** what is happening now. This is what exists today.
2. **History:** what happened at a given place or time.
3. **Analysis:** patterns, correlations and changes derived from the historical record.

Built with Next.js 16 and MapLibre GL, every data point is rendered via WebGL, so the map stays smooth with thousands of entities on screen. The design is in [ARCHITECTURE.md](ARCHITECTURE.md) and candidate sources are in [DATA-SOURCES.md](DATA-SOURCES.md).

### Key Capabilities

| Domain | Data Points | Sources |
|--------|------------|---------|
| **Aviation** | Commercial, Private, Military, Jets | OpenSky Network |
| **Maritime** | 39 Global Ports, 10 Chokepoints | Static Naval Intel |
| **CCTV** | 46,000+ Cameras from 157 sources | TfL, WSDOT, Caltrans, ODOT, MDOT, HK Transport Dept, Taiwan THB, NZTA, Rijkswaterstaat, [Public Webcams](#acknowledgements) + more |
| **Seismic** | Real-time M2.5+ | USGS Earthquake API |
| **Fires** | Active Hotspots | NASA FIRMS |
| **News** | 24/7 Live Streams | 23 Global Broadcasters |
| **Weather** | Severe Events | NASA EONET |
| **Space** | Solar Weather, Satellites | NOAA SWPC, N2YO |
| **Cyber** | CVE Threats, Vulnerability Scanning | NVD, Custom Scanner |
| **Conflict** | 13 Active Zones | Static OSINT Intel |
| **Crypto** | BTC + ETH Wallet Tracing, OFAC SDN Match | blockstream.info, Blockscout, OpenSanctions |
| **Sanctions** | Person / Org / Vessel SDN Search | OpenSanctions (US OFAC SDN mirror) |
| **Telegram OSINT** | Geoparsed Posts from Public Channels | `t.me/s/<channel>` web preview |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  TAKIP CLIENT                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ MapLibre  │  │  HUD     │  │  RECON Toolkit│ │
│  │  GL (GPU) │  │ Panels   │  │  Port Scan    │ │
│  │  WebGL    │  │ Layers   │  │  DNS / WHOIS  │ │
│  │  Render   │  │ Controls │  │  Vuln Scanner │ │
│  └──────────┘  └──────────┘  └───────────────┘ │
├─────────────────────────────────────────────────┤
│               NEXT.JS API ROUTES                 │
│  /api/flights         /api/earthquakes          │
│  /api/cctv            /api/news                 │
│  /api/fires           /api/maritime             │
│  /api/gdelt           /api/satellites           │
│  /api/weather         /api/scanner              │
│  /api/sentinel        /api/telegram-feed        │
│  /api/osint/*  (whois, dns, ip, cve, sanctions, │
│                 crypto, sweep, threats, …)      │
├─────────────────────────────────────────────────┤
│              EXTERNAL DATA SOURCES               │
│  OpenSky · USGS · NASA · NOAA · TfL · NVD      │
│  GDACS · EONET · FIRMS · N2YO · RSS Feeds      │
│  blockstream.info · Blockscout · OpenSanctions  │
│  t.me public previews                            │
└─────────────────────────────────────────────────┘
```

---

## Features

### Intelligence Layers
- **16 toggleable data layers** with real-time entity counts
- **GPU-accelerated rendering** — all map data rendered via WebGL, not DOM
- **Progressive loading** — data fetched on-demand when layers are activated
- **Viewport-aware** — only loads relevant data for the visible region

### OI — a prediction engine (bring your own key)
**OI Assist**: talk to the map (press O). Ask in words, typed or spoken, and OI flies you there, switches the layers on, finds what is live (flights, military aircraft, ships, quakes, fires, weather, news, cameras, satellites), marks it on the globe in cyan with the area it searched, lists it in cards you can click through, reads the markets, opens panels and starts forecasts, all on your own model key.

**OI Forecast**: a prediction engine inspired by the community-made [Pythia](https://github.com/jangles-byte/Pythia) and by [MiroFish](https://github.com/666ghj/MiroFish). From Pythia comes the idea of forecasting from the live world TAKIP already watches; from MiroFish, the method: cast the actors who shape an outcome and play them against each other in parallel simulated worlds. Ask a question and OI researches it from sources you can check (news, prices, prediction markets and the live feeds), runs the worlds, and has a report agent weigh the result against the crowd's price and a statistical baseline before it writes a calibrated forecast, every claim linked to its source. The whole run plays out on the globe as it happens.
- **Your own data**: add files (CSV, JSON, Markdown, text, logs, web pages) or paste up to 100,000 characters. The world model reads it once; or have every actor read it in every period, and quote it. The extra input tokens are shown before you run, on your own key.
- **Your own key**: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, xAI, Mistral or Qwen. Kept in your browser, sent per request in a header, never stored on the server.
- **REST API** under `/api/oi` with live Server-Sent Events, and an **MCP server** at `/api/mcp` so agents such as Hermes, Claude and Cursor can run predictions, steer them and read TAKIP intelligence. See the in-app docs at `/docs`.

### Live Cameras
More than 46,000 public cameras from 157 sources, shown as map markers with a preview grid and a viewer. Most are traffic cameras published by road authorities; the rest are public webcams (see [Acknowledgements](#acknowledgements)).

**Texas.** Public TxDOT ITS snapshots are integrated with the existing camera markers, preview grid and viewer. Use `/api/cctv?region=texas` for Texas only; global and Texas location queries include the same source. District inventories are cached independently, with stale data retained during outages. Availability varies by district and camera; these are refreshing JPEG snapshots, not video streams. Source: [TxDOT ITS](https://its.txdot.gov/its/District/DAL/cameras).

Run `npm test` for offline checks or `RUN_LIVE_TESTS=1 npx vitest run src/lib/cctv/sources/us/texas.test.ts` to check the public Texas inventory.

### RECON Toolkit
- **Port Scanner** — TCP connect scan with service fingerprinting
- **DNS Lookup** — Full record resolution (A, AAAA, MX, NS, TXT, CNAME)
- **WHOIS** — Domain/IP registration data (auto-cross-checked against OFAC SDN)
- **SSL/TLS Inspector** — Certificate chain analysis
- **IP Intelligence** — Geolocation, ASN, threat reputation (auto-cross-checked against OFAC SDN)
- **Vulnerability Scanner** — CVE lookup against NVD database
- **Crypto Wallet Trace** — BTC + ETH lookup (balance, tx history, OFAC SDN sanctions flag)
- **OFAC Sanctions Search** — query persons, organizations, vessels and aircraft against the US OFAC SDN list

### Live Broadcast Network
- **23 live 24/7 news streams** from global broadcasters
- Click any news dot on the map to open the live stream
- Feeds from NBC, CBS, ABC, Sky News, Al Jazeera, France 24, NHK, WION, and more

### Telegram OSINT Layer
- **Public-channel feed** scraped from the unauthenticated `t.me/s/<channel>` web preview — no Bot API token, no MTProto
- Default curated set of 5 channels (EN + RU/UA war reporting), overridable in `.env` (see [`.env.example`](.env.example))
- Posts are geoparsed against a multilingual place dictionary (EN + Cyrillic + Arabic) and plotted on the map
- Click any cyan dot to read the post and jump to the original on Telegram

### Crypto Wallet Intelligence
- **BTC** lookups via [blockstream.info](https://blockstream.info) (Esplora API, keyless)
- **ETH** lookups via [Blockscout](https://github.com/blockscout/blockscout)'s public ETH instance (`eth.blockscout.com`, keyless)
- Every lookup is cross-checked against the OFAC SDN sanctioned-address list (mirrored from [`0xB10C/ofac-sanctioned-digital-currency-addresses`](https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses))
- Sanctioned wallets surface a red **SANCTIONED — OFAC SDN** badge in the RECON panel

### OFAC SDN Cross-Check
- Standalone `SANCTIONS` tab in the RECON toolkit — full-text search across persons, organisations, vessels and aircraft
- WHOIS and IP-intel routes auto-cross-check registrant / ASN-owner names against the SDN list and surface an inline alert
- Data sourced from [OpenSanctions](https://www.opensanctions.org) (CC-BY 4.0) — keyless, ~7 MB cached in-memory for 24h

### Conflict Zone Monitoring
- **13 active conflict/tension zones** with severity-coded warning markers
- Active Wars: Ukraine, Gaza, Sudan, Myanmar, DRC, Yemen
- High Tension: Syria, Lebanon, Sahel, Somalia, Red Sea
- Elevated: Taiwan Strait, Korean DMZ

---

## Quick Start

```bash
git clone https://github.com/batuhantoker/takip.git
cd takip
npm install
npm run dev       # the map and the accounts api (sign-in) together
```

To open the admin console at `/admin`: sign up, run `npm run admin -- promote you@example.com`, turn on two-factor authentication in Account settings, then enter a code at `/admin`.

Open [http://localhost:3000](http://localhost:3000)

### Docker / Self-Hosting

```bash
git clone https://github.com/batuhantoker/takip.git
cd takip
cp .env.example .env                  # optional — configure keys / port
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000). Compose starts three services: the web app on `3000`, an nginx map-tile cache on `8080`, and the entity-resolution service from `intel/` on `4000`. The web image is a multi-stage `node:22-alpine` standalone build that runs as a non-root user. See **[DOCKER.md](DOCKER.md)** for the full Docker, CasaOS and API-key guide.

The container always listens on `3000`; the published host port is set in `.env` (see [`.env.example`](.env.example)), so it can be changed without editing the compose file.

### Environment Variables

TAKIP runs without any API keys: the core feeds use public, keyless sources. Copy [`.env.example`](.env.example) to `.env` and set only what you need:

| Variable | What it enables |
|----------|-----------------|
| `SCANNER_URL`, `SCANNER_KEY` | The RECON toolkit's scanner backend. Without them RECON returns `503`. |
| `CLOUDFLARE_API_TOKEN` | The Internet Outages and Attack Origins layers (Cloudflare Radar). |
| `AIS_API_KEY` | Live ship positions from aisstream.io. |
| `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | Authenticated OpenSky flight data (OAuth2), with higher limits. |
| `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, … | Server-side AI briefings, analysis and overview. Several keys are rotated between. |
| `SDK_INGEST_KEY` | `POST /api/sdk/ingest`. Disabled when unset. |
| `GITHUB_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_FORWARD_URL` | `/api/github-webhook`. Disabled unless both are set. |
| `INTEL_URL` | The entity-resolution backend behind `/api/entity/expand`. |
| `BETTER_AUTH_SECRET` | Signs session cookies for accounts. Required in production. |
| `GOOGLE_CLIENT_ID`/`_SECRET`, `FACEBOOK_…`, `APPLE_…`, `MICROSOFT_…`, `GITHUB_…`, `X_…`, `DISCORD_…` | Social sign-in buttons, one per configured provider. Setup notes and the redirect URI are in `.env.example`. |
| `SMTP_URL`, `MAIL_FROM` | Sends account emails (verification, password reset). Required in production; in development the links print in the `npm run dev` terminal. |

The host port, the Telegram channel list and the other runtime options are documented in `.env.example`. `.env` is gitignored; only the example is committed.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Map Engine | MapLibre GL JS (WebGL) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Styling | Custom CSS Design System |
| Deployment | Docker (Next.js standalone build) |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` or `Ctrl/⌘ K` | Search places |
| `O` | Ask OI |
| `D` | Areas: draw and watch |
| `A` | Live alerts |
| `I` | Recon |
| `M` | Markets |
| `L` | Toggle the layer panel |
| `G` | Switch globe / flat map |
| `R` | Reset to the global view |
| `F` | Toggle fullscreen |
| `?` | Show the shortcuts |

---

## Acknowledgements

**Upstream** — TAKIP started as a fork of an MIT-licensed open-source intelligence
dashboard by [simplifaisoul](https://github.com/simplifaisoul). The map, most of the
layers, OI and the RECON toolkit come from their work, and their copyright notice is
kept in [LICENSE](LICENSE).

**Public webcams** — the cameras in this layer are open data: each one is broadcast
publicly by whoever runs it, on their own site or their own channel. What the web
lacked was a catalogue of them.

[bekijkhet.nu](https://www.bekijkhet.nu/) is that catalogue, and it is the basis for
every camera in the layer. Bram and Annelies have kept it by hand since 2012, and
without their index these cameras would still be scattered across several hundred
unrelated sites with no way to find them.

TAKIP links every one of them straight through to the operator who runs it, which is
also how bekijkhet.nu asks to be read.

**OI** — the method behind OI follows [MiroFish](https://github.com/666ghj/MiroFish),
the open-source swarm-intelligence prediction engine: seed a parallel world from real
material, populate it with agents, let them interact while variables are injected, and
hand the simulation to a report agent. TAKIP rebuilds that method natively for its own
feeds and globe; no MiroFish code is used.

---

## License

MIT — see [LICENSE](LICENSE) for details.
