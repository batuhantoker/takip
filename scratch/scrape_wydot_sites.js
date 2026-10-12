/**
 * TAKIP — coordinates for WYDOT camera sites (throwaway, like scrape_openwebcamdb.js).
 *
 * wyoroad.info lists every camera site with its route and milepost but no
 * coordinates. The 511 map's own camera feed hides its URL on purpose, so it is
 * not used. Instead, each site is placed on WYDOT's public tenth-mile milepost
 * layer (ArcGIS). Off the interstates, the WYDOT route is the one whose milepost
 * fits the route page's location text ("6.9 miles east of Evanston", against
 * Census place centroids), preferring the route RWIS names for that highway, or
 * else the route neighbouring sites use. Sites that are RWIS stations take
 * WYDOT's surveyed RWIS position instead. Sites with no usable reference stay out.
 *
 *   node scratch/scrape_wydot_sites.js   -> ../src/lib/cctv/generated/wydot-sites.generated.ts
 *
 * Mileposts don't move. Rerun when wydot.ts logs sites it can't place.
 */

const fs = require('fs');
const path = require('path');

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const WYO = 'https://www.wyoroad.info';
const AGOL = 'https://services2.arcgis.com/WI04Bd6haCzitbuQ/arcgis/rest/services';
const MILEPOSTS = `${AGOL}/COPY_2020mileposts_10thsZIP/FeatureServer/0/query`;
const RWIS = `${AGOL}/RWIS/FeatureServer/0/query`;
const PLACES = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_gaz_place_56.txt';
const ROUTE_PAGES = ['I25Cameras', 'I80Cameras', 'I90Cameras', 'NonInterstateCameras'];
const INTERSTATE_ML = { I25: 'ML25B', I80: 'ML80B', I90: 'ML90B' };
const OUT = path.join(__dirname, '..', 'src', 'lib', 'cctv', 'generated', 'wydot-sites.generated.ts');
const WORKERS = 4;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, accept = 'text/html') {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 2) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

async function arcgis(url, params) {
  const json = JSON.parse(await get(`${url}?${new URLSearchParams({ f: 'json', ...params })}`, 'application/json'));
  if (json.error) throw new Error(`ArcGIS: ${JSON.stringify(json.error)}`);
  return json.features.map(f => f.attributes);
}

const unescape = s => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = s => unescape(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const quote = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const mpKey = mp => Number(mp).toFixed(2);
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function km(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** WRR.Cameras: one row per site, with the nearest town the route pages lack. */
async function statewideRows() {
  const html = await get(`${WYO}/pls/Browse/WRR.Cameras`);
  return html.split(/<tr>\s*<td class="swroute">/).slice(1).map(row => {
    const cell = cls => text(row.match(new RegExp(`class="${cls}">([\\s\\S]*?)</td>`))?.[1] ?? '').replace(/^[^:]*:\s*/, '');
    return {
      route: unescape(row.slice(0, row.indexOf('</td>')).trim()),
      town: cell('swlocation'),
      name: cell('swdescription'),
      mp: mpKey(cell('swmilepost')),
    };
  });
}

/** The four route pages carry each site's slug (`view?site=I80Summit`) and its milepost. */
async function routePageSites() {
  const sites = [];
  for (const page of ROUTE_PAGES) {
    const html = (await get(`${WYO}/Highway/webcameras/all?route=${page}`)).split('<td class="content">')[1] ?? '';
    const re = /<tr>\s*(?:<td>\s*([^<]+?)\s*<\/td>\s*)?<td>\s*<a href="\/highway\/webcameras\/view\?site=([^"]+)">([^<]*)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>/g;
    for (const m of html.matchAll(re)) {
      const mm = text(m[4]).match(/mm\s*([\d.]+)/)?.[1];
      sites.push({ route: unescape(m[1] ?? page.slice(0, 3)), slug: m[2], name: unescape(m[3]).trim(), mp: mm ? mpKey(mm) : null, loc: text(m[4]) });
    }
  }
  return sites;
}

async function townCentroids() {
  const towns = new Map();
  for (const line of (await get(PLACES, 'text/plain')).split('\n').slice(1)) {
    const cols = line.split('\t');
    if (cols.length < 12) continue;
    towns.set(norm(cols[3].replace(/ (city|town|CDP)$/, '')), { lat: Number(cols[10]), lng: Number(cols[11]) });
  }
  return towns;
}

