// Builds data/traffic/ndw-sites.json: NDW's DATEX II v3 travel-time sites with lines that follow the road,
// from the Meetvakken shapefile (joined on the site id), and names from the v3 site table.
//   nice -n 10 npx tsx tools/traffic/build-ndw.ts
// Rerun when NDW publishes a new shapefile (its Version.txt). NDW stops publishing it on 2027-02-09; see docs/roadmap.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { encodeLine, lineLengthM, NDW_SITES_PATH, simplifyLine, type NdwSitesFile } from '../../src/lib/feeds/traffic/sources/ndw-sites';
import { openZip } from '../../src/lib/core/net/remote-zip';
import { TAKIP_USER_AGENT } from '../../src/lib/core/net/user-agent';
import { readShapefile } from '../import/shp';

const SHAPEFILE = 'https://opendata.ndw.nu/ndw_avg_meetlocaties_shapefile.zip';
const SITE_TABLE = 'https://opendata.ndw.nu/reistijden_configuratie_meetlocaties.xml.gz';
const CACHE = '.cache/traffic';
const SIMPLIFY_M = 2;
/** Route-level travel times run for tens of kilometres over the short segments they span. */
const MAX_LENGTH_M = 5_000;
/** A site missing from the shapefile keeps its v3 start–end chord only while that cannot cut a corner much. */
const MAX_CHORD_M = 300;

type Line = [number, number][];

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function parseSiteTable(xml: string): Map<string, { name: string; chord: Line }> {
  const sites = new Map<string, { name: string; chord: Line }>();
  for (const m of xml.matchAll(/<roa:measurementSite id="([^"]+)"[^>]*>([\s\S]*?)<\/roa:measurementSite>/g)) {
    const name = /<roa:measurementSiteName><com:values><com:value[^>]*>([^<]*)</.exec(m[2])?.[1] ?? '';
    const pos = /<loc:posList>([^<]*)</.exec(m[2])?.[1].trim().split(/\s+/).map(Number) ?? [];
    const chord: Line = [];
    for (let i = 0; i + 1 < pos.length; i += 2) chord.push([pos[i + 1], pos[i]]);
    sites.set(m[1], { name: unescape(name), chord });
  }
  return sites;
}

async function main() {
  console.log('site table…');
  const res = await fetch(SITE_TABLE, { headers: { 'User-Agent': TAKIP_USER_AGENT } });
  if (!res.ok) throw new Error(`site table HTTP ${res.status}`);
  const table = parseSiteTable(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8'));
  console.log(`  ${table.size} v3 sites`);

  console.log('shapefile…');
  const zip = await openZip(SHAPEFILE);
  const entry = async (name: string) => {
    const f = zip.find(name);
    if (!f) throw new Error(`${name} missing from the shapefile zip`);
    return zip.read(f);
  };
  const version = (await entry('Version.txt')).toString('utf8').trim();
  mkdirSync(CACHE, { recursive: true });
  for (const ext of ['shp', 'dbf']) writeFileSync(join(CACHE, `Meetvakken_WGS84.${ext}`), await entry(`Meetvakken_WGS84.${ext}`));
  const shaped = new Map<string, { line: Line; lengthM: number }>();
  for (const { geometry, props } of readShapefile(join(CACHE, 'Meetvakken_WGS84'))) {
    // The Meetvakken are single lines; a multi-part one would be joined end to end.
    const line = geometry?.type === 'LineString' ? geometry.coordinates : geometry?.type === 'MultiLineString' ? geometry.coordinates.flat() : null;
    if (props.dgl_loc && line?.length) shaped.set(props.dgl_loc, { line, lengthM: Number(props.lengte) || lineLengthM(line) });
  }
  console.log(`  ${shaped.size} shaped sites (version ${version})`);

  const out: NdwSitesFile = { version, built: new Date().toISOString(), sites: [] };
  const skipped = { long: 0, chord: 0 };
  for (const [id, { name, chord }] of table) {
    const shape = shaped.get(id);
    const line = shape?.line ?? chord;
    const lengthM = Math.round(shape?.lengthM ?? lineLengthM(chord));
    if (line.length < 2) continue;
    if (lengthM > MAX_LENGTH_M) { skipped.long++; continue; }
    if (!shape && chord.length === 2 && lengthM > MAX_CHORD_M) { skipped.chord++; continue; }
    out.sites.push([id, name, lengthM, encodeLine(simplifyLine(line, SIMPLIFY_M))]);
  }
  mkdirSync(dirname(NDW_SITES_PATH), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(NDW_SITES_PATH, json);
  console.log(`${out.sites.length} sites → ${NDW_SITES_PATH} (${(json.length / 1e6).toFixed(1)} MB); left out ${skipped.long} longer than ${MAX_LENGTH_M / 1000} km, ${skipped.chord} unshaped chords`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
