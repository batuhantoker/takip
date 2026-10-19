import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, nameOf, placeName, TITLE_MAX } from '../copy/format';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { auroraGridNow, auroraReport, type AuroraReport } from './aurora-now';
import type { AuroraMeta, AuroraRow } from './sky-data';

/**
 * The northern or southern lights at /city/<place>/aurora: how close the place sits to the auroral oval (its
 * corrected geomagnetic latitude), NOAA's chance overhead right now, and whether it is dark enough to see it.
 * A page from 50° of magnetic latitude; indexed from 55° north and 51.5° south (sky-rules.ts).
 */

export interface AuroraData {
  tz: string;
  /** Corrected geomagnetic latitude, negative in the south. */
  mlat: number;
  field: string;
}

export interface AuroraLive { at: number; report: AuroraReport }

/** Where the place sits against the oval, from its magnetic latitude. */
export type OvalBand = 'cap' | 'under' | 'edge' | 'active' | 'storms';

export function ovalBand(mlat: number): OvalBand {
  const m = Math.abs(mlat);
  return m >= 72 ? 'cap' : m >= 65 ? 'under' : m >= 60 ? 'edge' : m >= 55 ? 'active' : 'storms';
}

const hemisphere = (mlat: number) => (mlat >= 0 ? 'north' : 'south');

export const AURORA: PlaceTopic<AuroraData, AuroraLive> = {
  id: 'aurora',
  label: msg('Aurora'),
  inline: msg('aurora'),
  kinds: ['city'],

  pages(place) {
    const table = topicTable<AuroraRow, AuroraMeta>('aurora');
    const row = table.rows[place.id];
    return row ? [{ slug: 'aurora', data: { tz: row.tz, mlat: row.mlat, field: table.meta?.field ?? '' }, index: row.index === true }] : [];
  },

  header(place, { data }, t) {
    const name = (t: Translate) => nameOf(place, t);
    const h = hemisphere(data.mlat);
    const vars = (t: Translate) => ({ city: name(t), mlat: Math.round(Math.abs(data.mlat)), h });
    const lede = {
      cap: msg('{city} is at {mlat}° magnetic latitude, inside the polar cap: at night the auroral oval usually lies to the {h, select, north {south} other {north}}, and around midday in the dark of winter it can pass overhead.'),
      under: msg('{city} is at {mlat}° magnetic latitude, under the auroral oval: on a dark, clear night the aurora is often overhead. Here is NOAA’s chance for it right now, and when it is next dark.'),
      edge: msg('{city} is at {mlat}° magnetic latitude, near the auroral oval’s edge: on an ordinary night the aurora can show in the {h, select, north {northern} other {southern}} sky, and overhead when activity rises.'),
      active: msg('{city} is at {mlat}° magnetic latitude, short of the auroral oval: the aurora shows low in the {h, select, north {northern} other {southern}} sky on active nights, and overhead only in storms.'),
      storms: msg('{city} is at {mlat}° magnetic latitude, far from the auroral oval: only strong geomagnetic storms bring the aurora into view, usually low in the {h, select, north {northern} other {southern}} sky.'),
    }[ovalBand(data.mlat)];
    return {
      title: fit([
        t => t('{city} {h, select, north {northern lights} other {southern lights}} forecast: aurora chance now', vars(t)),
        t => t('{h, select, north {Northern lights} other {Southern lights}} in {city}: aurora chance now', vars(t)),
        t => t('{city} {h, select, north {northern lights} other {southern lights}} forecast', vars(t)),
        t => t('{city} aurora forecast', vars(t)),
      ], t, TITLE_MAX),
      description: fit([
        t => t('The chance of the {h, select, north {northern lights} other {southern lights}} over {place} right now, from NOAA’s aurora model, and when it is next dark enough there to see them.', { ...vars(t), place: placeName(place, t) }),
        t => t('The chance of the {h, select, north {northern lights} other {southern lights}} over {city} right now, from NOAA’s aurora model, and when it is next dark enough there to see them.', vars(t)),
        t => t('The chance of the aurora over {city} right now, from NOAA’s model, and when it is next dark enough there to see it.', vars(t)),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('{h, select, north {Northern lights} other {Southern lights}} in {city}', vars(t)),
      lede: t(lede, vars(t)),
    };
  },

  summary(place, { data }, t) {
    return t('The chance overhead now and when it is dark; {mlat}° magnetic latitude.', { mlat: Math.round(Math.abs(data.mlat)) });
  },

  open: () => ({ layers: ['aurora'], zoom: 4 }),

  async live(place, { data }) {
    const grid = await auroraGridNow();
    const now = Date.now();
    const report = auroraReport(grid, { lat: place.at[1], lng: place.at[0], tz: data.tz }, now);
    const observed = report.observedAt ? Date.parse(report.observedAt) : NaN;
    return { at: Number.isFinite(observed) ? Math.min(observed, now) : now, report };
  },
};

export type AuroraPage = TopicPage<AuroraData>;