/** One point per WYDOT route that passes this milepost, interpolated between the tenths either side. */
async function candidates(site) {
  const ml = INTERSTATE_ML[site.route];
  const mp = Number(site.mp);
  const where = [
    `CATEGORY='ML'`, `DIRECTION='B'`, `MILEPOST>=${(mp - 0.101).toFixed(3)}`, `MILEPOST<=${(mp + 0.101).toFixed(3)}`,
    ml ? `ROUTE='${ml}'` : null,
  ].filter(Boolean).join(' AND ');
  const rows = await arcgis(MILEPOSTS, { where, outFields: 'ROUTE,MILEPOST,LATITUDE,LONGITUDE', returnGeometry: 'false', resultRecordCount: '2000' });
  const byRoute = new Map();
  for (const r of rows) byRoute.set(r.ROUTE, [...(byRoute.get(r.ROUTE) ?? []), r]);
  return [...byRoute].map(([route, pts]) => {
    pts.sort((a, b) => a.MILEPOST - b.MILEPOST);
    const lo = pts.filter(p => p.MILEPOST <= mp + 1e-6).pop();
    const hi = pts.find(p => p.MILEPOST >= mp - 1e-6);
    const [a, b] = lo && hi ? [lo, hi] : [lo ?? hi, lo ?? hi];
    const t = b.MILEPOST === a.MILEPOST ? 0 : (mp - a.MILEPOST) / (b.MILEPOST - a.MILEPOST);
    return { route, lat: a.LATITUDE + t * (b.LATITUDE - a.LATITUDE), lng: a.LONGITUDE + t * (b.LONGITUDE - a.LONGITUDE) };
  });
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      await sleep(150);
    }
  }));
  return out;
}

/** "US 20/26" and "US20/US26" both become ['US20', 'US26']. */
function highways(route) {
  const out = [];
  let prefix = '';
  for (const part of String(route).toUpperCase().replace(/WYO/g, 'WY').split('/')) {
    const m = part.replace(/[\s-]/g, '').match(/^([A-Z]*)(\d+[A-Z]?)$/);
    if (!m) continue;
    prefix = m[1] || prefix;
    out.push(prefix + m[2]);
  }
  return out;
}

const BEARINGS = {
  north: [1, 0], south: [-1, 0], east: [0, 1], west: [0, -1],
  northeast: [0.707, 0.707], northwest: [0.707, -0.707], southeast: [-0.707, 0.707], southwest: [-0.707, -0.707],
};

function place(name, towns) {
  const n = name.replace(/\s+city limits$/i, '').trim();
  return towns.get(norm(n)) ?? towns.get(norm(n.replace(/\s+city$/i, '')));
}

