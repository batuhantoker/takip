import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { createPool } from '@/lib/fetch-pool';

/**
 * TAKIP — West Virginia DOT cameras (133 listed, ~114 playing): wv511.org's map list, no key. Live HLS only, no stills.
 * The list has no stream host, so each camera's player page is read for it.
 * Terms: the WV.gov disclaimer only; no licence stated.
 */

const BASE = 'https://wv511.org';
// gmap.asmx also exposes strSQL* operations; never call them.
const LIST = `${BASE}/wsvc/gmap.asmx/buildCamerasJSONjs`;
const PLAYER = `${BASE}/flowplayeri.aspx?CAMID=`;
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const WV511_BOUNDS: Bounds = { minLat: 37.15, maxLat: 40.7, minLng: -82.7, maxLng: -77.7 };

const CAM_ID = /^CAM\d+$/;
// An unknown CAMID still gets a page, pointing at a dead default host (sfs1), so only vtcN counts.
const PLAYLIST = /https:\/\/vtc\d+\.roadsummary\.com\/rtplive\/(CAM\d+)\/playlist\.m3u8/;

export interface Wv511Row {
  /** The native id, `CAMnnn`. */
  md5?: string | null;
  title?: string | null;
  /** HTML; the label is in `<div id="camDescription">`. */
  description?: string | null;
  start_lat?: string | number | null;
  start_lng?: string | number | null;
}

/** The bracketed county codes seen in the list, each checked against its cameras' locations. */
const COUNTIES: Record<string, string> = {
  BER: 'Berkeley', BOO: 'Boone', BRA: 'Braxton', CAB: 'Cabell', FAY: 'Fayette', GRA: 'Grant',
  GRE: 'Greenbrier', HAR: 'Harrison', JAC: 'Jackson', JEF: 'Jefferson', KAN: 'Kanawha', LEW: 'Lewis',
  LOG: 'Logan', MAR: 'Marion', MER: 'Mercer', MIN: 'Mineral', MON: 'Monongalia', OHI: 'Ohio',
  PRE: 'Preston', PUT: 'Putnam', RAL: 'Raleigh', TUC: 'Tucker', WEZ: 'Wetzel', WOO: 'Wood',
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

/** The `{…}` starting at `start`, matched brace for brace outside JSON strings. */
function objectAt(src: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

/** The list is a script: `var camera_data = { "count": 133, "cams": [...] }` after other `var`s. */
export function parseCameraData(js: string): { count: number; cams: Wv511Row[] } {
  const m = /\bvar\s+camera_data\s*=\s*/.exec(js);
  const body = m && js[m.index + m[0].length] === '{' ? objectAt(js, m.index + m[0].length) : null;
  if (!body) throw new Error('WV511 cameras: no camera_data object in response');

  const data = JSON.parse(body) as { count?: unknown; cams?: unknown };
  if (!Array.isArray(data?.cams)) throw new Error('WV511 cameras: no cams in camera_data');
  const count = typeof data.count === 'number' && Number.isFinite(data.count) ? data.count : data.cams.length;
  return { count, cams: data.cams as Wv511Row[] };
}

/** The HLS playlist named in a flowplayeri.aspx page, or null. */
export function parseStreamUrl(html: string | null | undefined): string | null {
  return html?.match(PLAYLIST)?.[0] ?? null;
}

/**
 * The label and county in a camDescription:
 *   `[BER]I-81 @ 0.5`            → `I-81 @ MM 0.5`, Berkeley County
 *   `[MON]I-79 @ .3 I-68 I/C - A` → `I-79 @ MM 0.3 I-68 I/C - A`, Monongalia County
 *   `[KAN]US-119@Jefferson Rd`    → `US-119 @ Jefferson Rd`, Kanawha County
 */
export function describeCamera(html: string | null | undefined): { name: string | null; county: string | null } {
  const div = html?.match(/<div\s+id=["']?camDescription["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (!div) return { name: null, county: null };

  const text = div[1]
    .replace(/<span\b[^>]*>[\s\S]*?<\/span>/gi, ' ') // the agency, "West Virginia DOT"
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim();

  const code = text.match(/^\[([A-Z]{3})\]\s*/);
  const name = (code ? text.slice(code[0].length) : text)
    .replace(/\s*@\s*/g, ' @ ')
    .replace(/@ (\d*\.?\d+)(?= |$)/, (_, mm: string) => `@ MM ${mm.startsWith('.') ? `0${mm}` : mm}`)
    .trim();
  const county = code && Object.hasOwn(COUNTIES, code[1]) ? `${COUNTIES[code[1]]} County` : null;
  return { name: name || null, county };
}

export function mapWv511Camera(r: Wv511Row | null | undefined, streamUrl: string | null | undefined): CctvCamera | null {
  const id = r?.md5?.trim();
  if (!id || !CAM_ID.test(id)) return null;

  const stream = streamUrl?.match(PLAYLIST);
  if (!stream || stream[0] !== streamUrl || stream[1] !== id) return null;

  const lat = Number(r?.start_lat);
  const lng = Number(r?.start_lng);
  const b = WV511_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const { name, county } = describeCamera(r?.description);
  return {
    id: `wvdot-${id}`,
    lat,
    lng,
    name: name || r?.title?.replace(/\s+/g, ' ').trim() || `WVDOT Camera ${id}`,
    city: county || 'West Virginia',
    country: 'US',
    stream_url: stream[0],
    stream_type: 'hls',
    source: 'WVDOT',
  };
}

async function fetchStreamUrl(id: string): Promise<string | null> {
  const res = await fetch(`${PLAYER}${id}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) {
    void res.body?.cancel();
    return null;
  }
  return parseStreamUrl(await res.text());
}

export async function fetchWv511Cameras(): Promise<CctvCamera[]> {
  const res = await fetch(LIST, {
    headers: { 'User-Agent': UA, Accept: 'application/javascript, */*' },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`WV511 cameras HTTP ${res.status}`);

  const { count, cams } = parseCameraData(await res.text());
  if (cams.length < count) throw new Error(`WV511 cameras: short list, ${cams.length} of ${count}`);

  const rows = new Map<string, Wv511Row>();
  for (const row of cams) {
    const id = row?.md5?.trim();
    if (id && CAM_ID.test(id) && !rows.has(id)) rows.set(id, row);
  }
  if (!rows.size) throw new Error('WV511 cameras: no cameras listed');

  const pool = createPool(10);
  const ids = [...rows.keys()];
  const streams = await Promise.all(ids.map(id => pool.run(() => fetchStreamUrl(id).catch(() => null))));
  const resolved = streams.filter(Boolean).length;
  if (resolved < rows.size * 0.8) throw new Error(`WV511 cameras: short read, ${resolved} of ${rows.size} stream hosts`);

  const out: CctvCamera[] = [];
  ids.forEach((id, i) => {
    const cam = mapWv511Camera(rows.get(id), streams[i]);
    if (cam) out.push(cam);
  });
  console.log(`[TAKIP] West Virginia cameras — WVDOT: ${out.length} of ${rows.size}`);
  return out;
}
