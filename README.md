<p align="center">
  <h1 align="center">🏛️ O S I R I S</h1>
  <p align="center"><strong>Open Source Global Intelligence Platform</strong></p>
  <p align="center">
    <em>Real-Time Geospatial OSINT Dashboard — A Palantir Alternative</em>
  </p>
</p>

---

## 🔱 What is Osiris?

**Osiris** is a real-time, multi-domain open-source intelligence (OSINT) platform that aggregates live data from dozens of public sources and renders them on a unified dark-ops map interface. Track aircraft, satellites, earthquakes, conflict zones, financial markets, and breaking geopolitical events — all updating in real time.

Built with **Next.js 15**, **MapLibre GL**, and **Vercel Serverless Functions**, it's designed for analysts, researchers, and enthusiasts who want a single-pane-of-glass view of global activity.

**Zero infrastructure required** — deploy to Vercel in one click.

---

## ⚡ Quick Start

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/osiris)

### Local Development

```bash
git clone https://github.com/yourusername/osiris.git
cd osiris
npm install
npm run dev
```

Open `http://localhost:3000` to view the dashboard.

---

## ✨ Features

### 🛩️ Aviation Tracking
- **Commercial Flights** — Real-time positions via adsb.lol (~5,000+ aircraft)
- **Private Aircraft** — Light GA, turboprops tracked separately
- **Private Jets** — High-value bizjets (Gulfstream, Bombardier, Cessna Citation)
- **Military Flights** — Tankers, ISR, fighters, transports
- **Aircraft Classification** — SVG icons: airliners, turboprops, bizjets, helicopters
- **Grounded Detection** — Aircraft below 100ft rendered with grey icons

### 🛰️ Satellite Tracking
- **Orbital Tracking** — Real-time satellite positions via CelesTrak TLE data + SGP4 propagation (2,000+ active satellites)
- **Mission-Type Classification** — Color-coded: military recon (red), SAR (cyan), SIGINT (white), navigation (blue), early warning (magenta), commercial (green), space station (gold)

### 🌍 Geopolitics & Conflict
- **Global Incidents** — GDELT-powered conflict event aggregation (last 24h)
- **SIGINT News Feed** — Real-time RSS aggregation from BBC, NPR, Al Jazeera, NYT, NHK, GDACS
- **Risk Scoring** — Automated threat assessment with machine analysis
- **Region Dossier** — Right-click anywhere for: country profile, head of state, Wikipedia summary

### 📡 Signal Intelligence
- **GPS Jamming Detection** — Real-time analysis of aircraft NACp values
- **Grid-based aggregation** identifies interference zones

### 🌐 Additional Layers
- **Earthquakes (24h)** — USGS real-time feed with magnitude-scaled markers
- **Day/Night Cycle** — Solar terminator overlay
- **Defense Markets Ticker** — RTX, LMT, NOC, GD, BA, PLTR + Oil prices
- **LOCATE Bar** — Search by coordinates or place name (OpenStreetMap Nominatim)

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                OSIRIS (Next.js 15 + Vercel)                │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              FRONTEND (React + MapLibre GL)          │  │
│  │                                                      │  │
│  │  ┌─────────────┐  ┌──────────┐  ┌────────────────┐  │  │
│  │  │  OsirisMap   │  │ Intel    │  │ Layer Panel    │  │  │
│  │  │  WebGL Map   │  │ Feed     │  │ Markets Panel  │  │  │
│  │  │  All Layers  │  │ SIGINT   │  │ Search Bar     │  │  │
│  │  └──────────────┘  └──────────┘  └────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          API ROUTES (Vercel Serverless Functions)     │  │
│  │                                                      │  │
│  │  ┌──────────┬──────────┬──────────┬───────────────┐  │  │
│  │  │ /flights │ /sats    │ /quakes  │ /news         │  │  │
│  │  │ adsb.lol │ CeleTrak │  USGS    │ RSS Feeds     │  │  │
│  │  ├──────────┼──────────┼──────────┼───────────────┤  │  │
│  │  │ /gdelt   │ /markets │ /front   │ /region-      │  │  │
│  │  │ Conflict │ Yahoo Fin│ DeepState│  dossier      │  │  │
│  │  └──────────┴──────────┴──────────┴───────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Sources & APIs

