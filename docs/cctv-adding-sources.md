# Adding a camera source

Read this before adding or fixing a CCTV source. It should save you from re-reading `src/app/api/cctv/` from scratch.

- Last verified: 2026-10-11, at commit `fde0872` plus the 511NY / NYC DOT work.
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
| Region wiring in `route.ts`: `RAW_REGION_FETCHERS`, `getRegionsForBounds`, `cachedSource`, the 12 s budget, the snapshot file | **Goes away.** Expect to delete it. Don't add logic there. |
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
3. Otherwise **write `src/app/api/cctv/<name>.ts`**: types for the raw row, a pure `mapX()` and an exported `fetchXCameras()`. Copy `kentucky.ts` or `nyc.ts`.
4. **Wire it up in `src/app/api/cctv/route.ts`**:
   - import it;
   - add `'<region>': fetchXCameras` to `RAW_REGION_FETCHERS`;
   - add the bounds box to `getRegionsForBounds()`.
5. If the media host needs it (plain http, Referer quirks), **add it to the proxy allowlist** (§6).
6. **Write tests** (§7): fixture tests for the mapper, plus one live test. Add a new id prefix to `us-511.test.ts`.
7. **Verify** (§8): `npx vitest run src/app/api/cctv/<name>.test.ts`, the live test, `npx tsc --noEmit`, `npx eslint <files>`, and then the dev server.
8. **Update this doc**: the source table in §10, and any platform you discovered.

---

## 2. How it works today

```
Browser ── GET /api/cctv?region=all ──▶ src/app/api/cctv/route.ts
                                          RAW_REGION_FETCHERS { region → fetcher }
                                            + STATE_FEEDS from us-511.ts (merged in; a duplicate region throws)
                                          each wrapped in cachedSource('cctv:<region>')  (30-min TTL, stale on error)
                                          4 regions at a time, 12 s per region, 5-min backoff
                                          prebuilt gzip payload + .cache/cctv-catalog.json snapshot
        ◀── merged JSON (every camera, ~1.5 MB gzipped) ──
src/lib/camera-catalog.ts   merges by id; retries pending regions only
OsirisMap.tsx               one 'cctv' GeoJSON source → cctv-dots / cctv-label layers
CameraViewer.tsx            plays hls / mp4 / mjpeg / iframe, or a jpg refreshed every 5 s (?_t=)
CctvPreviews.tsx            preview tiles from zoom 13 (jpg refreshed every 15 s)
```

- All upstream fetching happens **server-side**. Images and streams load **in the browser, straight from the operator**, unless the host is behind `/api/cctv/proxy`.
- A region that misses its 12 s budget drops out of *that* response, but its fetch keeps running into the cache. Keep a single region well under 12 s.

---

## 3. The camera record (`src/app/api/cctv/types.ts`)

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
}
```

- **Setting both `feed_url` and `stream_url` + `'hls'` is ideal.** The viewer plays the stream, and preview tiles and vision use the still.
- The map forwards only these fields (`OsirisMap.tsx`, in the `setGeo('cctv', …)` call). A new field needs that line changed too.

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
curl -s -m 10 -D - -o /dev/null "<M3U8_URL>" -H "Origin: https://osirisai.live" | grep -iE "^HTTP|access-control-allow-origin"
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

### 5.1 Known shared platforms: one line in `src/app/api/cctv/us-511.ts`

`STATE_FEEDS` entries carry the region, the id prefix, the bounds and the fetcher. `route.ts` registers both the region and its viewport box from them automatically.

| Platform | How to spot it | Helper | Entry |
|---|---|---|---|
| **IBI 511** | `https://<site>/List/GetData/Cameras?query=…` returns DataTables JSON (`recordsTotal`, `data[]`, WKT `latLng`) | `ibi511.ts` (`loadIbi511Cameras`) | `ibi('pennsylvania', { base, idPrefix, source, state, bounds, videoHosts? })` |
| **CARS 511 (GraphQL)** | `POST https://<site>/api/graphql` with `mapFeaturesQuery` | `cars.ts` (`loadCarsCameras`) | `cars('minnesota', { host, idPrefix, source, state, bounds })` |
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

Then make three edits in `route.ts`:

```ts
import { fetchXCameras } from './x';
// in RAW_REGION_FETCHERS:
'x': fetchXCameras,
// in getRegionsForBounds():
if (lat > MIN_LAT && lat < MAX_LAT && lng > MIN_LNG && lng < MAX_LNG) regions.push('x');
```

Choosing an HTTP client:

- **Government APIs:** use plain `fetch` with an honest `UA = 'OSIRIS/5.0 (+https://osirisai.live)'`.
- **Sites that block bots:** `stealthFetch` (`src/lib/stealthFetch.ts`) randomises the UA and spoofs forwarding headers.

### 5.3 Overlapping sources: who owns a row

When two upstreams publish the same physical camera, **the operator wins over the aggregator.** Drop the rows from the aggregator side by a stable attribute: the owner field, the media host or the native id. Never drop by proximity.

Examples:

- 511NY's `excludeOwners: ['NYC DOT']` (the direct NYC TMC feed owns those).
- `COVERED_ELSEWHERE` in `opencctv.ts`.
- Bounds boxes that stop at a state line. KYTC drops Indiana; Idaho's box leaves northern Nevada to `nevada.ts`.

### 5.4 Static or generated lists

Use `public-webcams.ts`, `world-live.ts`, `asia-live.ts` and the `*.generated.ts` files, regenerated by scripts in `scratch/`. Use this path only when there is no live API. Never bulk-import other people's frozen snapshots (CCTV-handoff.md §2, §5).

