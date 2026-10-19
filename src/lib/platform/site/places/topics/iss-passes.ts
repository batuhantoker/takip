import { parseTLE } from '@/lib/feeds/satellites/orbit';
import { compassPoint, nextSkyPasses, type SkyPass } from '@/lib/feeds/satellites/pass';
import { ownApi } from '../../live/own-api';
import { SKY_RULES, issBestElevation } from './sky-rules';
import { localClock, nightOf, type LocalClock } from './sky-time';

/**
 * The space station's next passes over a place, in its local time, from the latest orbital elements.
 * Predicted, not observed: the times move when the station raises its orbit, which it does every few weeks.
 *
 * The cases, and what a page says for each (iss-copy.ts):
 * - unavailable / stale: no elements, or elements older than a week. No times are given rather than wrong ones.
 * - never: the orbit's geometry keeps it under 10° here (beyond about 64° of latitude). Say how high it gets.
 * - none: it does not climb above 10° in the next three days. Give the next visible pass if one is found.
 * - unseen: it passes, but each time in daylight or in Earth's shadow. Give the count and the next visible one.
 * - visible: the next visible pass (night, time, start direction, highest elevation, end direction), how many
 *   there are in three days, and the highest when it is not the next.
 */

export const ISS_NORAD = '25544';
export const ISS_WINDOW_HOURS = 72;
/** How far ahead to look for a visible pass when the window has none. Further out, reboosts make it a guess. */
export const ISS_LOOKAHEAD_DAYS = 10;
export const ISS_STALE_DAYS = 7;

export interface IssElements { line1: string; line2: string; epoch: number }

/** The element set's epoch in epoch ms, from line 1's YYDDD.DDDDDDDD. */
export function tleEpoch(line1: string): number | null {
  const m = /^1 .{16}(\d{2})(\d{3}\.\d+)/.exec(line1);
  if (!m) return null;
  const yy = Number(m[1]);
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return Math.round(Date.UTC(year, 0, 1) + (Number(m[2]) - 1) * 86_400_000);
}

/** The station's elements from this app's satellites route, over loopback so its cache is shared. */
export async function issElementsNow(revalidate = 1800): Promise<IssElements | null> {
  const res = await ownApi<{ satellites?: { noradId?: string; line1?: string; line2?: string }[] }>(`/api/satellites?norad=${ISS_NORAD}&tle=1`, revalidate);
  const sat = res?.satellites?.find(s => s.noradId === ISS_NORAD && s.line1 && s.line2);
  const epoch = sat ? tleEpoch(sat.line1!) : null;
  return sat && epoch != null ? { line1: sat.line1!, line2: sat.line2!, epoch } : null;
}

export interface IssPass {
  rise: number;
  peak: number;
  set: number | null;
  /** Whole degrees. */
  maxElevation: number;
  from: string;
  to: string | null;
  minutes: number | null;
  /** Sunlit against a dark sky at some point, so it can be seen by eye. */
  visible: boolean;
  /** 0 tonight, 1 tomorrow night (sky-time.ts nightOf). */
  night: number;
  start: LocalClock;
  end: LocalClock | null;
}

export type IssCase = 'unavailable' | 'stale' | 'never' | 'none' | 'unseen' | 'visible';

export interface IssReport {
  case: IssCase;
  tz: string;
  now: number;
  epoch: number | null;
  ageDays: number | null;
  /** The highest it can ever climb here, from the geometry of its orbit. */
  best: number;
  /** Every pass above 10° in the window, seen or not. */
  passes: IssPass[];
  visible: IssPass[];
  next: IssPass | null;
  /** The highest visible pass in the window. */
  highest: IssPass | null;
  /** The first visible pass after the window, within the lookahead, when the window has none. */
  later: IssPass | null;
}

export interface IssPlace { lat: number; lng: number; tz: string }

function local(p: SkyPass, now: number, tz: string): IssPass {
  return {
    rise: p.rise,
    peak: p.peak,
    set: p.set,
    maxElevation: Math.round(p.maxElevation),
    from: compassPoint(p.riseAzimuth),
    to: p.setAzimuth == null ? null : compassPoint(p.setAzimuth),
    minutes: p.set == null ? null : Math.max(1, Math.round((p.set - p.rise) / 60_000)),
    visible: p.visible,
    night: nightOf(p.rise, now, tz),
    start: localClock(p.rise, tz),
    end: p.set == null ? null : localClock(p.set, tz),
  };
}

export function issReport(el: IssElements | null, place: IssPlace, now: number): IssReport {
  const best = Math.round(issBestElevation(place.lat));
  const base: IssReport = { case: 'unavailable', tz: place.tz, now, epoch: el?.epoch ?? null, ageDays: null, best, passes: [], visible: [], next: null, highest: null, later: null };
  const satrec = el ? parseTLE(el.line1, el.line2) : null;
  if (!el || !satrec) return base;
  base.ageDays = Math.round(((now - el.epoch) / 86_400_000) * 10) / 10;
  if (base.ageDays > ISS_STALE_DAYS) return { ...base, case: 'stale' };
  if (best < SKY_RULES.issMinElevation) return { ...base, case: 'never' };

  const opts = { minElevation: SKY_RULES.issMinElevation, hours: ISS_WINDOW_HOURS, max: 60 };
  const passes = nextSkyPasses(satrec, place.lat, place.lng, now, opts).map(p => local(p, now, place.tz));
  const visible = passes.filter(p => p.visible);
  const highest = visible.reduce<IssPass | null>((top, p) => (!top || p.maxElevation > top.maxElevation ? p : top), null);

  let later: IssPass | null = null;
  if (!visible.length) {
    const end = now + ISS_LOOKAHEAD_DAYS * 86_400_000;
    for (let from = now + ISS_WINDOW_HOURS * 3_600_000; from < end && !later; from += ISS_WINDOW_HOURS * 3_600_000) {
      // A window opening mid-pass returns that pass cut off at the window's edge, with a rise that isn't real.
      const seen = nextSkyPasses(satrec, place.lat, place.lng, from, { ...opts, hours: Math.min(ISS_WINDOW_HOURS, (end - from) / 3_600_000) }).find(p => p.visible && p.rise !== from);
      if (seen) later = local(seen, now, place.tz);
    }
  }
  return { ...base, case: !passes.length ? 'none' : visible.length ? 'visible' : 'unseen', passes, visible, next: visible[0] ?? null, highest, later };
}
