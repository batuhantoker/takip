import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { familyOf } from './cameo';
import { parseEvents, type GdeltEventRow, type GdeltMentionRow } from './parse';
import { reduceEvents } from './reduce';
import { outletOf } from './slug';

const T0 = Date.UTC(2026, 9, 13, 0, 45);

let seq = 0;
const RIYADH = { place: 'Riyadh, Ar Riya?, Saudi Arabia', country: 'SA', featureId: '-3093009', lat: 24.6408, lng: 46.7728, geoType: 4 };
const TEXAS = { place: 'Texas, United States', country: 'US', featureId: 'TX', lat: 31.106, lng: -97.6475, geoType: 2 };

function row(url: string, o: Partial<GdeltEventRow> = {}): GdeltEventRow {
  return {
    id: String(++seq), day: '20261013', added: T0, actor1: '', actor2: '', isRoot: true,
    code: '190', rootCode: '19', quad: 4, goldstein: -10, mentions: 1, sources: 1, articles: 1, tone: -5,
    adm1: '', ...RIYADH, url, ...o,
  };
}

function mention(event: GdeltEventRow, url: string, confidence = 100): GdeltMentionRow {
  return { eventId: event.id, eventAdded: T0, at: T0 + 15 * 60_000, type: 1, source: outletOf(url), url, confidence, tone: 0 };
}

describe('familyOf', () => {
  it('splits the CAMEO root codes', () => {
    expect(['01', '09', '10', '13', '14', '15', '17', '18', '20'].map(familyOf)).toEqual([
      'cooperation', 'cooperation', 'tension', 'tension', 'protest', 'tension', 'tension', 'violence', 'violence',
    ]);
  });
});

