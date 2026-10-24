import { readdirSync, readFileSync, statSync } from 'fs';
import { historyDir, historyFile } from '@/lib/space/replay/flight-files';
import { flightEnded, type CraftHistory, type HistoryEvent } from '@/lib/space/replay/flight-history';
import { SKY_BODIES, type SkyKey } from '@/lib/space/sky';

/**
 * TAKIP — the flights the space view has fetched for replay, as the public pages list them: launch, flybys,
 * arrivals, landings and crossings. Read from the files the history route keeps, never fetched from JPL here,
 * so a page for a craft nobody has replayed just has no timeline. Only the steps are held, not the tracks.
 */

export type FlightStep =
  | { kind: 'launch'; jd: number; pad: string | null; vehicle: string | null }
  | { kind: 'flyby'; jd: number; body: SkyKey; km: number }
  | { kind: 'arrival' | 'landing'; jd: number; body: SkyKey }
  | { kind: 'crossing'; jd: number; shell: 'heliopause' | 'termination-shock'; au: number }
  | { kind: 'begins' | 'ends'; jd: number };

export interface FlightSummary {
  id: number;
  name: string;
  /** Past this the steps are JPL's prediction. */
  fetchedJd: number;
  ended: boolean;
  steps: FlightStep[];
}

const BODY_BY_NAME = new Map(SKY_BODIES.map(b => [b.name.toLowerCase(), b.key]));
const LIST_MS = 10 * 60_000;

const body = (name: string) => BODY_BY_NAME.get(name.replace(/^the /i, '').toLowerCase()) ?? null;
const number = (s: string) => Number(s.replace(/,/g, ''));

/** The history's labels are English sentences built in history/collect.ts; this reads them back. */
export function flightStep(e: HistoryEvent, h: Pick<CraftHistory, 'launch'>): FlightStep | null {
  if (e.kind === 'launch') {
    if (e.label === 'Ephemeris begins') return { kind: 'begins', jd: e.jd };
    return { kind: 'launch', jd: h.launch?.jd ?? e.jd, pad: h.launch?.pad ?? null, vehicle: h.launch?.vehicle ?? null };
  }
  if (e.kind === 'end') return { kind: 'ends', jd: e.jd };
  let m: RegExpExecArray | null;
  if (e.kind === 'flyby' && (m = /^(.+) flyby · ([\d,]+) km$/.exec(e.label))) {
    const key = body(m[1]);
    return key ? { kind: 'flyby', jd: e.jd, body: key, km: number(m[2]) } : null;
  }
  if (e.kind === 'arrival' && (m = /^Arrives at (.+)$/.exec(e.label))) {
    const key = body(m[1]);
    return key ? { kind: 'arrival', jd: e.jd, body: key } : null;
  }
  if (e.kind === 'landing' && (m = /^Lands on (.+)$/.exec(e.label))) {
    const key = body(m[1]);
    return key ? { kind: 'landing', jd: e.jd, body: key } : null;
  }
  if (e.kind === 'crossing' && (m = /^Crosses the (heliopause|termination shock) · ([\d.]+) AU$/.exec(e.label))) {
    return { kind: 'crossing', jd: e.jd, shell: m[1] === 'heliopause' ? 'heliopause' : 'termination-shock', au: Number(m[2]) };
  }
  return null;
}

export function summarise(h: CraftHistory): FlightSummary {
  return {
    id: h.id,
    name: h.name,
    fetchedJd: h.fetchedJd,
    ended: flightEnded(h),
    steps: h.events.map(e => flightStep(e, h)).filter((s): s is FlightStep => s !== null).sort((a, b) => a.jd - b.jd),
  };
}

const held = new Map<number, { mtime: number; summary: FlightSummary | null }>();

export function flightSummary(id: number): FlightSummary | null {
  const file = historyFile(id);
  let mtime: number;
  try { mtime = statSync(file).mtimeMs; } catch { return null; }
  const hit = held.get(id);
  if (hit && hit.mtime === mtime) return hit.summary;
  let summary: FlightSummary | null = null;
  try { summary = summarise(JSON.parse(readFileSync(file, 'utf8')) as CraftHistory); } catch { /* a file mid-rename */ }
  held.set(id, { mtime, summary });
  return summary;
}

let list: { at: number; ids: number[] } = { at: 0, ids: [] };

/** Every stored flight; the directory is listed at most every ten minutes. */
export function allFlights(): FlightSummary[] {
  if (Date.now() - list.at > LIST_MS) {
    let ids: number[] = [];
    try {
      ids = readdirSync(historyDir()).map(f => /^(-\d+)\.json$/.exec(f)?.[1]).filter((s): s is string => !!s).map(Number);
    } catch { /* no flights fetched on this server yet */ }
    list = { at: Date.now(), ids };
  }
  return list.ids.map(flightSummary).filter((f): f is FlightSummary => f !== null);
}
