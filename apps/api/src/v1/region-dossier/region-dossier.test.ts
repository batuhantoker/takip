import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { advisoriesFor, clearAdvisoryMemos } from '@takip/connectors/advisories/lookup';
import { startApp, type TestApp } from '../../testing/helpers';
import { legacyGet } from '../testing/legacy';
import { run } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));
vi.mock('@takip/connectors/http-json', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/http-json')>()),
  httpJson: upstream.httpJson,
  httpText: upstream.httpText,
}));
vi.mock('@takip/connectors/advisories/lookup', { spy: true });

const START = Date.parse('2026-10-12T12:00:00Z');
const CACHED = 'public, s-maxage=3600, stale-while-revalidate=7200';
const ATTRIBUTION = '© OpenStreetMap contributors';
const LATE = 'no answer within the time budget';

const PHOTON = 'https://photon.komoot.io/reverse';
const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const PAGEPROPS = 'https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=';
const STATEMENTS = 'https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items';
const LABELS = 'https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=en&format=json&ids=';
const US_FEED = 'https://travel.state.gov/_res/rss/TAsTWs.xml';
const AU_FEED = 'https://www.smartraveller.gov.au/countries/documents/index.rss';
const FCDO_INDEX = 'https://www.gov.uk/api/content/foreign-travel-advice';
const UNHCR = 'https://api.unhcr.org/population/v1';
const POLICE = 'https://data.police.uk/api/crimes-street/all-crime';

const KYIV = '?lat=50.4501&lng=30.5234';
const KYIV_PHOTON = `${PHOTON}?lat=50.450&lon=30.523&lang=en&radius=50`;
const LONDON = '?lat=51.5074&lng=-0.1278';

const place = (city: string, state: string, country: string, countrycode: string) =>
  ({ features: [{ properties: { name: 'Some street', city, state, country, countrycode } }] });

const holds = (content: unknown) => ({ rank: 'normal', qualifiers: [{ property: { id: 'P580' } }], value: { content } });
const ended = (content: unknown) => ({ rank: 'normal', qualifiers: [{ property: { id: 'P582' } }], value: { content } });
const UKRAINE_STATEMENTS = {
  P36: [holds('Q1899')],
  P30: [holds('Q46')],
  P37: [holds('Q8798')],
  P38: [holds('Q81893')],
  P35: [ended('Q8058'), holds('Q3874799')],
  P1906: [holds('Q2347105')],
  P41: [holds('Flag of Ukraine.svg')],
  P1082: [ended({ amount: '+48457102' }), { rank: 'preferred', value: { content: { amount: '+41167335' } } }],
  P2046: [holds({ amount: '+603628' })],
};
const LABELS_EN = Object.fromEntries(
  Object.entries({ Q1899: 'Kyiv', Q46: 'Europe', Q8798: 'Ukrainian', Q81893: 'hryvnia', Q3874799: 'Volodymyr Zelenskyy', Q2347105: 'President of Ukraine' })
    .map(([id, value]) => [id, { labels: { en: { value } } }]),
);

const usItem = (title: string, link: string, level: string) =>
  `<item><title>${title}</title><link>${link}</link><pubDate>Tue, 15 Sep 2026</pubDate>` +
  `<category domain="Threat-Level">${level}</category><category domain="Country-Tag">UP</category></item>`;