describe('reduceEvents', () => {
  it('joins articles whose slugs share two topic words, and drops a lone report beside them', () => {
    const events = [
      row('https://www.aljazeera.com/news/2026/10/12/houthi-missile-attack-targets-saudi-capital-riyadh'),
      row('https://www.smh.com.au/world/the-hard-to-stop-houthi-missiles-that-might-make-trump-think-twice'),
      row('https://www.example.com/news/riyadh-restaurant-week-opens-downtown'),
    ];
    const { markers } = reduceEvents({ events });
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ reports: 2, outlets: 2, family: 'violence', precision: 'city' });
    expect(markers[0].links.map(l => l.outlet)).toEqual(['aljazeera.com', 'smh.com.au']);
    expect(markers[0].links[0].title).toBe('Houthi missile attack targets saudi capital riyadh');
  });

  it('keeps unrelated stories at one place apart', () => {
    // The Texas marker that started this: five stories GDELT happened to place in one state.
    const events = [
      row('https://www.kltv.com/2026/10/12/final-preparations-underway-vice-president-visit-tyler/', TEXAS),
      row('https://www.crossroadstoday.com/victoria-man-sentenced-child-abuse/', TEXAS),
      row('https://www.chron.com/food/whirlwind-of-fun-piccadilly-squares-lockheart-restaurant/', TEXAS),
    ];
    expect(reduceEvents({ events }).markers).toHaveLength(0);
    const [single] = reduceEvents({ events }, { minReports: 1 }).markers;
    expect(single.reports).toBe(1);
    expect(single.others).toHaveLength(2);
  });

  it('joins a later article GDELT matched to the event when the slugs agree on a word', () => {
    const source = row('https://www.aljazeera.com/news/houthi-missile-attack-targets-saudi-capital-riyadh');
    const later = 'https://www.straitstimes.com/world/skies-over-saudi-capital-largely-empty-after-deadly-houthi-strikes';
    const unrelated = 'https://www.kirklandreporter.com/news/election-candidates-from-districts-face-off-in-kent';
    const { markers } = reduceEvents({ events: [source], mentions: [mention(source, later), mention(source, unrelated)] });
    expect(markers[0].links.map(l => l.outlet)).toEqual(['aljazeera.com', 'straitstimes.com']);
  });

  it('ignores mentions GDELT is unsure of', () => {
    const source = row('https://www.aljazeera.com/news/houthi-missile-attack-targets-saudi-capital-riyadh');
    const later = 'https://www.straitstimes.com/world/skies-over-saudi-capital-largely-empty-after-deadly-houthi-strikes';
    expect(reduceEvents({ events: [source], mentions: [mention(source, later, 20)] }).markers).toHaveLength(0);
  });

  it('counts a syndicated headline once', () => {
    const events = [
      row('https://www.camdencourier.com.au/story/smartraveller-downgrades-uae-and-qatar-advice/'),
      row('https://www.examiner.com.au/story/smartraveller-downgrades-uae-and-qatar-advice/'),
    ];
    expect(reduceEvents({ events }).markers).toHaveLength(0);
    expect(reduceEvents({ events }, { minReports: 1 }).markers[0]).toMatchObject({ reports: 1, outlets: 2, articles: 2 });
  });

  it('ignores words found at many places', () => {
    const events = Array.from({ length: 25 }, (_, i) =>
      row(`https://www.example${i}.com/news/trump-police-story-number-${'abcdefghijklmnopqrstuvwxy'[i]}`, { featureId: `F${i}` }));
    events.push(row('https://www.kob.com/news/trump-police-budget-hearing-delayed'));
    events.push(row('https://www.wsbtv.com/news/trump-police-union-endorses-candidate'));
    expect(reduceEvents({ events }).markers).toHaveLength(0);
  });

  it('places a story once, where it is biggest', () => {
    const shared = 'https://www.fox29.com/news/selma-blair-arrested-attacking-flight-attendants';
    const ny = { place: 'New York, United States', country: 'US', featureId: 'NY', lat: 42.1497, lng: -74.9384, geoType: 2 };
    const events = [
      row(shared, ny),
      row('https://www.wfdd.org/actor-selma-blair-removed-from-plane-by-police-after-altercation', ny),
      row('https://lethbridgeherald.com/selma-blair-arrested-in-new-york-after-alleged-assault', ny),
      row(shared),
      row('https://www.newsday.com/entertainment/selma-blair-plane-arrest'),
    ];
    const { markers } = reduceEvents({ events });
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ place: 'New York, United States', reports: 3, precision: 'region' });
  });

  it('takes the family from the story, not from each row', () => {
    const url = 'https://www.fox29.com/news/selma-blair-arrested-attacking-flight-attendants';
    const other = 'https://www.wfdd.org/actor-selma-blair-removed-from-plane-after-altercation';
    const consult = { code: '040', rootCode: '04', quad: 1, goldstein: 1 };
    const events = [row(url, consult), row(url, consult), row(url), row(other, consult)];
    expect(reduceEvents({ events }).markers[0].family).toBe('violence');
    expect(reduceEvents({ events: [...events, row(other, consult)] }).markers[0].family).toBe('cooperation');
    expect(reduceEvents({ events }, { families: ['protest'] }).markers).toHaveLength(0);
  });

  it('moves a story to a place its URLs name', () => {
    // From the translated feed, 2026-10-13: GDELT put the Jalisco water protests in London.
    const london = { place: 'London, London, City of, United Kingdom', country: 'UK', featureId: '-2601889', lat: 51.5142, lng: -0.0931, geoType: 4 };
    const guadalajara = { place: 'Guadalajara, Jalisco, Mexico', country: 'MX', featureId: '-1572245', lat: 20.6667, lng: -103.333, geoType: 4 };
    const lemus = 'https://www.sdpnoticias.com/estados/jalisco/pablo-lemus-acusa-a-grupo-de-choque-de-provocar-violencia-en-marcha-por-agua-en-guadalajara/';
    const casa = 'https://www.eluniversal.com.mx/tendencias/represion-en-casa-jalisco-cual-es-la-lista-de-los-manifestantes-detenidos-y-desaparecidos-tras-la-marcha-por-el-agua-limpia/';
    const events = [row(lemus, london), row(casa, london), row(casa, guadalajara)];
    expect(reduceEvents({ events }).markers.map(m => m.place)).toEqual(['Guadalajara, Jalisco, Mexico']);
    // No Guadalajara row of its own: the city is found among the other places, named in full by the URLs.
    const tammy = 'https://www.elfinanciero.com.mx/espectaculos/2026/10/12/tammy-parra-y-otros-influencers-relatan-que-paso-en-la-marcha-por-el-agua-en-guadalajara/';
    const elsewhere = row('https://www.sdpnoticias.com/estados/jalisco/gobierno-de-jalisco-informa-sobre-la-detencion-de-39-personas', guadalajara);
    const village = row('https://www.example.mx/notas/baja-california-ejido-news-roundup', { place: 'Jalisco, Baja California, Mexico', country: 'MX', featureId: '-1567001', lat: 32.5, lng: -116.9 });
    expect(reduceEvents({ events: [row(lemus, london), row(tammy, london), village, elsewhere] }).markers.map(m => m.place)).toEqual(['Guadalajara, Jalisco, Mexico']);
    expect(reduceEvents({ events: events.slice(0, 2) }).markers.map(m => m.place)).toEqual(['London, London, City of, United Kingdom']);
  });

  it('gives country centroids and unplaced events no marker', () => {
    const events = [
      row('https://www.rte.ie/news/2026/1012/russia-threatens-france-supermarket-cyberattack/', { geoType: 1 }),
      row('https://www.gdnonline.com/news/russia-threatens-france-supermarket-cyberattack/', { geoType: 1 }),
      row('https://news4sanantonio.com/news/teen-in-pieper-high-school-lockdown', { geoType: 0, lat: NaN, lng: NaN }),
    ];
    expect(reduceEvents({ events }, { minReports: 1 }).markers).toHaveLength(0);
  });

  it('reads the real export', () => {
    const events = parseEvents(readFileSync(new URL('./fixtures/export.tsv', import.meta.url), 'utf8'));
    const { markers, stats } = reduceEvents({ events });
    expect(stats).toMatchObject({ rows: 35, stories: 1, markers: 1 });
    expect(markers[0]).toMatchObject({ place: 'Riyadh, Ar Riya?, Saudi Arabia', family: 'violence', reports: 2 });
    expect(reduceEvents({ events }, { minReports: 1, limit: 3 }).markers).toHaveLength(3);
  });
});
