# Adding a camera source

Read this before adding or fixing a CCTV source. It should save you from re-reading `src/lib/feeds/cameras/` from scratch.

Where things live:

- `src/app/api/(feeds)/cctv/`: HTTP handlers only (`route.ts`, `proxy/`, `resolve/`, `frame/`, per-source still and stream routes).
- `src/lib/feeds/cameras/types.ts`: the camera record.
- `src/lib/feeds/cameras/catalog/`: region wiring (`feeds.ts`, `registry.ts`, `bounds.ts`, `refresh.ts`, `response.ts`, `sources.ts`) and the on-disk catalogue snapshot (`snapshot.ts`).
- `src/lib/core/net/`: the fetch helpers adapters use (`stealth-fetch.ts`, `http-json.ts`, `source-cache.ts`, `http2.ts`, `ssrf-guard.ts`, `fetch-pool.ts`, `user-agent.ts`).
- `src/lib/feeds/cameras/sources/<group>/`: one adapter per file, tests beside it. Groups: `platforms` (shared 511 stacks), `global`, `us`, `canada`, `latin-america`, `europe`, `turkey`, `asia`, `oceania`, `africa`.
- `src/lib/feeds/cameras/generated/`: `*.generated.ts` lists written by `scratch/scrape_*.js`.

- Last verified: 2026-10-12, at commit `4794154` plus the uncommitted Wyoming, Mississippi, Arkansas and South Africa work.
- Background reading: [`CCTV-handoff.md`](../CCTV-handoff.md) has catalogue numbers, the duplicates audit and the planned DB design.
- **Keep this file current.** If you change a platform helper, a rule or the wiring, update the section here in the same commit.

---

## 0. The storage migration is coming

The catalogue will move from in-memory region fetchers to **SQLite, or possibly Postgres** (CCTV-handoff.md §3–§7). Ingest will run as a job, and the map will read from the DB. Write every new source so it carries over with no rework:

| Part | After the migration |
|---|---|
| **Adapter**: fetch the upstream, then a pure `mapX(record) → CctvCamera \| null` | **Stays.** It becomes an ingest adapter. |
| Platform helpers (`ibi511.ts`, `cars.ts`, `cars511x.ts`) | **Stays** |
| The rules in §6 (bounds, https, throwing on failure, prefixed ids, …) | **Stays.** They become ingest admission rules. |
| Fixture tests and live tests (§7) | **Stays** |
| Region wiring in `catalog/registry.ts`, `catalog/bounds.ts` and `catalog/refresh.ts`: `RAW_REGION_FETCHERS`, `getRegionsForBounds`, `cachedSource`, the 12 s budget, the snapshot file | **Goes away.** Expect to delete it. Don't add logic there. |
| The `STATE_FEEDS` registry in `us-511.ts` | It will probably become rows in the `source` table. Keep entries declarative. |

What this means for an adapter:

1. **Keep the upstream's native id recoverable.** Use `id = '<prefix>-<nativeId>'` and never a hash of the name, coordinates or URL. The DB keys on `(source_id, native_id)`.
2. **Keep the mapper pure**, with no I/O. Do all fetching in a separate `fetchX`/`loadX`.
3. **Don't dedupe across sources inside an adapter.** Only drop rows another source owns (see the `excludeOwners` example in §5.3). Cross-source merging belongs to ingest.
4. **Leave caching to the caller.** Don't add your own `cachedSource` wrapper; `route.ts` already wraps every region.

**When the migration lands, rewrite §1 steps 4–5, §2, the wiring part of §5.2 and §8 in this doc.** The rest should still hold.

---

## 1. Checklist

1. **Probe the upstream** (§4). Record the count, the fields, the bounds, the media type, the https/CORS status and any overlap with sources we already have.
2. **Identify the platform** (§5). If it is IBI, CARS GraphQL or CARS 511x, adding it is **one entry in `us-511.ts`**. Then skip to step 6.
3. Otherwise **write `src/lib/feeds/cameras/sources/<group>/<name>.ts`**: types for the raw row, a pure `mapX()` and an exported `fetchXCameras()`. Copy `sources/us/kentucky.ts` or `sources/us/nyc.ts`.
4. **Wire it up with one entry in `FEEDS` (`src/lib/feeds/cameras/catalog/feeds.ts`)**: `{ region, idPrefix, bounds, fetch }`. That registers the region and the box it loads for.
5. If the media host needs it (plain http, Referer quirks), **add it to the proxy allowlist** (§6).
6. **Write tests** (§7): fixture tests for the mapper, plus one live test. Add a new id prefix to `us-511.test.ts`.
7. **Verify** (§8): `npx vitest run src/lib/feeds/cameras/sources/<group>/<name>.test.ts`, the live test, `npx tsc --noEmit`, `npx eslint <files>`, and then the dev server.
8. **Update this doc**: the source table in §10, and any platform you discovered.

---

## 2. How it works today

```
Browser ── GET /api/cctv?region=all&format=pins ──▶ src/app/api/(feeds)/cctv/route.ts
                                          RAW_REGION_FETCHERS { region → fetcher }
                                            + STATE_FEEDS from us-511.ts (merged in; a duplicate region throws)
                                          each wrapped in cachedSource('cctv:<region>')  (30-min TTL, stale on error)
                                          4 regions at a time, 12 s per region, 5-min backoff
                                          prebuilt gzip payloads (full and pins) + .cache/cctv-catalog.json snapshot
        ◀── pins: id, position, source, off air (pins.ts; 106k cameras in ~0.75 MB gzipped, the full list is ~3.6 MB) ──
src/lib/feeds/cameras/camera-catalog.ts   decodes and merges by id; retries pending regions only
use-point-layers.ts         'cctv' GeoJSON source of pins → cctv-dots; 'cctv-named' → cctv-label from zoom 15
camera-details.ts           GET /api/cctv/details?id=…&id=… (≤100) for the cameras a view needs, cached for the session:
                              the click, the hover tip, CctvPreviews, use-camera-labels, an area's camera list
CameraViewer.tsx            plays hls / mp4 / mjpeg / iframe, or a jpg refreshed every 5 s (?_t=)
CctvPreviews.tsx            preview tiles from zoom 13 (jpg refreshed every 15 s) for the 60 pins nearest the middle
TI (lib/ai/assist)          fetches the full /api/cctv?region=all itself, only when asked about cameras
```

- All upstream fetching happens **server-side**. Images and streams load **in the browser, straight from the operator**, unless the host is behind `/api/cctv/proxy`.
- A region that misses its 12 s budget drops out of *that* response, but its fetch keeps running into the cache. Keep a single region well under 12 s.

---

## 3. The camera record (`src/lib/feeds/cameras/types.ts`)

```ts
interface CctvCamera {
  id: string;            // '<prefix>-<nativeId>', globally unique. The client merges by id, so a reused id loses a camera silently.
  lat: number; lng: number;
  name: string;          // a human label; fall back to `${source} Camera ${nativeId}`
  city: string;          // the caption under the name: city, county, borough, or the state as a last resort
  country: string;       // 'US', 'Canada', … (match what neighbouring sources use)
  feed_url?: string;     // a still JPG/PNG. The client appends ?_t= or &_t=, so strip upstream cache-busters.
  stream_url?: string;   // .m3u8 / .mp4 / mjpeg / an embed URL
  stream_type?: 'jpg' | 'hls' | 'iframe' | 'mjpeg' | 'mp4';   // missing means jpg
  external_url?: string; // the operator's page; link-only when it is the only media field
  source: string;        // the agency label on the card, e.g. 'NYSDOT', 'NYC DOT'
  road?: RoadCondition;  // measured surface from the operator's paired weather station (lib/feeds/cameras/road-condition.ts)
}
```