---

## 6. Rules (enforced by code or learnt the hard way)

1. **Prefix ids by source** and keep them unique. Add a new prefix to the list in `us-511.test.ts`.
2. **Filter rows to the bounds box.** The same box decides when the region loads.
3. **Throw on failure, a bad shape or a short read.** `sourceCache` treats an empty result or a throw as a failure and keeps serving the last good data. A swallowed error that returns `[]` wipes nothing, but it hides the outage. A partial result is worse: it gets cached as if it were the truth.
4. **Use https media only.** Upgrade known hosts to https (see `kentucky.ts` `snapshotUrl`). Otherwise proxy the host:
   - add it to `ALLOWED_HOSTS` in `src/app/api/cctv/proxy/route.ts`;
   - if it serves plain http, also add it to `PROXY_IMAGE_HOSTS` in `types.ts`.
5. **Strip upstream cache-busters** (`?123456`), because the client adds `_t`.
6. **Set `stream_type: 'hls'` only for a playlist a browser can open**: CORS `*` on the playlist *and* on its segments, and no auth or session token. Otherwise keep the camera on its still.
7. **Stay well under 12 s per region.** Fan out with bounded concurrency (IBI uses 10).
8. **Register a fetcher under one region only.** The GET handler concatenates regions without deduping.
9. **Region keys must match `^[a-z-]+$`.** The client's retry logic (`camera-catalog.ts`) ignores any other key.
10. **Respect privacy.** No residential or home cameras, no credentialed URLs (`user:pass@`, `pwd=`), no RFC1918 hosts, no Opentopia or Insecam-style lists.

---

## 7. Tests (vitest, `src/app/api/cctv/<name>.test.ts`)

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
- **Loader tests with a mocked network.** Use `vi.mock('@/lib/stealthFetch', …)` (`ibi511.load.test.ts`) or `vi.stubGlobal('fetch', …)` (`texas.test.ts`). Use them when the loader has logic of its own: paging, short reads, owner exclusion.
- **Registry test:** `us-511.test.ts` checks that regions and prefixes are unique and that the bounds are sane.

```bash
npx vitest run src/app/api/cctv/<name>.test.ts                   # offline
RUN_LIVE_TESTS=1 npx vitest run src/app/api/cctv/<name>.test.ts  # hits the upstream
npm test                                                          # everything offline
```

`route.test.ts` › "serves an already-cached region without going upstream again" fails on `main`; that is known (TODO.md). With `OSIRIS_CCTV_SNAPSHOT=off`, tests write a stray file named `off` in the repo root. Don't commit it.

---

## 8. Verify end to end

```bash
npx tsc --noEmit
npx eslint src/app/api/cctv/<name>.ts src/app/api/cctv/<name>.test.ts src/app/api/cctv/route.ts
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
- **Placeholder images.** Alaska and Arizona serve the same 15,136-byte "no feed" PNG. Status checking is planned for after the DB migration.
- **"PNG" stills that are JPEG.** `public.carsprogram.org/*.flv.png` is labelled `image/jpeg` but is a PNG. Browsers sniff the format, so it renders fine.

---

## 10. Sources

### Recently added

| Region | Module | Source | Cameras | Media |
|---|---|---|---|---|
| `newyork` | `us-511.ts` → `cars511x.ts` | 511NY (NYSDOT), `api-511x-nysdot.carsprogram.org/cameras/map-features` | 1,743 of 2,716 rows | HLS (`*.nysdot.skyvdn.com`, CORS `*` on playlist and segments) + still (`public.carsprogram.org`) |
| `nyc` | `nyc.ts` | NYC DOT TMC, `webcams.nyctmc.org/api/cameras` | 982 | still JPG (`/api/cameras/<uuid>/image`, `no-store`) |

511NY also lists 969 NYC DOT cameras. 961 of them are the same uuids as the direct feed, so they are excluded there (`excludeOwners`). The 8 that appear only in 511NY look like cameras NYC TMC has retired. Four more NYSDOT rows are dropped by the bounds box: three are parked at (0,0) and one has lost its longitude's sign. About 115 NYSDOT/NYC DOT pairs sit within 30 m of each other, but they are different devices from different agencies, so all of them are kept.

### Leads, with tested endpoints (details in CCTV-handoff.md §2)

| Lead | Cameras | Notes |
|---|---|---|
| CDOT COtrip | ~1,035 | **One `x511()` line:** `api-511x-co.carsprogram.org` |
| MassDOT | ~309 | **One `cars()` line:** `mass511.com` |
| SCDOT / SDDOT / MDT | 789 / 713 / 464 | One shared Iteris loader: `{st}.cdn.iteris-atis.com/geojson/icons/metadata/icons.cameras.geojson` |
| FAA WeatherCams | ~3,549 | `weathercams.faa.gov/api/cameras`; the latest image needs one call per camera |
| Caltrans HLS upgrade | 1,964 | Read `streamingVideoURL` in the existing fetcher; drop `rtsp:` |
| Austin | ~1,005 | Socrata `data.austintexas.gov/resource/b4k4-adkb.json` |
| Ohio | ~1,091 | `itscameras.dot.state.oh.us` |
| VDOT, Houston TranStar, Bayern, Vegvesen, National Highways | — | Not probed yet |

### Known broken

- `us-central` (IDOT): the upstream now returns an empty object.
- The Kansas box's east edge (−94.5) lets in about 83 Missouri cameras.
- 48 reused ids (`nl-rws-*`, DGT, Live Traffic, OpenCCTV).
