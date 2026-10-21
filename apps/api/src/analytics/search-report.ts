import { isoDay } from '../access/usage';
import { eachDay, type Range } from './range';
import { alpha2, type SearchConsole, type SearchRow } from './search-console';

const PAGE_ROWS = 25_000;
const MAX_PAGE_CALLS = 4;
const TOP = 300;
const PER_TYPE = 15;

const LOCALE = /^\/(tr|es|pt|fr|de|ru|ar|zh|ja)(?=\/|$)/;
const PLACE_KINDS = new Set(['city', 'town', 'county', 'state', 'country']);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * What kind of page a URL is, for adding Search Console's rows up by the pages TAKIP generates: 'City · weather',
 * 'Country · population', 'Map layer pages', 'Events'. Its language comes from the prefix, English when there is none.
 */
export function pageType(url: string): { type: string; locale: string; path: string } {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  const locale = LOCALE.exec(path)?.[1] ?? 'en';
  path = path.replace(LOCALE, '') || '/';
  const [section = '', slug, topic] = path.split('/').slice(1).filter(Boolean);
  const type = !section ? 'The map (home)'
    : PLACE_KINDS.has(section) ? (!slug ? `${cap(section)} index` : topic ? `${cap(section)} · ${topic.replace(/-/g, ' ')}` : `${cap(section)} overview`)
      : section === 'map' ? (slug ? 'Map layer pages' : 'Map index')
        : section === 'event' ? 'Events'
          : section === 'compare' ? (!slug ? 'Compare index' : topic ? 'Compare · one measure' : 'Compare · overview')
            : section === 'guides' ? (slug ? 'Guides' : 'Guides index')
              : `/${section}`;
  return { type, locale, path };
}

type Sum = { clicks: number; impressions: number; weighted: number };
const blank = (): Sum => ({ clicks: 0, impressions: 0, weighted: 0 });
const add = (s: Sum, r: SearchRow) => {
  s.clicks += r.clicks;
  s.impressions += r.impressions;
  s.weighted += r.position * r.impressions;
};
/** Clicks, impressions, click rate and the impression-weighted average position. */
const stats = (s: Sum) => ({
  clicks: s.clicks, impressions: s.impressions,
  ctr: s.impressions ? s.clicks / s.impressions : 0,
  position: s.impressions ? Math.round((s.weighted / s.impressions) * 10) / 10 : null,
});
const byImpressions = <T extends { impressions: number; clicks: number }>(a: T, b: T) => b.impressions - a.impressions || b.clicks - a.clicks;

async function allPages(gsc: SearchConsole, startDate: string, endDate: string) {
  const rows: SearchRow[] = [];
  for (let call = 0; call < MAX_PAGE_CALLS; call++) {
    const page = await gsc.query({ startDate, endDate, dimensions: ['page'], rowLimit: PAGE_ROWS, startRow: call * PAGE_ROWS });
    rows.push(...page);
    if (page.length < PAGE_ROWS) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/**
 * GET /api/admin/analytics/search: Google Search over the range, from Search Console's API. Totals and page types come
 * from the per-page rows, which count every search; searches by term leave out the rare ones Google keeps private.
 */
export async function searchReport(gsc: SearchConsole | null, r: Range, fetchedAt: number) {
  if (!gsc) return { configured: false as const };
  const startDate = isoDay(r.first);
  const endDate = isoDay(r.today);
  const head = { configured: true as const, account: gsc.account, from: startDate, to: endDate, fetchedAt };
  try {
    const site = await gsc.site();
    if (!site) return { ...head, site: null, error: null };
    const [daily, pages, pairs, queries, countries, devices] = await Promise.all([
      gsc.query({ startDate, endDate, dimensions: ['date'], rowLimit: 1000 }),
      allPages(gsc, startDate, endDate),
      gsc.query({ startDate, endDate, dimensions: ['page', 'query'], rowLimit: PAGE_ROWS }),
      gsc.query({ startDate, endDate, dimensions: ['query'], rowLimit: TOP }),
      gsc.query({ startDate, endDate, dimensions: ['country'], rowLimit: 250 }),
      gsc.query({ startDate, endDate, dimensions: ['device'] }),
    ]);

    const total = blank();
    const types = new Map<string, Sum & { pages: number }>();
    const locales = new Map<string, Sum>();
    const pageRows = pages.rows.map(row => {
      add(total, row);
      const { type, locale } = pageType(row.keys[0]);
      const t = types.get(type) ?? { ...blank(), pages: 0 };
      add(t, row);
      t.pages += 1;
      types.set(type, t);
      const l = locales.get(locale) ?? blank();
      add(l, row);
      locales.set(locale, l);
      return { path: row.keys[0].replace(/^https?:\/\/[^/]+/, '') || '/', type, ...stats({ clicks: row.clicks, impressions: row.impressions, weighted: row.position * row.impressions }) };
    });

    const typeQueries = new Map<string, Map<string, Sum>>();
    for (const row of pairs) {
      const { type } = pageType(row.keys[0]);
      const queriesOfType = typeQueries.get(type) ?? new Map<string, Sum>();
      const q = queriesOfType.get(row.keys[1]) ?? blank();
      add(q, row);
      queriesOfType.set(row.keys[1], q);
      typeQueries.set(type, queriesOfType);
    }

    const days = new Map(daily.map(d => [d.keys[0], d]));
    return {
      ...head,
      site,
      error: null,
      truncated: pages.truncated,
      totals: { ...stats(total), pages: pages.rows.length },
      daily: eachDay(r, day => {
        const d = days.get(day);
        return { day, clicks: d?.clicks ?? 0, impressions: d?.impressions ?? 0, position: d ? Math.round(d.position * 10) / 10 : null };
      }),
      types: [...types].map(([type, s]) => ({ type, pages: s.pages, ...stats(s) })).sort(byImpressions),
      languages: [...locales].map(([locale, s]) => ({ locale, ...stats(s) })).sort(byImpressions),
      pages: pageRows.sort(byImpressions).slice(0, TOP),
      queries: queries.map(q => ({ query: q.keys[0], ...stats({ clicks: q.clicks, impressions: q.impressions, weighted: q.position * q.impressions }) })),
      typeQueries: [...typeQueries].flatMap(([type, qs]) =>
        [...qs].map(([query, s]) => ({ type, query, ...stats(s) })).sort(byImpressions).slice(0, PER_TYPE)),
      countries: countries.map(c => ({ country: alpha2(c.keys[0]), ...stats({ clicks: c.clicks, impressions: c.impressions, weighted: c.position * c.impressions }) })),
      devices: devices.map(d => ({ device: d.keys[0].toLowerCase(), ...stats({ clicks: d.clicks, impressions: d.impressions, weighted: d.position * d.impressions }) })),
    };
  } catch (err) {
    return { ...head, site: null, error: (err as Error).message };
  }
}