- **Setting both `feed_url` and `stream_url` + `'hls'` is ideal.** The viewer plays the stream, and preview tiles and vision use the still.
- The map forwards only these fields (`map/layers/live/use-point-layers.ts`, in the `setGeo('cctv', …)` call). A new field needs that line changed too.
- **`road`** is set only from a pairing the operator itself declares, never from the nearest station we can find.
  - `admitRoadCondition()` requires the station within 10 km, the reading under 2 h old, and no operator fault flag. The camera viewer re-checks it, because the catalogue can be 30 minutes behind.
  - Surface words pass through as the operator writes them.
  - Users today: `estonia.ts` (Tark Tee's own `closest_weather_station`, `distance`, `road_status`; 140 of 176 cameras on 2026-10-12).
  - `finland.ts` (Fintraffic's `nearestWeatherStationId` from `generated/digitraffic-pairs.generated.ts`, generated by `scratch/scrape_digitraffic_pairs.js` at 764 of 814; the live `weather/v1/stations/data` KELI_1 surface; 497 cameras on 2026-10-12).

---

## 4. Probing an upstream (do this first)

```bash
# Shape, size and speed
curl -s -m 30 -o /tmp/x.json -w "%{http_code} %{size_download}B %{time_total}s %{content_type}\n" "<URL>" -A "Mozilla/5.0" -H "Accept: application/json"
python3 - <<'EOF'
import json, collections as c
d = json.load(open('/tmp/x.json')); rows = d if isinstance(d, list) else d.get('features') or d.get('data')
print(len(rows)); print(json.dumps(rows[0], indent=1)[:1500])
print(c.Counter(k for r in rows for k in r).most_common())
EOF

# The media: is it https, does it sniff as an image, does it tolerate ?_t=, and does HLS allow CORS?
curl -s -m 10 -D - -o /tmp/f "<STILL_URL>?_t=1" | grep -iE "^HTTP|content-type|cache-control|last-modified"; file /tmp/f
curl -s -m 10 -D - -o /dev/null "<M3U8_URL>" -H "Origin: https://takip.example" | grep -iE "^HTTP|access-control-allow-origin"
# Check a chunklist and a .ts segment too: some edges allow CORS on the playlist only.
```

What to write down:

| Question | Why it matters |
|---|---|
| Total rows; rows that are online, public and not broken | Expected count for the live test, and the filters the mapper needs |
| Min/max lat/lng; any (0,0) or far-off rows | Set the bounds box. Every feed has a few mis-geocoded rows. |
| Native id field; is it unique? | Becomes the id |
| Name quality (codes vs real labels) | Whether the label needs cleaning; see `cameraLabel` in `ibi511.ts` and `cameraName` in `nyc.ts` |
| Media type and host; http or https; CORS on HLS | `feed_url` vs `stream_url`; whether it needs the proxy |
| Cache-buster in the still URL | Strip it (`cars.ts` `snapshotUrl`) |
| Overlap with an existing source (same media URL or native id; within 30 m) | Decide who owns which rows. **Proximity alone never proves a duplicate:** one pole often carries several views. |
| Response time | Must stay well under the 12 s region budget |

**Finding the API behind a map page.** Open the site's main HTML or JS and look for `List/GetData/Cameras` (IBI), `/api/graphql` (CARS), `configs/main.json` / `carsprogram.org` (CARS 511x), `FeatureServer` / `MapServer` (ArcGIS), `iteris-atis.com` (Iteris) or `/resource/*.json` (Socrata).

---

## 5. Pick a path

### 5.1 Known shared platforms: one line in `src/lib/feeds/cameras/sources/platforms/us-511.ts`

`STATE_FEEDS` entries carry the region, the id prefix, the bounds and the fetcher. `route.ts` registers both the region and its viewport box from them automatically.

| Platform | How to spot it | Helper | Entry |
|---|---|---|---|
| **IBI 511** | `https://<site>/List/GetData/Cameras?query=…` returns DataTables JSON (`recordsTotal`, `data[]`, WKT `latLng`) | `ibi511.ts` (`loadIbi511Cameras`) | `ibi('pennsylvania', { base, idPrefix, source, state, bounds, videoHosts? })` |
| **CARS 511 (GraphQL)** | `POST https://<site>/api/graphql` with `mapFeaturesQuery` | `cars.ts` (`loadCarsCameras`) | `cars('minnesota', { host, idPrefix, source, state, bounds, videoHosts?, excludeFeeds? })` |
| **CARS 511x** (Castle Rock's newer stack) | The page loads `…/configs/main.json`; its `layers[]` include `name: "cameras"` with `api: "https://api-511x-<client>.carsprogram.org/cameras"`. The data is `GET <api>/cameras/map-features`: a single GeoJSON FeatureCollection with no paging. | `cars511x.ts` (`loadCars511xCameras`) | `x511('newyork', { api, idPrefix, source, state, bounds, excludeOwners? })` |

Notes on each:

- **IBI**
  - Pages are 100 rows; about 10 run in parallel.
  - A read below 95% of `recordsTotal` throws, so the cache keeps the last good data.
  - `isVideoAuthRequired` rows stay on their still.
  - `videoHosts: []` forces every row onto its still. Use it when the edges answer 401 (PennDOT).
- **CARS GraphQL**
  - `zoom: 16` is needed, or the server returns clusters.
  - Some deployments have moved to 511x and their GraphQL endpoint now redirects. CDOT is one of them.
  - A view's `sources[]` carries its HLS. It is used only when the host is in `videoHosts`: some deployments hand out session-tokened URLs (Massachusetts, TrafficLand) that expire long before the catalogue does.
- **CARS 511x**
  - `views[].type` is `WMP` for an HLS `url` with a `videoPreviewUrl` still, or `STILL_IMAGE` for a still `url`.
  - Rows carry `cameraOwner`, `public` and `views[].broken`.
  - Multi-agency deployments mix owners. 511NY carries NYC DOT's cameras, and the direct NYC feed owns those, so `excludeOwners: ['NYC DOT']`.
  - Known deployments: `api-511x-nysdot` (511NY) and `api-511x-co` (CDOT COtrip, 1,035 cameras, not added yet).

The standalone modules `florida.ts`, `georgia.ts`, `northcarolina.ts`, `arizona.ts`, `utah.ts`, `nevada.ts`, `louisiana.ts` and `indiana.ts` predate the registry. They run on the same platforms but are wired by hand. **New platform states go in `STATE_FEEDS`.**

### 5.2 Standalone module: anything else

Use one of these as a template:

- `kentucky.ts`: an ArcGIS FeatureServer, paged by `resultOffset` and stopped when `exceededTransferLimit` is false.
- `nyc.ts`: a single plain JSON array.
- `oregon.ts` / `michigan.ts`: odd formats.

The shape of a module:

```ts
import type { CctvCamera } from './types';

const BOUNDS = { minLat, maxLat, minLng, maxLng };
export interface XRow { /* only the fields we read, all optional and nullable */ }

export function mapX(r: XRow | null | undefined): CctvCamera | null {
  // filter: offline, outside bounds, no https media, missing id
  return { id: `x-${r.id}`, lat, lng, name, city, country: 'US', feed_url, stream_type: 'jpg', source: 'X' };
}

export async function fetchXCameras(): Promise<CctvCamera[]> {
  const res = await fetch(URL, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`X cameras HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('X cameras: unexpected response');   // throw, never return []
  // map, dedupe by id within this source, return
}
```

Then add one entry to `FEEDS` in `catalog/feeds.ts`:

```ts
import { X_BOUNDS, fetchXCameras } from '@/lib/feeds/cameras/sources/<group>/x';
{ region: 'x', idPrefix: 'x', bounds: X_BOUNDS, fetch: fetchXCameras },
```

Older modules are wired by hand in `catalog/registry.ts` (`RAW_REGION_FETCHERS`) and `catalog/bounds.ts` (`getRegionsForBounds`). Don't add new ones there.

If an upstream keeps listing cameras it no longer streams, pass the list through `src/lib/feeds/cameras/liveness.ts`: `markMissingMedia` (one HEAD per camera, flags 404s; small lists only) or `markOfflineEmbeds` (asks tvkur and player.im whether an embed is on air). Both set `offline: true` only when the host definitely says it's off, so the pin stays and says so, and it clears by itself once the camera is back. An adapter must not return `[]` for a list the operator emptied on purpose: `cachedSource` treats empty as a failure and keeps serving the last list as if live. Return the last known cameras flagged `offline` instead (`turkey/kayseri-last-known.ts`).

Choosing an HTTP client:

- **Government APIs:** use plain `fetch` with an honest `UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)'`.
- **Sites that block bots:** `stealthFetch` (`src/lib/core/net/stealth-fetch.ts`) randomises the UA and spoofs forwarding headers.

### 5.3 Overlapping sources: who owns a row

When two upstreams publish the same physical camera, **the operator wins over the aggregator.** Drop the rows from the aggregator side by a stable attribute: the owner field, the media host or the native id. Never drop by proximity.

Examples:

- 511NY's `excludeOwners: ['NYC DOT']` (the direct NYC TMC feed owns those).
- `COVERED_ELSEWHERE` in `opencctv.ts`.
- Bounds boxes that stop at a state line. KYTC drops Indiana; Idaho's box leaves northern Nevada to `nevada.ts`.

### 5.4 Static or generated lists

Use `public-webcams.ts`, `world-live.ts`, `asia-live.ts` and the `*.generated.ts` files, regenerated by scripts in `scratch/`. Use this path only when there is no live API. Never bulk-import other people's frozen snapshots (CCTV-handoff.md §2, §5).

OpenWebcamDB (`scratch/scrape_openwebcamdb.js`, gitignored like its output `data/private/cameras/openwebcamdb.json`) is the template for a directory of operator streams: read the index once, keep each operator's own media, probe stills for freshness and embeds for framing, and dedupe against `.cache/cctv-catalog.json` by media URL or YouTube id.

---

## 6. Rules (enforced by code or learnt the hard way)

1. **Prefix ids by source** and keep them unique. Add a new prefix to the list in `us-511.test.ts`.
2. **Filter rows to the bounds box.** The same box decides when the region loads.
3. **Throw on failure, a bad shape or a short read.** `cachedSource` (`src/lib/core/net/source-cache.ts`) treats an empty result or a throw as a failure and keeps serving the last good data. A swallowed error that returns `[]` wipes nothing, but it hides the outage. A partial result is worse: it gets cached as if it were the truth.
4. **Use https media only.** Upgrade known hosts to https (see `kentucky.ts` `snapshotUrl`). Otherwise proxy the host:
   - add it to `ALLOWED_HOSTS` in `src/app/api/(feeds)/cctv/proxy/route.ts`;
   - if it serves plain http, also add it to `PROXY_IMAGE_HOSTS` in `types.ts`.
5. **Strip upstream cache-busters** (`?123456`), because the client adds `_t`.
6. **Set `stream_type: 'hls'` only for a playlist a browser can open**: CORS `*` on the playlist *and* on its segments, and no auth or session token. Otherwise keep the camera on its still.
7. **Stay well under 12 s per region.** Fan out with bounded concurrency (IBI uses 10).
8. **Register a fetcher under one region only.** The GET handler concatenates regions without deduping.
9. **Region keys must match `^[a-z-]+$`.** The client's retry logic (`camera-catalog.ts`) ignores any other key.
10. **Respect privacy.** No residential or home cameras, no credentialed URLs (`user:pass@`, `pwd=`), no RFC1918 hosts, no Opentopia or Insecam-style lists.

---

## 7. Tests (vitest, `src/lib/feeds/cameras/sources/<group>/<name>.test.ts`)

Patterns used across the existing tests:

- **Mapper fixture tests.**
  - Use a record copied verbatim from the upstream (comment: `// Verbatim from …`).
  - Assert the whole output with `toEqual`.
  - Spread overrides for each filter, e.g. `{ ...row, isOnline: 'false' }` with `toBeNull()`.
  - See `kentucky.test.ts`, `cars.test.ts` and `nyc.test.ts`.
- **Live test**, skipped unless `RUN_LIVE_TESTS=1`:
  ```ts
  const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
  liveIt('fetches a large set of well-formed X cameras', async () => {
    const cams = await fetchXCameras();
    expect(cams.length).toBeGreaterThan(N);                       // about 80% of today's count
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) { /* id regex, source, https media, inside bounds */ }
  });
  ```
- **Loader tests with a mocked network.** Use `vi.mock('@/lib/core/net/stealth-fetch', …)` (`ibi511.load.test.ts`) or `vi.stubGlobal('fetch', …)` (`texas.test.ts`). Use them when the loader has logic of its own: paging, short reads, owner exclusion.
- **Registry test:** `us-511.test.ts` checks that regions and prefixes are unique and that the bounds are sane.

```bash
npx vitest run src/lib/feeds/cameras/sources/<group>/<name>.test.ts                   # offline
RUN_LIVE_TESTS=1 npx vitest run src/lib/feeds/cameras/sources/<group>/<name>.test.ts  # hits the upstream
npm test                                                                      # everything offline
```

`route.test.ts` › "serves an already-cached region without going upstream again" fails on `main`; that is known (docs/roadmap.md). With `TAKIP_CCTV_SNAPSHOT=off`, tests write a stray file named `off` in the repo root. Don't commit it.

---

## 8. Verify end to end

```bash
npx tsc --noEmit
npx eslint src/lib/feeds/cameras/sources/<group>/<name>.ts src/lib/feeds/cameras/sources/<group>/<name>.test.ts src/lib/feeds/cameras/catalog/feeds.ts
npm run dev
curl -s "localhost:3000/api/cctv?region=<region>" | python3 -c "import json,sys;d=json.load(sys.stdin);print({k:v for k,v in d.items() if k!='cameras'});print(len(d.get('cameras',[])))"
curl -s "localhost:3000/api/cctv?lat=<lat>&lng=<lng>" | head -c 300     # does the viewport box pick the region?
```

Then on the map: zoom in, click a camera and check that the still refreshes and the HLS plays.

---

## 9. Gotchas

- **The source cache is in memory.** After you edit a provider, restart `npm run dev`, and delete `.cache/cctv-catalog.json` if the old catalogue keeps coming back.
- **ArcGIS reports errors as HTTP 200** with an `error` body. Check `json.error`.
- **IBI throttles bursts** rather than refusing them. One retry pass of the failed pages fixes it.
- **The CARS GraphQL `views[].url` must be selected through `... on CameraView`.** Selecting it bare gets a 400.
- **Placeholder images.** Alaska and Arizona serve the same 15,136-byte "no feed" PNG; it looks like the IBI platform default, because SANRAL i-traffic serves it too. i-traffic also serves a 5,939-byte "No live camera feed at this time" JPEG. On 2026-10-12, 33 of 60 sampled i-traffic stills were one of the two (11 of 15 in Gauteng). Status checking is planned for after the DB migration.
- **"PNG" stills that are JPEG.** `public.carsprogram.org/*.flv.png` is labelled `image/jpeg` but is a PNG. Browsers sniff the format, so it renders fine.
- **Malformed HTTP/1.1 headers.** undici rejects some hosts that curl and browsers tolerate (its.act.pr.gov). Use `http2Request` (`src/lib/core/net/http2.ts`) for those.

---

## 10. Sources

### Recently added

| Region | Module | Source | Cameras | Media |
|---|---|---|---|---|
| `newyork` | `us-511.ts` → `cars511x.ts` | 511NY (NYSDOT), `api-511x-nysdot.carsprogram.org/cameras/map-features` | 1,743 of 2,716 rows | HLS (`*.nysdot.skyvdn.com`, CORS `*` on playlist and segments) + still (`public.carsprogram.org`) |
| `nyc` | `nyc.ts` | NYC DOT TMC, `webcams.nyctmc.org/api/cameras` | 982 | still JPG (`/api/cameras/<uuid>/image`, `no-store`) |

511NY also lists 969 NYC DOT cameras. 961 of them are the same uuids as the direct feed, so they are excluded there (`excludeOwners`). The 8 that appear only in 511NY look like cameras NYC TMC has retired. Four more NYSDOT rows are dropped by the bounds box: three are parked at (0,0) and one has lost its longitude's sign. About 115 NYSDOT/NYC DOT pairs sit within 30 m of each other, but they are different devices from different agencies, so all of them are kept.

Added 2026-10-12, from a gap audit against Traffic Cam Archive's state list (the operators' own feeds; TCA itself encrypts its camera payload, so it was not used):

