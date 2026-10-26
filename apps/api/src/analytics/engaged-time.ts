import { pageOf } from './crawls';
import { median } from './journeys';
import { MAP_PATH } from './page-reads';
import type { Visit } from './page-visits';

/** A view engaged for less than this was glanced at, not read. */
export const SHORT_MS = 10_000;

export type EngagedStats = { views: number; medianMs: number | null; meanMs: number | null; short: number };

const statsOf = (times: number[]): EngagedStats => ({
  views: times.length,
  medianMs: median(times),
  meanMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
  short: times.filter(ms => ms < SHORT_MS).length,
});

/**
 * Engaged time on the public pages across `visits` (GET /api/admin/analytics/pages, as journeys.engaged): every timed
 * view, the views a visit landed on (split by whether the visit left from there or went on), and each kind of page
 * ('/city/*\/weather', crawls.ts pageOf). A view is a visit's step with a quick reload folded in. The map is left out,
 * and so are views that never reported a time, which `untimed` counts.
 */
export function engagedTime(visits: Visit[]) {
  const all: number[] = [];
  const landed = { all: [] as number[], left: [] as number[], wentOn: [] as number[] };
  const kinds = new Map<string, { times: number[]; landings: number[] }>();
  let untimed = 0;
  for (const v of visits) {
    v.steps.forEach((s, i) => {
      if (s.path === MAP_PATH) return;
      if (s.engagedMs == null) {
        untimed += 1;
        return;
      }
      const kind = pageOf(s.path);
      const row = kinds.get(kind) ?? kinds.set(kind, { times: [], landings: [] }).get(kind)!;
      all.push(s.engagedMs);
      row.times.push(s.engagedMs);
      if (i > 0) return;
      row.landings.push(s.engagedMs);
      landed.all.push(s.engagedMs);
      (v.next === 'left' ? landed.left : landed.wentOn).push(s.engagedMs);
    });
  }
  return {
    all: statsOf(all),
    untimed,
    landing: { ...statsOf(landed.all), left: statsOf(landed.left), wentOn: statsOf(landed.wentOn) },
    kinds: [...kinds]
      .map(([kind, k]) => ({ kind, ...statsOf(k.times), landings: k.landings.length, landingMedianMs: median(k.landings) }))
      .sort((a, b) => b.views - a.views || a.kind.localeCompare(b.kind)),
  };
}

export type EngagedTime = ReturnType<typeof engagedTime>;
