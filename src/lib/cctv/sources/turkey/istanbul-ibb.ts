import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { IBB_HLS_HOST, IBB_HLS_PATH, IBB_RELAY, fetchIbbHls } from './ibb-hls';

/**
 * TAKIP — İstanbul Metropolitan Municipality (İBB) traffic cameras (~650): the keyless list behind UYM's public
 * traffic map (uym.ibb.gov.tr/yharita6), each with a CORS-open HLS stream on hls.ibb.gov.tr.
 * Terms: pending — none published for this API; the UYM site reserves all rights to İBB Trafik Müdürlüğü.
 * Every CameraImage.ashx still in the list answers the same "no camera" placeholder, so only the stream is used.
 * Streams go through ./ibb-hls, since from outside Turkey most of the stream host's addresses refuse the connection.
 */

const API = 'https://tkmservices.ibb.gov.tr/web/api/IntensityMap/v1/Camera';
const MAP_PAGE = 'https://uym.ibb.gov.tr/yharita6/';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const PROBES_PER_SERVER = 3;
const PROBE_BUDGET_MS = 5_000;
export const ISTANBUL_IBB_BOUNDS: Bounds = { minLat: 40.7, maxLat: 41.4, minLng: 27.9, maxLng: 29.6 };

export interface IbbCamera {
  ID?: number | null;
  Name?: string | null;
  /** Longitude, as a string. */
  XCoord?: string | null;
  /** Latitude, as a string. */
  YCoord?: string | null;
  /** Empty for picture-only cameras. */
  VideoURL_SSL?: string | null;
  /** Further directions at the same junction, each its own camera. */
  Group?: IbbCamera[] | null;
}

export function mapIbbCamera(r: IbbCamera | null | undefined): CctvCamera | null {
  const id = r?.ID;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;

  const lat = Number(r?.YCoord);
  const lng = Number(r?.XCoord);
  const b = ISTANBUL_IBB_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let stream: URL;
  try {
    // A few rows end in a stray ';'; the URL without it plays.
    stream = new URL((r?.VideoURL_SSL ?? '').trim().replace(/;+$/, ''));
  } catch {
    return null;
  }
  if (stream.protocol !== 'https:' || !stream.pathname.endsWith('.m3u8')) return null;
  const path = stream.pathname.slice(1);
  const relayed = stream.hostname === IBB_HLS_HOST && IBB_HLS_PATH.test(path);

  return {
    id: `tr-ibb-${id}`,
    lat,
    lng,
    // Names are upper-case Turkish; case-folding the dotted İ garbles them.
    name: r?.Name?.replace(/\s+/g, ' ').trim() || `İBB Camera ${id}`,
    city: 'Istanbul',
    country: 'Turkey',
    stream_url: relayed ? IBB_RELAY + path : stream.href,
    stream_type: 'hls',
    external_url: MAP_PAGE,
    source: 'İBB',
  };
}

export function parseIbbCameras(rows: unknown): CctvCamera[] {
  if (!Array.isArray(rows)) throw new Error('İBB cameras: unexpected response');
  const seen = new Map<string, CctvCamera>();
  for (const row of rows as (IbbCamera | null)[]) {
    const group = Array.isArray(row?.Group) ? row.Group : [];
    for (const r of [row, ...group]) {
      const cam = mapIbbCamera(r);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  return [...seen.values()];
}

export async function fetchIstanbulIbbCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`İBB cameras HTTP ${res.status}`);

  const all = parseIbbCameras(await res.json());
  if (!all.length) throw new Error('İBB cameras: no playable cameras in the response');
  const down = await findDownServers(all);
  const cams = all.filter(c => !down.has(streamServer(c) ?? ''));
  const note = down.size ? ` (hiding ${all.length - cams.length} on ${[...down].join(', ')}, which answer 5xx)` : '';
  console.log(`[TAKIP] Istanbul cameras — İBB: ${cams.length}${note}`);
  return cams;
}

/** tkm2 for a relayed tkm2/hls/4.stream/playlist.m3u8; each tkm server fails on its own. */
function streamServer(cam: CctvCamera): string | null {
  const url = cam.stream_url ?? '';
  return url.startsWith(IBB_RELAY) ? url.slice(IBB_RELAY.length).split('/')[0] : null;
}

/** Servers whose sampled playlists answer only 5xx (tkm4, ~220 cameras, since 2026-10-12). */
export async function findDownServers(cams: CctvCamera[]): Promise<Set<string>> {
  const samples = new Map<string, string[]>();
  for (const cam of cams) {
    const server = streamServer(cam);
    if (!server) continue;
    const paths = samples.get(server) ?? [];
    if (paths.length < PROBES_PER_SERVER) samples.set(server, [...paths, cam.stream_url!.slice(IBB_RELAY.length)]);
  }

  const down = new Set<string>();
  // One at a time, so later probes reuse the first one's connection.
  const checks = (async () => {
    for (const [server, paths] of samples) {
      const statuses: number[] = [];
      for (const path of paths) {
        const status = await fetchIbbHls(path).then(r => r.status, () => 0);
        statuses.push(status);
        if (status > 0 && status < 500) break;
      }
      // 0 is no answer, which neither hides nor keeps a server.
      if (statuses.some(s => s >= 500) && !statuses.some(s => s > 0 && s < 500)) down.add(server);
    }
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>(resolve => { timer = setTimeout(resolve, PROBE_BUDGET_MS); });
  await Promise.race([checks, budget]);
  clearTimeout(timer);
  return new Set(down);
}
