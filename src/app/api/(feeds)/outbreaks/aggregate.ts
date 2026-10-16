import { countryPoint } from './centroids';
import type { Outbreak, OutbreakNotice } from './types';

/**
 * TAKIP — notices → map points. An item counts only when it names a known disease and at least one
 * country, and is under 90 days old unless it is a CDC notice: CDC lists a notice for exactly as long
 * as it is in force, so its age says nothing. Each country is pinned at its centroid (`precision: 'country'`).
 * There is no keyword grading: `level` is the issuer's own grade or null.
 */

export const MAX_AGE_DAYS = 90;
/** CDC's "Global Measles" names 238 countries: that is a worldwide advisory, not an outbreak at a place. */
export const MAX_COUNTRIES = 50;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Higher issuer level first, then newer. CDC keeps several notices active for one outbreak at once
 * (Level 4 for two DRC provinces next to a newer Level 2 for the rest), so the newest alone would
 * under-report. WHO and ECDC have no level, so for them the newest wins.
 */
function outranks(a: Outbreak, b: Outbreak): boolean {
  if ((a.level ?? 0) !== (b.level ?? 0)) return (a.level ?? 0) > (b.level ?? 0);
  return a.published > b.published;
}

export interface WorldwideNotice {
  source: OutbreakNotice['source'];
  title: string;
  url: string;
  published: string | null;
  countries: number;
}

export function aggregateOutbreaks(notices: OutbreakNotice[], now: number): { outbreaks: Outbreak[]; worldwide: WorldwideNotice[]; unmatched: string[] } {
  const cutoff = now - MAX_AGE_DAYS * 24 * 3600_000;
  const best = new Map<string, Outbreak>();
  const unmatched = new Set<string>();
  const worldwide: WorldwideNotice[] = [];

  for (const n of notices) {
    const at = n.published ? Date.parse(n.published) : NaN;
    if (!Number.isFinite(at) || (at < cutoff && n.source !== 'CDC') || !n.disease) continue;
    if (n.countries.length > MAX_COUNTRIES) {
      worldwide.push({ source: n.source, title: n.title, url: n.url, published: n.published, countries: n.countries.length });
      continue;
    }
    n.unmatched.forEach(u => unmatched.add(u));
    for (const c of n.countries) {
      const point = countryPoint(c.iso2);
      if (!point) {
        unmatched.add(`${c.name} (${c.iso2}: no centroid)`);
        continue;
      }
      const row: Outbreak = {
        id: `${n.source.toLowerCase()}-${slug(n.disease)}-${c.iso2.toLowerCase()}`,
        disease: n.disease,
        country: c.name,
        iso2: c.iso2,
        lat: point[1],
        lng: point[0],
        precision: 'country',
        title: n.title,
        url: n.url,
        published: n.published as string,
        source: n.source,
        level: n.level,
      };
      const prev = best.get(row.id);
      if (!prev || outranks(row, prev)) best.set(row.id, row);
    }
  }

  const outbreaks = [...best.values()].sort((a, b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id));
  return { outbreaks, worldwide, unmatched: [...unmatched] };
}
