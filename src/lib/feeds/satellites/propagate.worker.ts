/**
 * TAKIP — satellite keyframes off the main thread: SGP4 for every shown satellite at one instant.
 *
 * Messages in: { type: 'set', tles } (each satellite's two TLE lines) and { type: 'at', id, t } (epoch ms).
 * Messages out: { id, t, at }, `at` laid out as motion.ts's keyframes.
 */

import { gstime, type SatRec } from 'satellite.js';
import { KEY_STRIDE, withinReach, writeKey } from './motion';
import { parseTLE, propagateSatrec } from './orbit';

type Request = { type: 'set'; tles: [string, string][] } | { type: 'at'; id: number; t: number };
type Sat = { rec: SatRec; epochMs: number; periodMinutes: number } | null;

// The DOM typings describe a window; this file runs in a worker.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const toSat = (line1: string, line2: string): Sat => {
  const rec = parseTLE(line1, line2);
  // jdsatepoch is the element set's epoch as a Julian date; `no` its mean motion in radians a minute.
  return rec && { rec, epochMs: (rec.jdsatepoch - 2440587.5) * 86_400_000, periodMinutes: (2 * Math.PI) / rec.no };
};

// Kept across sets by TLE: a layer toggle re-sends mostly the same satellites.
let parsed = new Map<string, Sat>();
let sats: Sat[] = [];

scope.onmessage = ({ data }) => {
  if (data.type === 'set') {
    const next = new Map<string, Sat>();
    sats = data.tles.map(([line1, line2]) => {
      const key = `${line1}\n${line2}`;
      const sat = parsed.has(key) ? parsed.get(key)! : toSat(line1, line2);
      next.set(key, sat);
      return sat;
    });
    parsed = next;
    return;
  }
  const when = new Date(data.t);
  const gmst = gstime(when);
  const at = new Float32Array(sats.length * KEY_STRIDE).fill(Number.NaN);
  for (let i = 0; i < sats.length; i++) {
    const sat = sats[i];
    if (!sat || !withinReach(sat.epochMs, sat.periodMinutes, data.t)) continue;
    const p = propagateSatrec(sat.rec, when, gmst);
    if (p) writeKey(at, i, p.lng, p.lat, p.altKm);
  }
  scope.postMessage({ id: data.id, t: data.t, at }, [at.buffer]);
};