/** Where the route page says the site is: "6.9 miles east of Evanston", "Inside Laramie city limits", "Near Moneta". */
function reference(site, towns) {
  const loc = site.loc ?? '';
  const off = loc.match(/^([\d.]+) miles? (north|south|east|west|northeast|northwest|southeast|southwest) of (?:the )?(.+?) \(mm/i);
  if (off) {
    const p = place(off[3], towns);
    if (p) {
      const d = Number(off[1]) * 1.609;
      const [n, e] = BEARINGS[off[2].toLowerCase()];
      return { lat: p.lat + (d * n) / 111.2, lng: p.lng + (d * e) / (111.2 * Math.cos((p.lat * Math.PI) / 180)), tol: Math.max(8, d * 0.7), kind: 'offset' };
    }
  }
  const at = loc.match(/^(?:Inside|Near|North of|South of|East of|West of|.*\bnear) (?:the )?(.+?) \(mm/i);
  const p = at && place(at[1], towns);
  if (p) return { ...p, tol: 12, kind: 'place' };
  const town = towns.get(norm(site.town));
  return town ? { ...town, tol: 80, kind: 'town' } : null;
}

/** RWIS stations carry surveyed coordinates and the WYDOT route id (`RID`) and milepost (`RM`) they sit on. */
async function rwisStations() {
  const json = JSON.parse(await get(`${RWIS}?${new URLSearchParams({ f: 'json', where: '1=1', outFields: 'SiteName,RID,RM,Route', outSR: '4326' })}`, 'application/json'));
  if (json.error) throw new Error(`ArcGIS: ${JSON.stringify(json.error)}`);
  return json.features.map(f => ({
    name: f.attributes.SiteName, ml: f.attributes.RID.replace(/[A-Z]$/, 'B'), rm: f.attributes.RM, lat: f.geometry.y, lng: f.geometry.x,
    signed: highways(f.attributes.Route),
  }));
}

async function main() {
  const [rows, pages, towns, rwis] = [await statewideRows(), await routePageSites(), await townCentroids(), await rwisStations()];
  console.log(`statewide rows ${rows.length}, route-page sites ${pages.length}, towns ${towns.size}, RWIS stations ${rwis.length}`);

  const sites = [];
  for (const row of rows) {
    const page = pages.find(p => p.route === row.route && p.mp === row.mp)
      ?? pages.find(p => norm(p.name) === norm(row.name) && Math.abs(Number(p.mp) - Number(row.mp)) < 1);
    if (!page) { console.warn(`no slug for ${row.route} ${row.mp} ${row.name}`); continue; }
    sites.push({ ...row, slug: page.slug, loc: page.loc });
  }

  const cands = await pool(sites, candidates);
  sites.forEach((s, i) => { s.cands = cands[i]; s.ref = reference(s, towns); });

  for (const s of sites) {
    const st = rwis.find(r => norm(r.name) === norm(s.name) && Math.abs(r.rm - Number(s.mp)) <= 1.5);
    // A station 0.3+ miles off the camera's milepost only tells us the route; place the camera on it.
    const onRoute = st && s.cands.find(c => c.route === st.ml);
    if (st && (Math.abs(st.rm - Number(s.mp)) <= 0.3 || !onRoute)) { s.pick = { lat: st.lat, lng: st.lng, route: st.ml, how: 'rwis' }; continue; }
    if (onRoute) { s.pick = { ...onRoute, how: 'rwis-route' }; continue; }
    const fixed = INTERSTATE_ML[s.route];
    const signed = highways(s.route);
    const prior = new Set(rwis.filter(r => r.signed.some(h => signed.includes(h))).map(r => r.ml));
    if (fixed && s.cands.some(c => c.route === fixed)) { s.pick = { ...s.cands.find(c => c.route === fixed), how: 'interstate' }; continue; }
    if (!s.ref || !s.cands.length) continue;
    // Routes numbered 1000+ are mostly county and local roads: near a bare town they are noise, so only a precise reference may land on one.
    const precise = s.ref.kind !== 'town';
    const cands = precise ? s.cands : s.cands.filter(c => Number(c.route.slice(2, -1)) < 1000 || prior.has(c.route));
    const ranked = cands.map(c => ({ ...c, d: km(c, s.ref) })).filter(c => c.d <= s.ref.tol).sort((a, b) => a.d - b.d);
    // RWIS names the WYDOT route each signed highway runs on; prefer it when it fits the location text.
    const preferred = ranked.find(c => prior.has(c.route));
    const [best, next] = ranked;
    const clear = best && (!next || next.d >= Math.min(best.d * 1.8, best.d + 5) || km(best, next) < 3);
    if (preferred) s.pick = { ...preferred, how: 'reference' };
    else if (precise && clear) s.pick = { ...best, how: 'reference' };
  }

  // No usable reference: borrow the WYDOT route that placed neighbours on the same highway use near this milepost.
  for (const s of sites.filter(x => !x.pick)) {
    const near = sites
      .filter(o => o.pick && o.pick.how !== 'neighbour' && o.route === s.route && Math.abs(Number(o.mp) - Number(s.mp)) <= 60)
      .sort((a, b) => Math.abs(Number(a.mp) - Number(s.mp)) - Math.abs(Number(b.mp) - Number(s.mp)));
    const c = near.map(o => s.cands.find(c => c.route === o.pick.route)).find(Boolean);
    if (c) s.pick = { ...c, how: 'neighbour' };
  }

  // Two sites on one WYDOT route can't be farther apart than the road between their mileposts; drop the guessed one.
  const trusted = s => ['rwis', 'rwis-route', 'interstate'].includes(s.pick.how);
  for (const a of sites.filter(x => x.pick)) {
    for (const b of sites.filter(x => x.pick && x !== a && x.route === a.route && x.pick.route === a.pick.route)) {
      if (!a.pick || !b.pick || km(a.pick, b.pick) <= 1.609 * Math.abs(Number(a.mp) - Number(b.mp)) + 1) continue;
      console.warn(`  inconsistent: ${a.route} ${a.pick.route} mm ${a.mp} ${a.name} (${a.pick.how}) vs mm ${b.mp} ${b.name} (${b.pick.how}): ${km(a.pick, b.pick).toFixed(1)} km apart`);
      for (const x of [a, b]) if (!trusted(x)) x.pick = null;
    }
  }

  const placed = sites.filter(s => s.pick);
  const unplaced = sites.filter(s => !s.pick);
  const how = k => placed.filter(s => s.pick.how === k).length;
  console.log(`placed ${placed.length}/${sites.length}: ${how('rwis')} RWIS, ${how('rwis-route')} on an RWIS station's route, ${how('interstate')} interstate, ${how('reference')} by location text, ${how('neighbour')} via neighbours`);
  for (const s of placed.filter(p => p.pick.how === 'reference' || p.pick.how === 'neighbour')) {
    console.log(`  ${s.pick.how.padEnd(9)} ${s.pick.route.padEnd(8)} ${s.ref ? km(s.pick, s.ref).toFixed(1).padStart(5) : '    ?'} km  ${s.route} mm ${s.mp} ${s.name}: "${s.loc}"`);
  }
  for (const s of unplaced) {
    const top = s.ref ? s.cands.map(c => ({ ...c, d: km(c, s.ref) })).sort((a, b) => a.d - b.d).slice(0, 3).map(c => `${c.route} ${c.d.toFixed(1)}km`).join(', ') : 'no reference';
    console.warn(`  unplaced: ${s.route} mm ${s.mp} ${s.name} [${s.ref?.kind ?? '-'} tol ${s.ref?.tol.toFixed(0) ?? '-'}]: ${top}; "${s.loc}"`);
  }

  // A milepost placement next to an RWIS station on the same highway checks the route choice.
  const checks = [];
  for (const s of placed.filter(p => p.pick.how !== 'rwis')) {
    const st = rwis.find(r => r.ml === s.pick.route && Math.abs(r.rm - Number(s.mp)) <= 0.3);
    if (st) checks.push({ name: `${s.name} / ${st.name}`, d: km(s.pick, st) });
  }
  checks.sort((a, b) => a.d - b.d);
  const med = checks.length ? checks[Math.floor(checks.length / 2)].d : NaN;
  console.log(`milepost check vs nearby RWIS: ${checks.length} pairs, median ${(med * 1000).toFixed(0)} m, max ${((checks.at(-1)?.d ?? 0) * 1000).toFixed(0)} m`);
  for (const s of placed.filter(p => p.pick.how !== 'interstate' && p.ref && p.ref.kind !== 'town' && km(p.pick, p.ref) > p.ref.tol)) {
    console.warn(`  off its location text by ${km(s.pick, s.ref).toFixed(1)} km (${s.pick.how}): ${s.route} mm ${s.mp} ${s.name}: "${s.loc}"`);
  }

  const lines = placed
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(s => `  ${quote(`${s.route}|${s.mp}`)}: { slug: ${quote(s.slug)}, lat: ${s.pick.lat.toFixed(5)}, lng: ${s.pick.lng.toFixed(5)} },`);
  fs.writeFileSync(OUT, `/**
 * TAKIP — WYDOT camera sites placed by route and milepost (GENERATED by scratch/scrape_wydot_sites.js).
 *
 * wyoroad.info's camera list has no coordinates. ${placed.filter(s => s.pick.how === 'rwis').length} sites are RWIS stations and use
 * WYDOT's surveyed RWIS position; the rest sit on WYDOT's tenth-mile milepost layer.
 */

export interface WydotSite { slug: string; lat: number; lng: number }

/** Keyed by \`<route>|<milepost to 2 dp>\`, as wyoroad.info's statewide list prints them. */
export const WYDOT_SITES: Record<string, WydotSite> = {
${lines.join('\n')}
};
`);
  console.log(`wrote ${placed.length} sites to ${path.relative(process.cwd(), OUT)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