const US_XML = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
${usItem('Ukraine - Level 4: Do Not Travel', 'https://travel.state.gov/destination.ukr.html', 'Level 4: Do Not Travel')}
${usItem('France - Level 2: Exercise Increased Caution', 'https://travel.state.gov/destination.fra.html', 'Level 2: Exercise Increased Caution')}
</channel></rss>`;
const auItem = (title: string, ratio: string, label: string) => `<item><title>${title}</title>
<link>https://www.smartraveller.gov.au/destinations/europe/${title.toLowerCase()}</link>
<description>We continue to advise ${label.toLowerCase()} to ${title}. Russia's invasion continues.</description>
<pubDate>01 Oct 2026 22:00:00 AEST</pubDate>
<ta:warnings><ta:level>${ratio}</ta:level><dc:description>${label}</dc:description></ta:warnings></item>`;
const AU_XML = `<?xml version="1.0"?><rss xmlns:ta="http://www.smartraveller.gov.au/schema/rss/travel_advisories/" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0"><channel>
${auItem('Ukraine', '5/5', 'Do not travel')}
${auItem('France', '3/5', 'Exercise a high degree of caution')}
</channel></rss>`;

// The FCDO index must list at least 200 countries to be believed.
const FCDO_SLUGS = ['ukraine', 'france', ...Array.from({ length: 200 }, (_, i) => `somewhere-${i}`)];
const FCDO_INDEX_JSON = { links: { children: FCDO_SLUGS.map(slug => ({ details: { country: { slug, name: slug } } })) } };
const FCDO_UKRAINE = {
  title: 'Ukraine travel advice',
  public_updated_at: '2026-10-09T14:00:00Z',
  details: {
    alert_status: ['avoid_all_travel_to_parts', 'avoid_all_but_essential_travel_to_whole_country'],
    change_description: 'Information on air raid alerts.',
    country: { name: 'Ukraine', slug: 'ukraine' },
  },
};

const UNHCR_COUNTRIES = { items: [{ iso: 'UKR', iso2: 'UA' }, { iso: 'GBR', iso2: 'GB' }, { iso: 'SYR', iso2: 'SY' }] };
const UNHCR_ORIGIN = { items: [{ year: 2025, coo_iso: 'UKR', coa_iso: '-', refugees: 5_600_000, asylum_seekers: 250_000, idps: '3700000' }] };
const UNHCR_ASYLUM = {
  items: [
    { year: 2025, coo_iso: '-', coa_iso: 'UKR', refugees: 2_400, asylum_seekers: 3_100, idps: '0' },
    { year: 2025, coo_iso: '-', coa_iso: 'GBR', refugees: 450_000, asylum_seekers: '120000', idps: '-' },
  ],
};
const crime = (category: string) => ({ category, location_type: 'Force', month: '2026-08' });

/** Every source answering for Kyiv and London. */
function everyoneAnswers() {
  upstream.on(PHOTON, () => place('Kyiv', 'Kyiv City', 'Ukraine', 'ua'));
  upstream.on(`${PHOTON}?lat=51.507`, () => place('London', 'England', 'United Kingdom', 'gb'));
  upstream.on(SUMMARY, url => ({
    title: decodeURIComponent(url.split('/').pop()!),
    extract: 'x'.repeat(600),
    thumbnail: { source: 'https://upload.wikimedia.org/thumb.jpg' },
  }));
  upstream.on(PAGEPROPS, () => ({ query: { pages: { 31750: { pageprops: { wikibase_item: 'Q212' } } } } }));
  upstream.on(`${STATEMENTS}/Q212/statements`, () => UKRAINE_STATEMENTS);
  upstream.on(LABELS, () => ({ entities: LABELS_EN }));
  upstream.on(US_FEED, () => US_XML);
  upstream.on(AU_FEED, () => AU_XML);
  upstream.on(FCDO_INDEX, () => FCDO_INDEX_JSON);
  upstream.on(`${FCDO_INDEX}/ukraine`, () => FCDO_UKRAINE);
  upstream.on(`${UNHCR}/countries/`, () => UNHCR_COUNTRIES);
  upstream.on(`${UNHCR}/population/`, url => (url.includes('coo_all') ? UNHCR_ORIGIN : UNHCR_ASYLUM));
  upstream.on(POLICE, () => [crime('violent-crime'), crime('violent-crime'), crime('shoplifting')]);
}

const KYIV_UPSTREAM = [
  KYIV_PHOTON,
  `${SUMMARY}/Kyiv`,
  `${PAGEPROPS}Ukraine`,
  US_FEED,
  AU_FEED,
  FCDO_INDEX,
  `${UNHCR}/countries/?limit=400`,
  `${STATEMENTS}/Q212/statements`,
  `${LABELS}Q1899|Q46|Q3874799|Q2347105|Q8798|Q81893`,
  `${UNHCR}/population/?limit=1000&yearFrom=2025&yearTo=2025&coo_all=true`,
  `${UNHCR}/population/?limit=1000&yearFrom=2025&yearTo=2025&coa_all=true`,
  `${FCDO_INDEX}/ukraine`,
];

let t: TestApp;
let legacy: (path: string) => Promise<Response>;

beforeAll(async () => {
  t = await startApp();
  legacy = await legacyGet('@/app/api/region-dossier/route');
  vi.stubGlobal('fetch', upstream.fetch);
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  return t.close();
});
beforeEach(() => {
  upstream.reset();
  vi.mocked(advisoriesFor).mockClear();
});

type Send = (path: string) => Response | Promise<Response>;

/** Each query in turn, from cold caches, with every advice issuer never loaded; `before(i)` runs ahead of the i-th request. */
function side(prefix: string, send: Send, queries: string[], before?: (i: number) => void) {
  clearAdvisoryMemos();
  vi.setSystemTime(START);
  let i = 0;
  return run(queries.map(q => `${prefix}${q}`), path => {
    before?.(i++);
    return send(path);
  });
}

async function check(queries: string[], before?: (i: number) => void) {
  const v1 = await side('/api/v1/region-dossier', path => t.app.request(path), queries, before);
  const old = await side('/api/region-dossier', legacy, queries, before);
  expect(v1).toEqual(old);
  return v1;
}

describe('GET /api/v1/region-dossier', () => {
  it('puts the place, the country, its advice and its displacement together', async () => {
    everyoneAnswers();
    const [res] = await check([KYIV]);
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: CACHED,
      body: {
        coordinates: { lat: 50.4501, lng: 30.5234 },
        location: { city: 'Kyiv', state: 'Kyiv City', country: 'Ukraine', country_code: 'UA', display_name: 'Kyiv, Kyiv City, Ukraine' },
        country: {
          name: 'Ukraine',
          official_name: 'Ukraine',
          capital: 'Kyiv',
          population: 41167335,
          area: 603628,
          region: 'Europe',
          subregion: 'Europe',
          languages: ['Ukrainian'],
          currencies: ['hryvnia'],
          flag_url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Flag%20of%20Ukraine.svg',
          timezones: [],
        },
        head_of_state: { name: 'Volodymyr Zelenskyy', position: 'President of Ukraine' },
        wikipedia: { title: 'Kyiv', extract: 'x'.repeat(500), thumbnail: 'https://upload.wikimedia.org/thumb.jpg' },
        travel_advice: [
          {
            issuer: 'Australia Smartraveller', iso2: 'UA', country: 'Ukraine', level: 4, label: 'Do not travel', statuses: ['5/5'],
            change: 'We continue to advise do not travel to Ukraine.', updated_at: '2026-10-01T12:00:00.000Z',
            url: 'https://www.smartraveller.gov.au/destinations/europe/ukraine',
          },
          {
            issuer: 'UK FCDO', iso2: 'UA', country: 'Ukraine', level: 3, label: 'Advises against all travel to parts',
            statuses: ['avoid_all_travel_to_parts', 'avoid_all_but_essential_travel_to_whole_country'],
            change: 'Information on air raid alerts.', updated_at: '2026-10-09T14:00:00Z',
            url: 'https://www.gov.uk/foreign-travel-advice/ukraine',
          },
          {
            issuer: 'US State Department', iso2: 'UA', country: 'Ukraine', level: 4, label: 'Do Not Travel',
            statuses: ['Level 4: Do Not Travel'], change: null, updated_at: '2026-09-15',
            url: 'https://travel.state.gov/destination.ukr.html',
          },
        ],
        displacement: {
          iso2: 'UA', year: 2025, refugees_from: 5_600_000, asylum_seekers_from: 250_000, idps: 3_700_000,
          refugees_hosted: 2_400, asylum_seekers_hosted: 3_100, source: 'UNHCR', url: 'https://www.unhcr.org/refugee-statistics/',
        },
        street_crime: null,
        unavailable: [],
        attribution: ATTRIBUTION,
        timestamp: '2026-10-12T12:00:00.000Z',
      },
      upstream: KYIV_UPSTREAM,
    });
  });

  it('adds street crime in Great Britain, where the FCDO has no page and that is no failure', async () => {
    everyoneAnswers();
    const [res] = await check([LONDON]);
    expect(res).toMatchObject({
      status: 200,
      cache: CACHED,
      body: {
        location: { city: 'London', country: 'United Kingdom', country_code: 'GB', display_name: 'London, England, United Kingdom' },
        travel_advice: [],
        displacement: { iso2: 'GB', refugees_from: 0, refugees_hosted: 450_000, asylum_seekers_hosted: 120_000 },
        street_crime: {
          month: '2026-08', total: 3, radius_miles: 1, source: 'data.police.uk', url: 'https://data.police.uk/',
          top: [{ category: 'violent-crime', label: 'Violent crime', count: 2 }, { category: 'shoplifting', label: 'Shoplifting', count: 1 }],
        },
        unavailable: [],
      },
    });
    expect(res.upstream).toContain(`${POLICE}?lat=51.5074&lng=-0.1278`);
    expect(res.upstream).not.toContain(`${FCDO_INDEX}/united-kingdom`);
  });

  it('answers an empty dossier for open sea or missing coordinates, without asking anyone else, and does not cache it', async () => {
    upstream.on(PHOTON, () => ({ features: [] }));
    const [sea, missing] = await check(['?lat=0&lng=-30', '']);
    expect(sea).toEqual({
      status: 200,
      type: 'application/json',
      cache: 'no-store',
      body: {
        coordinates: { lat: 0, lng: -30 },
        location: {},
        country: null,
        head_of_state: null,
        wikipedia: null,
        travel_advice: [],
        displacement: null,
        street_crime: null,
        unavailable: [],
        attribution: ATTRIBUTION,
        timestamp: '2026-10-12T12:00:00.000Z',
      },
      upstream: [`${PHOTON}?lat=0.000&lon=-30.000&lang=en&radius=50`],
    });
    expect(missing).toMatchObject({ cache: 'no-store', body: { coordinates: { lat: 0, lng: 0 } } });
    expect(missing.upstream).toEqual([`${PHOTON}?lat=0.000&lon=0.000&lang=en&radius=50`]);
  });

  it('asks Photon once more after a failure, then answers an uncached empty dossier', async () => {
    upstream.on(PHOTON, fails(503));
    const [res] = await check([KYIV]);
    expect(res).toMatchObject({ status: 200, cache: 'no-store', body: { location: {}, unavailable: [] } });
    expect(res.upstream).toEqual([KYIV_PHOTON, KYIV_PHOTON]);
  });

  it('reads a repeated parameter as its first value', async () => {
    everyoneAnswers();
    const [res] = await check([`${KYIV}&lat=10`]);
    expect(res.upstream[0]).toBe(KYIV_PHOTON);
  });

  it('names each failed advice issuer and UNHCR, and leaves out a failed Wikipedia or Wikidata', async () => {
    everyoneAnswers();
    upstream.on(AU_FEED, fails(403));
    upstream.on(FCDO_INDEX, fails(503));
    upstream.on(UNHCR, fails(500));
    upstream.on(SUMMARY, fails(404));
    upstream.on(PAGEPROPS, fails(500));
    const [res] = await check([KYIV]);
    expect(res).toMatchObject({
      status: 200,
      cache: CACHED,
      body: {
        country: null,
        head_of_state: null,
        wikipedia: null,
        displacement: null,
        unavailable: ['Australia Smartraveller', 'UK FCDO', 'UNHCR'],
      },
    });
    expect((res.body as { travel_advice: { issuer: string }[] }).travel_advice.map(a => a.issuer)).toEqual(['US State Department']);
  });

  it('reads a failed data.police.uk lookup as no data, not as unavailable', async () => {
    everyoneAnswers();
    upstream.on(POLICE, fails(503));
    const [res] = await check([LONDON]);
    expect(res).toMatchObject({ status: 200, body: { street_crime: null, unavailable: [] } });
  });

  it('waits 2.5 s for the US and Australian feeds, but for the FCDO in full', async () => {
    everyoneAnswers();
    const after = (ms: number, answer: unknown) => () => new Promise(resolve => setTimeout(() => resolve(answer), ms));
    upstream.on(US_FEED, after(2200, US_XML));
    upstream.on(AU_FEED, after(2800, AU_XML));
    upstream.on(`${FCDO_INDEX}/ukraine`, after(3000, FCDO_UKRAINE));
    const [res] = await check([KYIV]);
    expect(res).toMatchObject({ status: 200, cache: CACHED, body: { unavailable: ['Australia Smartraveller'] } });
    expect((res.body as { travel_advice: { issuer: string }[] }).travel_advice.map(a => a.issuer)).toEqual(['UK FCDO', 'US State Department']);
    expect(res.upstream).toEqual(KYIV_UPSTREAM);
  });

  it('names an issuer that has never answered within the budget', async () => {
    everyoneAnswers();
    upstream.on(US_FEED, () => new Promise(() => {}));
    upstream.on(AU_FEED, () => new Promise(() => {}));
    const [res] = await check([KYIV]);
    expect(res).toMatchObject({ status: 200, body: { unavailable: ['US State Department', 'Australia Smartraveller'] } });
    expect((res.body as { travel_advice: { issuer: string }[] }).travel_advice.map(a => a.issuer)).toEqual(['UK FCDO']);
  });

  it('serves the last good US and Australian advice when a refresh overruns the budget', async () => {
    everyoneAnswers();
    let hang = false;
    upstream.on(US_FEED, () => (hang ? new Promise(() => {}) : US_XML));
    upstream.on(AU_FEED, () => (hang ? new Promise(() => {}) : AU_XML));
    const [first, hourLater] = await check([KYIV, KYIV], i => {
      hang = i === 1;
      if (hang) vi.setSystemTime(START + 61 * 60_000);
    });
    expect(hourLater.body).toEqual({ ...(first.body as object), timestamp: '2026-10-12T13:01:00.000Z' });
    expect(hourLater.upstream).toEqual([`${SUMMARY}/Kyiv`, US_FEED, AU_FEED]);
  });

  it('answers "Travel advice" unavailable when the whole advice lookup fails', async () => {
    everyoneAnswers();
    vi.mocked(advisoriesFor).mockRejectedValueOnce(new Error('lookup failed')).mockRejectedValueOnce(new Error('lookup failed'));
    const [res] = await check([KYIV]);
    expect(res).toMatchObject({ status: 200, body: { travel_advice: [], unavailable: ['Travel advice'] } });
    expect(advisoriesFor).toHaveBeenCalledTimes(2);
  });
});
