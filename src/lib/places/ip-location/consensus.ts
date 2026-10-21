import { haversine } from '@/lib/core/geodesic';

/** One provider's idea of where an address is. */
export type IpCandidate = {
  source: string;
  lat: number;
  lon: number;
  query?: string;
  city?: string;
  regionName?: string;
  country?: string;
  /** The IANA zone the provider puts the address in. */
  tz?: string;
  isp?: string;
  org?: string;
  as?: string;
};

/** The answer most providers agree on; `agreement` of the `answered` providers put it within AGREE_KM. */
export type IpConsensus = IpCandidate & { agreement: number; answered: number };

export const AGREE_KM = 100;

/** `tz`'s UTC offset at `at` ("GMT-04:00"), or null for a zone this runtime doesn't know. */
export function utcOffset(tz: string, at: Date): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * The candidate with the most others within AGREE_KM; on a tie the one closest to those, then the one closest to
 * every answer, then the earliest. With the browser's `tz`, answers in a zone whose offset differs are dropped
 * first, unless that drops all.
 */
export function pickConsensus(candidates: IpCandidate[], tz?: string | null, at = new Date()): IpConsensus | null {
  if (!candidates.length) return null;
  const want = tz ? utcOffset(tz, at) : null;
  const fits = want ? candidates.filter(c => !c.tz || utcOffset(c.tz, at) === want) : candidates;
  const pool = fits.length ? fits : candidates;

  const sum = (km: number[]) => km.reduce((total, d) => total + d, 0);
  const ranked = pool.map(c => {
    const km = pool.map(o => haversine([c.lon, c.lat], [o.lon, o.lat]));
    const near = km.filter(d => d <= AGREE_KM);
    return { c, support: near.length, clusterSpread: sum(near), spread: sum(km) };
  });
  const top = ranked.reduce((a, b) =>
    b.support !== a.support ? (b.support > a.support ? b : a)
      : b.clusterSpread !== a.clusterSpread ? (b.clusterSpread < a.clusterSpread ? b : a)
        : b.spread < a.spread ? b : a);
  const best = top.c;
  const bestSupport = top.support;
  // Every provider sees the same network, so any of them can name it.
  const network = (key: 'query' | 'isp' | 'org' | 'as') => best[key] ?? candidates.find(c => c[key])?.[key];
  return {
    ...best,
    query: network('query'),
    isp: network('isp'),
    org: network('org'),
    as: network('as'),
    agreement: bestSupport,
    answered: candidates.length,
  };
}