| Source | Data | Update Freq | API Key |
|---|---|---|---|
| [adsb.lol](https://adsb.lol) | Aircraft positions (commercial, private, military) | ~60s | No |
| [CelesTrak](https://celestrak.org) | Satellite orbital positions (TLE + SGP4) | ~60s | No |
| [USGS](https://earthquake.usgs.gov) | Global seismic events | ~60s | No |
| [GDELT Project](https://gdeltproject.org) | Global conflict events | ~10min | No |
| [BBC/NPR/AJ/NYT](https://feeds.bbci.co.uk) | International news feeds | ~5min | No |
| [Yahoo Finance](https://finance.yahoo.com) | Defense stocks & oil prices | ~2min | No |
| [DeepState Map](https://deepstatemap.live) | Ukraine frontline | ~30min | No |
| [RestCountries](https://restcountries.com) | Country profiles | On-demand | No |
| [Wikidata](https://query.wikidata.org) | Head of state data | On-demand | No |
| [Wikipedia](https://en.wikipedia.org/api) | Location summaries | On-demand | No |
| [OSM Nominatim](https://nominatim.openstreetmap.org) | Geocoding | On-demand | No |
| [CARTO](https://carto.com) | Dark map tiles | Continuous | No |

**All data sources are free and require no API keys.**

---

## 📁 Project Structure

```
osiris/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main dashboard
│   │   ├── layout.tsx                  # Root layout + SEO
│   │   ├── globals.css                 # Osiris design system
│   │   └── api/
│   │       ├── flights/route.ts        # Aircraft tracking
│   │       ├── satellites/route.ts     # Orbital tracking
│   │       ├── earthquakes/route.ts    # Seismic events
│   │       ├── news/route.ts           # RSS intelligence feed
│   │       ├── gdelt/route.ts          # Conflict events
│   │       ├── markets/route.ts        # Financial data
│   │       ├── frontlines/route.ts     # Ukraine frontline
│   │       ├── region-dossier/route.ts # Country intelligence
│   │       └── health/route.ts         # System health
│   ├── components/
│   │   ├── OsirisMap.tsx               # Core MapLibre GL renderer
│   │   ├── LayerPanel.tsx              # Data layer toggles
│   │   ├── IntelFeed.tsx               # SIGINT news feed
│   │   ├── MarketsPanel.tsx            # Financial ticker
│   │   ├── SearchBar.tsx               # Location search
│   │   ├── ScaleBar.tsx                # Map scale indicator
│   │   └── ErrorBoundary.tsx           # Crash recovery
│   └── lib/
│       └── api.ts                      # API configuration
├── vercel.json                         # Vercel deployment config
├── next.config.ts                      # Next.js configuration
└── package.json
```

---

## 🔑 Environment Variables

No environment variables are required. All data sources are free and keyless.

Optional variables can be added in a `.env.local` file for enhanced features:

```env
# Optional — for future feature expansions
AIS_API_KEY=your_aisstream_key           # Maritime vessel tracking
OPENSKY_CLIENT_ID=your_opensky_id        # Higher rate limits for flights
OPENSKY_CLIENT_SECRET=your_opensky_secret
```

---

## ⚠️ Disclaimer

This is an **educational and research tool** built entirely on publicly available, open-source intelligence (OSINT) data. No classified, restricted, or non-public data sources are used.

**Do not use this tool for any operational, military, or intelligence purpose.**

---

## 📜 License

MIT License — Free to use, modify, and distribute.

---

<p align="center">
  <sub>Built with 🏛️ by the Osiris Project — Open Source Intelligence for Everyone</sub>
</p>
