import type { DecodedTrack } from '@takip/core/trk';

/*
 * Where a track is at a time. Segments are split at long silences and the antimeridian when they are
 * sealed, so interpolating inside one never bridges a gap (replay-database.md §8.3).
 */

export type Sample = { lon: number; lat: number; heading: number; speed?: number; /** Seconds since its last fix; 0 inside the track. */ age: number };

const rad = (d: number) => (d * Math.PI) / 180;

export function bearing(lon1: number, lat1: number, lon2: number, lat2: number) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const lerpAngle = (a: number, b: number, f: number) => (a + ((((b - a) % 360) + 540) % 360 - 180) * f + 360) % 360;

/** Index of the last fix at or before `t`, or -1. */
function indexAt(times: Float64Array, t: number) {
  let lo = 0;
  let hi = times.length - 1;
  if (t < times[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function headingAt(track: DecodedTrack, i: number) {
  if (track.heading) return track.heading[i];
  const j = i + 1 < track.n ? i : i - 1;
  return j >= 0 && j + 1 < track.n ? bearing(track.lon[j], track.lat[j], track.lon[j + 1], track.lat[j + 1]) : 0;
}

/** The position at `t` (epoch s), held at the last fix after the track ends; null before it starts. */
export function sampleAt(track: DecodedTrack, t: number): Sample | null {
  const i = indexAt(track.t, t);
  if (i < 0) return null;
  if (i === track.n - 1) {
    return { lon: track.lon[i], lat: track.lat[i], heading: headingAt(track, i), speed: track.speed?.[i], age: t - track.t[i] };
  }
  const f = (t - track.t[i]) / (track.t[i + 1] - track.t[i] || 1);
  return {
    lon: track.lon[i] + (track.lon[i + 1] - track.lon[i]) * f,
    lat: track.lat[i] + (track.lat[i + 1] - track.lat[i]) * f,
    heading: track.heading ? lerpAngle(track.heading[i], track.heading[i + 1], f) : bearing(track.lon[i], track.lat[i], track.lon[i + 1], track.lat[i + 1]),
    speed: track.speed ? track.speed[i] + (track.speed[i + 1] - track.speed[i]) * f : undefined,
    age: 0,
  };
}

/** The path over [t - trailS, t], ending at the sampled position. */
export function trailTo(track: DecodedTrack, t: number, trailS: number, here: Sample): [number, number][] {
  const coords: [number, number][] = [];
  const end = indexAt(track.t, t);
  for (let i = Math.max(0, indexAt(track.t, t - trailS)); i <= end; i++) {
    if (track.t[i] >= t - trailS) coords.push([track.lon[i], track.lat[i]]);
  }
  if (here.age === 0) coords.push([here.lon, here.lat]);
  return coords;
}