| Region | Module | Source | Cameras | Media |
|---|---|---|---|---|
| `maryland` | `mdchart.ts` | MDOT SHA CHART, `chartexp1.sha.maryland.gov/…/getCameraMapDataJSON.do` | 517 of 552 (ONLINE + OK/COMM_MARGINAL) | HLS only; the playlist is built from `cctvIp` + `id` |
| `missouri` | `modot.ts` | MoDOT, `traveler.modot.org/timconfig/feed/desktop/StreamingCams2.json` | 555 of 880 | HLS only. The 322 KC Scout `tisvc/…/CameraStream` rows 303 to tokenized, Referer-gated Wowza URLs and are dropped; `kcscout` carries their stills |
| `northdakota` | `nddot.ts` | NDDOT, `travelfiles.dot.nd.gov/geojson/cameras/cameras.json` | 809 views | still JPG |
| `rhodeisland` | `ridot.ts` | RIDOT, `risegis.ri.gov/…/Rhodeways/MapServer/6` | 139 (5 stills 307 to the home page) | still JPG; HLS needs RIDOT's Referer, so not used |
| `newmexico` | `nmdot.ts` | NMDOT, `servicev5.nmroads.com/RealMapWAR/GetCameraInfo` | 185 (about 1 in 5 stills is a placeholder or empty) | still via `GetCameraImage`; video is RTMP only |
| `westvirginia` | `wv511.ts` | WV511, `wv511.org/wsvc/gmap.asmx/buildCamerasJSONjs` + one `flowplayeri.aspx` lookup per camera for its `vtcN` host | 133 (about 19 playlists 404) | HLS only |
| `oklahoma` | `oktraffic.ts` | OKTraffic, `oktraffic.org/api/CameraPoles` with a `filter` | 459 | HLS only. Without the filter the server also returns non-public CCTV/Security cameras, so the mapper re-checks |
| `norway` | `vegvesen.ts` | Statens vegvesen, `road-weather-and-view.atlas.vegvesen.no/weather-information/measurement-sites` (needs `Accept: application/vnd.svv.v1+json` and `X-System-ID`) | 859 views, 134 with HLS | still + HLS |
| `arkansas` | `ardot.ts` | ARDOT IDrive Arkansas, `layers.idrivearkansas.com/cameras.geojson` | 514 of 552 | still (`layers.idrivearkansas.com/cameras/<id>.jpg`); HLS needs CloudFront signed cookies, so not used |
| `mississippi` | `mdottraffic.ts` | MDOTtraffic (MDOT), `www.mdottraffic.com/default.aspx/LoadCameraData` (JSON POST) + one `mapbubbles/camerasite.aspx?site=<n>` per site for its views | 1,068 of 1,189 views at 456 sites (the rest show `novideo.jpg`) | HLS + still, both on the view's Wowza host (16 `streaming*.mdottraffic.com` hosts, CORS `*` on playlist, chunklist and segments) |
| `wyoming` | `wydot.ts` + `wydot-sites.generated.ts` (`scratch/scrape_wydot_sites.js`) | WYDOT, `www.wyoroad.info/pls/Browse/WRR.Cameras` (one HTML page, 228 sites, 761 views) | 698 views at 210 sites | still JPG (`/web-cam/cache?ref=<opaque token>`, 1280×720, tolerates `&_t=`) |
| `southafrica` | `i-traffic.ts` + `itraffic-names.generated.ts` (`scratch/scrape_itraffic_names.js`) | SANRAL i-traffic, `www.i-traffic.co.za/map/mapIcons/Cameras` (ids + coordinates, 1.1 s) | 1,239 (every marker; about half show a "No live camera feed" card, §9) | still (`/map/Cctv/<camera>--<agency>`) |
| `saskatchewan`, `manitoba`, `newfoundland`, `pei`, `yukon` | `us-511.ts` → `ibi511.ts` | `hotline.gov.sk.ca`, `manitoba511.ca`, `511nl.ca`, `511.gov.pe.ca`, `511yukon.ca` | 54 / 46 / 48 / 7 / 14 | still JPG |
| `ontario` | `us-511.ts` → `ibi511.ts` | 511 Ontario (MTO), `511on.ca/List/GetData/Cameras` (keyless; `/api/v2/get/cameras` needs a key since 2026-09) | 836 of 925 (added 2026-10-13). The 89 rows whose `source` is `City of Toronto` or `York Region` are dropped: same frames as those feeds | still JPG, first of 1,655 views |
| `alberta` | `canada/alberta.ts` → `ibi511.ts` | 511 Alberta, `511.alberta.ca/List/GetData/Cameras` (keyless; 500s above 50 rows a page) | ~148 of 337 (added 2026-10-13). About 190 rows re-serve City of Calgary cameras, byte-identical, under `Calgary`, `Alberta511` and `USER` owners. Rows with those owners are dropped by position (150 m) or by name (2 km) against `calgary`. Provincial RWIS (`WOOD`) and `Parks` rows are always kept: three RWIS masts stand at city interchanges with their own view | still JPG |
| `kcscout` | `kcscout.ts` | KC Scout, POST `www.kcscout.net/DataProvider.asmx/LoadEntities` with `{}` (keyless) | 189 Missouri-side `M…` cameras (added 2026-10-13). 106 of them used to come through KanDrive captioned Kansas, which now drops them (`excludeFeeds`); the `K…` rows stay with KanDrive, and the 14 `P…` rows sit at 0,0 | still JPG (`TransSuite.VCS.CameraSnapshots/<id>.jpg`, fresh within ~2 min, any Referer); video needs a per-session token |
| `illinois` | `illinois.ts` | IDOT's Gateway ArcGIS layer `TrafficCamerasTM_Public` | 3,012 views (2026-10-13): 1,557 Lake County PASSAGE + 1,455 on `cctv.travelmidwest.com` (DuPage 730, IDOT 599 — Chicago, statewide and Metro East — Kane 90, Tollway 36) | still JPG. Travel Midwest 403s a foreign Referer (its own host and localhost pass), so those go through `/api/cctv/proxy`, which holds each frame 5 minutes: IDOT asks for a 5-minute minimum per image. IDOT also asks for registration via its Gateway data-request form: not filed |
| `surrey` | `canada/surrey.ts` | City of Surrey, `gisservices.surrey.ca/arcgis/rest/services/Public/Transportation/MapServer/2` | 618 views at ~580 intersections (added 2026-10-13). Rows are kept by still host (`stcameleonprod.blob.core.windows.net`); the layer's 38 DriveBC rows and 24 dead `cosmos.surrey.ca` stills are dropped | still JPG, refreshed about once a minute |
| `bellevue` | `us/bellevue.ts` | City of Bellevue, `services1.arcgis.com/EYzEZbDhXZjURPbP/…/TrafficCameras_Public_View/FeatureServer/0` | 205 (added 2026-10-13). `Media = Stream` rows not owned by WSDOT or Redmond; ids are upper-cased (some rows say `cctv167`) | HLS only, `trafficcams.bellevuewa.gov/traffic-edge/<ID>L.stream/playlist.m3u8`, CORS `*`; about 1 in 10 is offline. Bellevue's own player stops after 30 s to save bandwidth |
| `redmond` | `us/redmond.ts` | City of Redmond, `gis.redmond.gov/arcgis/rest/services/Traffic/Cameras/MapServer/0` | 70 (added 2026-10-13) | still JPG (`/traffic/tcimages/<TCID>.jpg`, ~30 s old) |
| `kirkland` | `us/kirkland.ts` | City of Kirkland, `services2.arcgis.com/loGMwowmR0OPlOQb/…/TRN_TrafficCams_10032022/FeatureServer/0` | 28 `CoK` rows (added 2026-10-13); the WSDOT, `CoB` and `CoR` rows are other feeds'. `TRAFCAM_ID` repeats, so ids come from the file name; `LAT`/`LON` are swapped, the geometry is right | still JPG (`its.kirklandwa.gov/CamView/*.jpg`, ~1 min old) |
| `kingcounty` | `us/kingcounty.ts` | King County Roads, `services.arcgis.com/Ej0PsM5Aw677QF1W/…/TRAFFICCAMERA_POINT_2029/FeatureServer/0` with `CurrentStatus='Active' AND Live=1` | 58 (added 2026-10-13); its 4 Redmond rows are `redmond`'s | still JPG (`info.kingcounty.gov/…/Handler.ashx?id=<file>`, listed as http, served over https) |
| `spokane` | `us-511.ts` → `cars.ts` | SRTMC (Spokane Regional TMC), `www.srtmc.org/api/graphql` | 119 (added 2026-10-13); the 9 WSDOT stills on `public.carsprogram.org` are dropped. About 50 are the same cameras WSDOT republishes as stills under `images.wsdot.wa.gov/spokane/`; both are kept because these add live video | still (`images.srtmc.org`) + HLS (`*.streamlock.net/live/<uuid>_public.stream`, CORS `*`) |
| `alertcalifornia` | `us/alertcalifornia.ts` | ALERTCalifornia index + ALERTWest `api.cdn.prod.alertwest.com/api/getCameraDataByLoc` (keyless, 6.7 MB) | 1,830 (2026-10-13; was ~1,280). The index publishes ~550 live cameras with no location or name; ALERTWest lists the same cameras by hostname (`cams[].hn` = index `id`, `lid` → `locs[]`), which places them: Hawaii 180, Nevada 118, Oregon 77, Montana 55, Idaho 38, plus Utah, Washington, Wyoming, Colorado, Alberta. Without ALERTWest the region falls back to California only | still JPG (`latest-frame.jpg`) |

