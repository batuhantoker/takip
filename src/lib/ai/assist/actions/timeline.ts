/** timeline: driving Replay (the recorded last days) and History (the past by year) from the conversation. */
import type { Outcome, Site } from '../tools';
import { fail, numIn, ok, str } from './shared';

const UNIT_MS: Record<string, number> = { m: 60_000, min: 60_000, minute: 60_000, h: 3_600_000, hour: 3_600_000, d: 86_400_000, day: 86_400_000, w: 604_800_000, week: 604_800_000 };

/** "2 hours ago", "-90m", an ISO time, or epoch ms, as epoch ms. */
export function replayTime(v: unknown, now = Date.now()): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v > 1e11 ? v : null;
  const s = str(v, 60).toLowerCase();
  if (!s) return null;
  const rel = /^-?\s*(\d+(?:\.\d+)?)\s*(m|min|minutes?|h|hours?|d|days?|w|weeks?)(?:\s+ago)?$/.exec(s);
  if (rel) return now - Number(rel[1]) * UNIT_MS[rel[2].replace(/s$/, '')];
  if (s === 'yesterday') return now - 86_400_000;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** A year ("1914", "-500", "500 BC") or a date, as epoch ms. */
export function historyTime(v: unknown): number | null {
  const s = str(v, 40).trim();
  const bc = /^(\d{1,5})\s*(bc|bce)$/i.exec(s);
  const year = bc ? -Number(bc[1]) + 1 : /^-?\d{1,5}$/.test(s) ? Number(s) : typeof v === 'number' && Number.isInteger(v) ? v : null;
  if (year !== null) {
    const d = new Date(0);
    d.setUTCFullYear(year, 6, 1);
    return d.getTime();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export async function timeline(a: Record<string, unknown>, site: Site): Promise<Outcome> {
  if (!site.timeline) return fail('timeline', 'Replay and History cannot be driven from here');
  const mode = a.mode === 'replay' || a.mode === 'history' || a.mode === 'live' ? a.mode : null;
  if (!mode) return fail('timeline', 'Say mode: "replay" (the recorded last days), "history" (the past by year) or "live"');
  let at: number | undefined;
  if (a.at !== undefined && a.at !== null && a.at !== '') {
    const t = mode === 'history' ? historyTime(a.at) : replayTime(a.at);
    if (t === null) return fail('timeline', mode === 'history' ? `"${str(a.at)}" is not a year or a date` : `"${str(a.at)}" is not a time: use ISO or "2 hours ago"`);
    if (mode === 'replay' && t > Date.now()) return fail('timeline', 'Replay shows the past; that time is still to come');
    at = t;
  }
  const out = await site.timeline({ mode, at, play: typeof a.play === 'boolean' ? a.play : undefined, speed: numIn(a.speed, 1, 100_000) ?? undefined });
  return out.ok ? ok('timeline', out.summary) : fail('timeline', out.error);
}
