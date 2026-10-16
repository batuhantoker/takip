/*
 * Precipitation radar from RainViewer: about two hours of past frames, one every 10 minutes, where
 * ground radar exists. The map shows the newest, loops them, or shows the one at Replay's time.
 */

export const RADAR_ATTRIBUTION = '<a href="https://www.rainviewer.com/" target="_blank" rel="noopener">Radar © RainViewer</a>';
/**
 * RainViewer allows 500 tile requests a minute per address and answers more with a 429 the browser can't
 * read, so the radar asks for 512 px tiles: a quarter of the requests. Tiles are cached for two days, so
 * only a loop's first pass over its 13 frames costs requests.
 */
export const RADAR_TILE_SIZE = 512;
/** RainViewer's free tiles stop at z7 (at either size) and answer deeper zooms with a placeholder image. */
export const RADAR_MAX_ZOOM = 7;
/** A frame stands for the 10 minutes after it. */
const FRAME_SPAN_MS = 10 * 60_000;

export interface RadarFrame {
  /** Epoch ms of the scan. */
  time: number;
  /** XYZ tile template. */
  tiles: string;
}

/** The past frames, oldest first; RainViewer's nowcast frames are a forecast and are left out. */
export function parseRadarFrames(body: unknown): RadarFrame[] {
  const b = body as { host?: string; radar?: { past?: { time?: number; path?: string }[] } } | null;
  if (!b?.host || !Array.isArray(b.radar?.past)) return [];
  return b.radar.past
    .filter(f => Number.isFinite(f.time) && f.path)
    // Colour scheme 2 (universal blue), smoothed, snow shown.
    .map(f => ({ time: f.time! * 1000, tiles: `${b.host}${f.path}/${RADAR_TILE_SIZE}/{z}/{x}/{y}/2/1_1.png` }))
    .sort((a, c) => a.time - c.time);
}

export async function radarFrames(signal?: AbortSignal): Promise<RadarFrame[]> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal, cache: 'no-store' });
  return res.ok ? parseRadarFrames(await res.json()) : [];
}

/** The frame covering time `t`; null before the first or long after the last. */
export function radarFrameAt(frames: RadarFrame[], t: number): RadarFrame | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].time <= t) return t - frames[i].time <= FRAME_SPAN_MS ? frames[i] : null;
  }
  return null;
}

/* What the radar layer is showing, for its control in the layer list. */

export type RadarMode = 'live' | 'loop' | 'replay';
export interface RadarState {
  /** Asked for by the person; Replay overrides it while open. */
  looping: boolean;
  mode: RadarMode;
  /** The scan time on the map, or null when there is no frame for Replay's time. */
  frameTime: number | null;
  /** The span of frames on offer. */
  from: number | null;
  to: number | null;
}

let state: RadarState = { looping: false, mode: 'live', frameTime: null, from: null, to: null };
const listeners = new Set<() => void>();

export const radarState = () => state;
export function subscribeRadar(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setRadarState(patch: Partial<RadarState>) {
  const next = { ...state, ...patch };
  if ((Object.keys(next) as (keyof RadarState)[]).every(k => next[k] === state[k])) return;
  state = next;
  listeners.forEach(l => l());
}
export const setRadarLooping = (looping: boolean) => setRadarState({ looping });