CARS video (2026-10-13): asking the map query for `sources { type src }` works on every CARS deployment. `videoHosts` turns it on per feed: Minnesota (1,232 of 1,510 cameras, `video.dot.state.mn.us`, 18 of 20 sampled live) and Iowa (701 of 863, `video{2,3,4}.iowadot.gov:8888`, fMP4, 19 of 20 live). Massachusetts' streams are TrafficLand URLs with a session token and an expiry, so it stays on stills; Kansas and Nebraska list none. When a stream fails, the viewer falls back to the camera's still.

ARDOT (re-probed 2026-10-12; terms pending: IDrive's camera terms prohibit embedding or linking to camera images):

- The list is a keyless S3/CloudFront GeoJSON (552 rows, 0.3 s). The stills answer 200 with CORS `*` and no cookies, tolerate `?_t=`, and refresh about every 20 minutes. They are served as `image/png` despite the `.jpg` name. IDrive's own `actis.idrivearkansas.com/index.php/api/cameras/image?camera=<id>` 302s to the same file.
- Video stays out: `cdn.idrivearkansas.com/live/idrive_<id>_base.stream/playlist.m3u8` answers 403 `MissingKey` (CloudFront signed cookie, minted by `api.idrivearkansas.com/vend`, which we don't call), and the relay `actis…/api/cameras/feed/<id>.m3u8` answers 403.
- The mapper drops 38 relayed rows by `ahtd_camera_number` (`TN…`, `MS…`): 35 TDOT Memphis cameras whose stills had not changed in 26 days, and 3 MDOT cameras showing MDOT's "temporarily unavailable" card. Three ARDOT stills (722, 866, 867) are ARDOT's own placeholder.
- Traffic Cam Archive's Arkansas list (~562 names in 11 city groups) is all ARDOT, matching this feed. No city, metro (Metroplan, NWA), university or county public camera feed turned up. The only ArcGIS hit, `iDriveCCTV_20260707_v2` (Garver), is a consultant's frozen copy of the same IDrive list.

MDOT (re-probed 2026-10-12; terms pending: MDOT's portal terms allow non-commercial use only, and commercial terms go through MDOT's CIO):

- There is no bulk view list. `LoadCameraData` has sites only, and neither the other `default.aspx` page methods nor `listView_cameraSites.aspx` carry stream ids. The video wall needs a login. So the fetcher reads each site's bubble, 10 at a time with one retry pass. That takes about 3.8 s for 456 sites, which fits a region.
- The view's stream id is the native id (`010406`, `D6-0042`; unique across all 1,189). The bubble's thumbnail host is also the HLS host on all 16 hosts.
- Before this, the only cameras inside Mississippi were 11 FAA WeatherCams.

WYDOT (added 2026-10-12; terms pending: wyoroad.info's disclaimer sets no reuse limit, but WYDOT hides its 511 map feed, so ask wyoroad@wyo.gov before commercial use):

- The statewide page lists route, nearest town, site name, milepost and every view's still. The `ref` tokens are base64 of an AES ("Salted__") blob: used verbatim, never decoded. They are the same on every page and between loads, and the stills need no cookie or Referer.
- The page has no coordinates. The 511 map has them, in a protobuf feed whose URL the bundle deliberately obscures; that feed is not used. Instead `scratch/scrape_wydot_sites.js` places each site once from WYDOT's public ArcGIS org (`services2.arcgis.com/WI04Bd6haCzitbuQ`): 35 RWIS stations (same name, within 0.3 mi of the camera's milepost) use the `RWIS` layer's surveyed position, and the rest are interpolated on `COPY_2020mileposts_10thsZIP` (tenth-mile reference markers by WYDOT route id, `ML80B` etc.). The signed highway → WYDOT route match uses the route pages' location text ("6.9 miles east of Evanston") against Census place centroids, RWIS's route ids, and neighbouring sites. Milepost placements land a median 27 m from nearby RWIS stations, and no two sites on one WYDOT route sit farther apart than the road between their mileposts (the script checks this; I-90's milepost equation near Sheridan is the one expected exception).
- 18 sites whose location text only names a far town or a county/state line stay unplaced; `wydot.ts` skips them and logs the count. Rerun the script when that count grows, because a moved or new site drops out until then.
- The view id is `wydot-<site slug>-<caption suffix>` (`wydot-i80summit-west`). The slug is WYDOT's own (`view?site=I80Summit`), joined from the four route pages by route + milepost when the table is generated.

SANRAL i-traffic (names added 2026-10-12; terms pending: i-traffic forbids republishing without SANRAL's written consent):

- This is the older IBI stack. `/List/GetData/Cameras` wants a POSTed DataTables body with the full `columns` array (a bare body 302s to `/Error`), so `ibi511.ts`, which GETs a query string, doesn't apply. It needs no key, cookie, anti-forgery token or Referer, but it takes 15–20 s for all 1,239 rows, paged or not, and the server stalls past three parallel pages.
- So the region reads the fast marker list, and names plus metro (`displayName`, `cityName`) come from a table that `scratch/scrape_itraffic_names.js` reads once from the list. `i-traffic.ts` logs how many cameras lack a generated name; rerun the script when that count grows.
- No list field (`visible`, `displayCamera`, `blocked`) predicts the dead stills.

OpenWebcamDB, generated (§5.4), terms pending: its API is non-commercial and rules out aggregators.

| Region | Module | Source | Cameras | Media |
|---|---|---|---|---|
| `owdb-americas`, `owdb-emea`, `owdb-apac` | `data/private/cameras/openwebcamdb.json`, not in git (`scratch/scrape_openwebcamdb.js`) | `openwebcamdb.com/webcams.geojson` + each camera page's VideoObject | 1,372 of 1,861 (385 / 774 / 213) | 520 YouTube channel `/live`, 267 YouTube video ids (live when generated), 315 iframe, 181 still, 26 HLS, 63 link |

Dropped: 247 dead or ended YouTube ids, 96 stills older than a day, 68 already in the catalogue, 31 privacy exclusions (indoor workplaces, children, private occasions, garden feeders), and a few http-only, tokenised or non-CORS streams. `opencctv.ts` drops its `openwebcamdb` sub-source (`COVERED_SOURCES`) so this list owns those rows.

Added 2026-10-12 from `docs/inspiration-sources/provenance.md` (all terms pending; see each `feeds.ts` comment):

| Region | Module | Source | Cameras | Media |
|---|---|---|---|---|
| `texas` (HOU) | `houston-transtar.ts` (`placeUnmatchedTranstar`) | City of Houston GIS `services.arcgis.com/NummVBqZSIJKUeVR/…/Trantar_Camera_Locations/FeatureServer/0` | ~140 more TranStar cameras (`transtar-<n>`) | still JPG (`traffic.houstontranstar.org/snapshots/cctv/<n>.jpg`) |
| `scotland` | `traffic-scotland.ts` + `traffic-scotland/frame` route | Transport Scotland, `www.traffic.gov.scot/tsis/cameras` | 415 | still, decoded by our route from `tsis/camerahtml?sid=<n>` (a base64 JPEG in HTML; there is no image URL) |
| `puertorico` | `act-pr.ts` | ACT, `POST its.act.pr.gov/es/Default.aspx/GetCctv` (body `{}`, answer in the ASP.NET `d` envelope) | 42 (2 stills 500, 2 days stale on 2026-10-12) | still JPG (`/images/cameras/<name>.jpg`) |
| `bellingen` | `bellingen.ts` | Bellingen Shire Council (NSW), `services7.arcgis.com/kkiBaYsUIhK1wEpz/…/Flood_Camera_Network/FeatureServer/0` | 6 bridge flood cameras | still JPEG (`public.disasterwatch-iotp.com.au/prospectpublicimages/<n>/…`) |
| `bosnia-bihamk` | `bihamk.ts` | BIHAMK, `bihamk.ba/spi/kamere` (HTML cards) | 13 of 15 (Prisika and RICO Tuzla can't be placed) | still JPG (`video-nadzor.bihamk.ba/videosurveillence/<KEY>.jpg`) |
| `serbia-borders` | `mup-serbia.ts` | Serbian MUP, `www.mup.gov.rs/wps/portal/sr/kamerе/kamerеGP` (Cyrillic `е`; `toggleCamera(...)` calls) | the live ones among 20 streams at 10 placed crossings: 8 on 2026-10-12 (13 of all 32 were live; 5 are at Đala, Vatin and Batrovci, which aren't placed) | HLS only (`kamere.mup.gov.rs:4443`, CORS `*` on playlist and segments) |

- **Houston.** The TxDOT name join (`matchHoustonTranstarCameras`) places 460 of TranStar's 923 listed cameras. The city's layer has 451 sites: 243 are already joined, and 141 more are listed by TranStar and get placed by the fill. The fill only uses ids TranStar still lists, because some sites in the layer have frames a week old. `fetchTexasCameras` drops a `transtar-*` row when the YKM join has already placed the same frame.
- **Traffic Scotland.** The frame route takes a numeric `sid`, never a URL, and caches for 60 s (`next: { revalidate: 60 }`). Because the still is a relative URL, `lib/intel/vision/server/frames.ts` has no still for these cameras, as with TxDOT.
- **ACT Puerto Rico.** The host sends ` Permissions-Policy` with a leading space, so undici's HTTP/1.1 parser throws ("Unexpected whitespace after header value"). `lib/core/net/http2.ts` reads the list over HTTP/2 instead. Browsers load the stills fine.
- **BIHAMK and MUP have no coordinates.** Crossings are placed from OSM `barrier=border_control` nodes, taken from Overpass, Nominatim and Photon on 2026-10-12. Four BIHAMK city/pass cameras use OSM place points a few hundred metres off. Unplaceable cameras are left out, never guessed.
- **MUP liveness.** About half the playlists answer 404 at any one time, so the fetcher reads each playlist (6 at a time) and keeps only `#EXTM3U` answers.

Added 2026-10-12 (terms pending: njta.gov's disclaimer has a copyright line and no reuse terms):

| Region | Module | Source | Cameras | Media |
|---|---|---|---|---|
| `njta` | `njta.ts` | NJ Turnpike Authority, `www.njta.gov/travel-resources/camera-list/` (one HTML page) | 136: 71 Turnpike, 65 Garden State Parkway (3 playlists 404 on 2026-10-12) | HLS only (`wink.njta.com/<200–204>/public/hls/<device>_nj.m3u8`; the playlist reflects the request's Origin rather than `*`, and segments send `*`) |

- There is no camera API: `/wp-json/njta/v1` has only partials, alerts, entrances and tolls. The page's map block carries every camera, with coordinates, in an entity-encoded `data-block-config` attribute (`initialData.cameras.{turnpike,parkway}`).
- Labels are landmarks relative to the camera (`relative_direction` `north` + `NJ 73 (Mount Laurel Twp)` is NJTA's "north of NJ 73"). The trailing town becomes `city`.
- The region is `njta`, not `newjersey`, which stays free for 511NJ (NJDOT), not added yet.

Added 2026-10-19, Nevşehir province / Cappadocia, which had no camera (no published terms; permission pending):

| Region | Module | Source | Cameras | Media |
|---|---|---|---|---|
| `nevsehir` | `turkey/nevsehir.ts` (+ `nevsehir-cert.ts`) | Nevşehir Belediyesi, `belsis.nevsehir.bel.tr/kameracanli/canli` (the page `canli.nevsehir.bel.tr` frames; one card per camera with a stream key) | 2 of 4, both off air on 2026-10-19 | HLS only, `belsis.nevsehir.bel.tr/hls/live/<key>/index.m3u8` (Node-Media-Server, CORS `*`; 404 while nothing publishes) |
| `uchisar` | `turkey/uchisar.ts` | Uçhisar Belediyesi, the Clappr players on `uchisar.bel.tr/uchisar-canli-kamera-{merkez,vadi}/` | 1 (live) | HLS only, `player.rade.com.tr/live/uchisar1.stream/playlist.m3u8` (Wowza; CORS reflects the Origin on playlist, chunklist and segments) |
| `asia-live` | `data/private/cameras/skyline.json`, not in git | SkylineWebcams 979, Pigeon Valley from Helike Cave Suites, Uçhisar | 1 (still refreshes every ~10 min) | proxied `live979.jpg` + link; Skyline's own HLS is left alone |

- **No coordinates upstream.** Nevşehir cameras are placed by name (`Kayaşehir …` at the underground city); the two `Meydan` cameras are left out because the city doesn't say which square. Uçhisar's `uchisar1` shows the town-centre roundabout. `uchisar2` (the "Vadi" page) was off air, so its view and place are unknown and it is left out.
- **belsis.nevsehir.bel.tr omits its intermediate certificate** (Sectigo DV R36), so Node's fetch fails where browsers don't; the adapter requests over `node:https` with the intermediate added, and does its own 404 check instead of `markMissingMedia`.
- **The Skyline row is a hand edit** of a generated file whose generator isn't in the repo; regenerate with care.
- Not found: any 24/7 YouTube live from Göreme or a hotel, a Göreme, Avanos, Ortahisar, Derinkuyu or Kaymaklı municipal camera, or KGM road cameras. `urgup.bel.tr` sits behind a Cloudflare challenge and wasn't read.

### Leads, with tested endpoints

| Lead | Cameras | Notes |
|---|---|---|
| TDOT SmartWay (TN) | ~661 (TDOT's figure), HLS + still | Re-probed 2026-10-12. The catalogue has no Tennessee-operator cameras. The only index is `tdot.tn.gov/opendata/api/public/RoadwayCameras` (Swagger at `tdot.tn.gov/opendata/`). Without a key it answers 401. It wants an `apiKey` header from a "TDOT Api Key Holder account", and there is no self-serve sign-up, so ask TDOT.Comments@tn.gov (asked 2026-10-13, no reply yet). Don't reuse the key in SmartWay's front-end. The media needs no key (checked in all four regions): HLS `mcleansfs{1-5}.us-east-1.skyvdn.com/rtplive/<R#_###>/playlist.m3u8` has CORS `*` on the playlist, chunklist and segments, and the still is `tnsnapshots.com/<R#_###>.png` (the row's `/thumbs/<id>.flv.png` 301s there). Row fields: `id`, `title`, `jurisdiction`, `route`, `mileMarker`, `active` ("True"/"False"), `httpsVideoUrl`, `thumbnailUrl`, `location.coordinates`. A keyed adapter reads its key from an env var and skips itself when it's unset |
| BPJT (Indonesia toll roads) | ~439 usable HLS | Inline `allStreams` JSON on `bpjt.pu.go.id/cctv/`. Use this instead of the trafficvision.live URL in CCTV-handoff.md |
| FAA WeatherCams | ~3,549 | `weathercams.faa.gov/api/cameras`; the latest image needs one call per camera |
| Caltrans HLS upgrade | 1,964 | Read `streamingVideoURL` in the existing fetcher; drop `rtsp:` |
| Catalonia SCT, Trafikoa | — | Not probed yet |
| JP Putevi Srbije toll plazas | 38 at 19 plazas | `kamere.toll4all.com` lists `cam-item` posters (`cam.bitinfo.co.rs/<slug>/index.jpg`, `jpps.bitinfo.co.rs/…`; fresh on 2026-10-12) with no positions. HLS 403s without `Referer: https://kamere.toll4all.com/`, so the cameras would be stills only. Blocked on a gazetteer: Overpass answered 504 all evening, and Photon only knows 4 plazas (EV chargers at Preševo, Stara Pazova, Subotica, Vrčin). Retry `barrier=toll_booth` in Serbia |
| CET São Paulo | ~11 | No list API, so a hand table would be needed; only about 10 of the 205 `/cams/<n>/1.jpg` folders are live |
| NYS Thruway (upstate NY) | 254 HLS | Probed 2026-10-13. Upstate NY is blank today: every row of the `newyork` 511x feed is NYC DOT, which it excludes. `webdataapi.thruway.ny.gov/api/data/trafficcameras/xml` (keyless; `www.thruway.ny.gov` is Cloudflare-challenged, this host is not): `<camera>` with lat/lng, `cameradesc`, `directiondesc`, `groupid`, `videourl`, `imageurl`, `active`, `problemstream`. HLS `s58.nysdot.skyvdn.com/rtplive/TA_130/playlist.m3u8`, CORS `*`, 8 of 8 live. Stills are a placeholder PNG, so HLS only. Broadcast needs the Authority's approval (form TA-W6800) |
| NITTEC (Buffalo–Niagara) | ~32 live NYSDOT Region 5 | `www.nittec.org/content/json/nittec.js` (JSON, 899 KB), `cctv[0]` has 204 rows: NYSDOT 91 (only the `s53`/`s7` skyvdn hosts answer; `s51`, `s52`, `s9` 502), NYSTA 66 (= Thruway), MTO 38 (= 511 Ontario), Peace Bridge 5 (YouTube). Live R5 stills work: `nyssnapshot.com/thumbs/R5_xxx.flv.png` 301s to a real frame. ToS: no copying without signed permission |
| WeatherSTEM (Southeast sky cams) | 862 stills | `cdn.weatherstem.com/dashboard/data/dynamic/dashboard.json` (keyless, ~960 KB): 890 stations with `geo.lat/lng`, FL 510, GA 79. Still `cdn.weatherstem.com/skycamera/<county>/<station>/cumulus/snapshot.jpg`, CORS `*`, ~30 s old. Live video needs a token. Terms: written permission for reuse, credit WeatherSTEM and the host |
| Palm Beach County (FL) | ~211 active of 225 | WINK portal `pbctrafficstreams.pbc.gov/portal/feeds/loader.php` (XML `<stream>` with lat/lng). Still `…/vf2/media/image.php?guid=<guid>` (840×472). HLS `…/hls/public/vf2/<guid>_high/index.m3u8` sends no CORS header, so it would need a relay. 14 of 225 sit within 100 m of an FL511 camera |
| Arlington (TX) | 79 online | `services.arcgis.com/jXi5GuMZwfCYtZP9/…/Traffic_Camera_Updates_view/FeatureServer/0` (`Status` Online 61, Online (Entertainment) 18). Still `webapps.arlingtontx.gov/webcams/<name>.jpg`, refreshed every 5 min. 10 within 100 m of TxDOT |
| Vancouver (BC) | 219 sites, 848 views | ArcGIS `services3.arcgis.com/qrcTTRTwUoS8N47o/…/Web_Cameras_view/FeatureServer/0` (`NUMBER_CAMERAS`). Image names live only on each site's `.htm` page, so this wants a generated list (§5.4) |
| Fort Collins (CO) | ~100 stills at 25 intersections | GeoJSON `www.fcgov.com/webservices/gis/data/fctrip-cameras`; still `www.fcgov.com/fctrip/camera-images/<id>.jpeg`. None within 150 m of CDOT |
| Denver (city) | 80 stills at 20 intersections | Public S3 listing `dengov-traffic-cameleon.s3.us-west-2.amazonaws.com/?list-type=2` (92 keys); no coordinates, so place ~20 by hand. The city viewer's bundle ships AWS keys: don't use them, they aren't needed |
| Boulder (CO) | 21 HLS | `videostream.bouldercolorado.gov/live/smil:<name>.smil/playlist.m3u8`, CORS `*`; 4 traffic quads (positions from `maps.bouldercolorado.gov/…/TrafficCameras/MapServer/0`), 13 open-space, 3 airport, 1 creek |
| Everett, Issaquah (WA) | 40 + 28 stills | Pages are Cloudflare-blocked to curl, image hosts are not: `coe.everettwa.gov/Broadway/Images/<Name>/<Name>.jpg`, `products.issaquahwa.gov/cams/<name>.jpg`. No coordinates: hand lists |
| HPWREN (San Diego ridge tops) | 199 colour fixed cameras at 55 sites | `www.hpwren.ucsd.edu/cameras/sites.js` (JS object, trailing commas); still `cdn.hpwren.ucsd.edu/RT/<cam>.jpg`, 7 of 8 fresh. ALERTCalifornia lists the same towers with no location and stale frames, so no overlap. Real-time use needs a UCSD licence |
| NOAA NDBC BuoyCAMs | 91 | `www.ndbc.noaa.gov/buoycams.php`; offshore buoys, still per station |
| Port of Virginia, NWSA, APM Elizabeth (port gates) | 23 + ~13 + 2 | PoV: POST `cameras.wpengine.com/graphql` (`cameras { nodes { title slug cameras { filename } } }`), still `wp.portofvirginia.com/cameras/<file>`. NWSA: `<img>` list on `nwseaportalliance.com/cargo-operations/cameras-truck-turn-times`. APM: `cms-cd.apmterminals.com/apm/api/v1/gatecameras/gate-camera?id=<uuid>`. No coordinates: place each terminal by hand |
| El Paso bridges, Niagara bridges, Univ. of Utah | 8 HLS, 3, 11 | El Paso: `zoocams.elpasozoo.org/<name>.m3u8` (CORS `*`; list on `www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html`). NFBC: 3 CamStreamer embeds on `niagarafallsbridges.com/services/traffic-conditions`, not in the CamStreamer gallery. Utah: `horel.chpc.utah.edu/data/station_cameras/<id>_cam/<id>_cam_current.jpg` |
| Durham Region, Municipal511 (ON) | 138, ~31 | Terms forbid display elsewhere / redistribution. Municipal511's manifest hashes rotate each update, so re-read its home page per poll |

### Probed and not added

| Source | Why |
|---|---|
| ALDOT ALGO (AL) | Terms prohibit "transmitting … without the permission of ALDOT"; video is FairPlay/Widevine DRM |
| HDOT GoAkamai (HI) | Terms forbid display without written permission; the list API is locked to goakamai.org's Origin |
| City of Biloxi (MS) | Its camera page now sits under `/traffic-broken/` and embeds 12 of MDOT's own views from a retired host (`http://streaming5.mdottraffic.com:1935`, NXDOMAIN). `mdottraffic.ts` carries those cameras |
| DDOT (DC) | DDOT's camera link is dead; TrafficLand needs a token and a licence |
| National Highways | Licence-only (VIH). Traffic Scotland, held here earlier for "may not hyperlink directly to the traffic camera images", is now shown with terms pending (see above) |
| Traffic Cam Archive | Commercial archive; the camera payload is encrypted client-side |
| trafficvision.live | robots.txt disallows `/camera-data/`; terms forbid scrapers and bulk download |
| `RoadwayCameras` FeatureServers on ArcGIS Online (TN) | `services7.arcgis.com/33Tmvrm3G2UZLFK9/…/RoadwayCameras_a4e3…` and `services8.arcgis.com/hkhKI6Qq7rjvBjZU/…/RoadwayCameras` are JSON-to-CSV dumps of TDOT's feed by non-TDOT accounts. Both have 570 rows, with data last edited 2022-12 and 2020-11. They are frozen snapshots (§5.4) and probably the source of Argus's "TN 527". TDOT's own ArcGIS (`spatial.tdot.tn.gov`, org `nf3p7v7Zy4fTOh6M`) has no camera layer |
| Murfreesboro, Franklin (TN) | Murfreesboro's city layer `services5.arcgis.com/A5C0MR9xfkxVRwat/…/Cameras/FeatureServer/0` has 37 points with no media field, and its CityTV YouTube channel has no live cameras. Both cities' sites 403 an honest UA (Cloudflare, Akamai) |
| Clarksville (TN) | The live cameras appear only as `g1.ipcamlive.com` iframes on a news site (clarksvillenow.com), and the page doesn't say who operates them. The city has withdrawn public access to one camera |
| Nashville, Knoxville, Chattanooga, Memphis, Brentwood (TN) | No feed of their own: they point to SmartWay. Memphis's city cameras feed the police Real-Time Crime Center (privacy). Brentwood shows a camera tour on cable channel 19 only |

### Known broken

- `us-central` (IDOT): the upstream now returns an empty object.
- The Kansas box's east edge (−94.5) lets in about 83 Missouri cameras.
- 48 reused ids (`nl-rws-*`, DGT, Live Traffic, OpenCCTV).
