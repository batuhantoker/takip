import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { Bbox } from '@/lib/map/embed/spec';
import { DESCRIPTION_RANGE, fit, nameOf, placeFirst, TITLE_MAX } from '../copy/format';
import { placeBox } from '../paths';
import type { Place } from '../place';
import { tableRow, topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { HAZARD_RANGES, type HazardMeta, type HazardRangeId, type HazardRow } from './hazards-data';
import { hazardDate, hazardFacts, hazardSentences, type HazardFacts } from './hazards-facts';
import { hazardsNow, type HazardsNow } from './hazards-now';

/**
 * Earthquakes, tsunamis and eruptions at /country/<place>/earthquakes-last-10-years, -last-100-years and
 * /earthquake-history, and the same for cities where they cluster: what USGS ComCat and NOAA's significant-event
 * lists hold for that place over each span (tools/site/topics/hazards.ts). Indexed from five distinct events.
 */

export interface HazardData { facts: HazardFacts; box: Bbox }

const SLUG: Record<HazardRangeId, string> = { '10y': 'earthquakes-last-10-years', '100y': 'earthquakes-last-100-years', all: 'earthquake-history' };
const LABEL: Record<HazardRangeId, string> = { '10y': msg('Earthquakes, 10 years'), '100y': msg('Earthquakes, 100 years'), all: msg('Earthquake history') };

const table = () => topicTable<HazardRow, HazardMeta>('hazards');

const scopeVars = (f: HazardFacts, place: Place, t: Translate) => ({ scope: f.scope, place: nameOf(place, t) });

/** The strongest's date, or the dates of those sharing its magnitude: both of two, the latest of more. */
function strongestDates(f: HazardFacts, t: Translate) {
  const s = f.strongest;
  const year = (d: string) => hazardDate(/^-?\d+/.exec(d)![0], t);
  if (!s) return { tie: 'one', date: '', date2: '', year: '', year2: '', k: 0 };
  if (!f.tie) return { tie: 'one', date: hazardDate(s.d, t), date2: '', year: year(s.d), year2: '', k: 1 };
  const [a, b] = f.tie.named;
  return f.tie.n === 2 && b
    ? { tie: 'two', date: hazardDate(a.d, t), date2: hazardDate(b.d, t), year: year(a.d), year2: year(b.d), k: 2 }
    : { tie: 'many', date: hazardDate(a.d, t), date2: '', year: year(a.d), year2: '', k: f.tie.n };
}

/** The first year as words: "2017", "1301 BCE". */
const fromWord = (f: HazardFacts, t: Translate) => hazardDate(String(f.range === 'all' && f.usgs > 0 && f.quakes === 0 ? f.usgsFrom : f.from), t);

export const HAZARDS: PlaceTopic<HazardData, HazardsNow> = {
  id: 'hazards',
  label: msg('Earthquakes'),
  inline: msg('earthquakes'),
  kinds: ['country', 'city'],

  pages(place) {
    const { meta } = table();
    const row = tableRow<HazardRow>('hazards', place.id);
    const kind = place.kind;
    if (!row || !meta || (kind !== 'city' && kind !== 'country')) return [];
    const box: Bbox = row.box ?? placeBox(place, meta.cityKm);
    return HAZARD_RANGES.flatMap(range => {
      const facts = hazardFacts(row, range, meta, kind);
      return facts ? [{ slug: SLUG[range], label: LABEL[range], data: { facts, box }, index: facts.index }] : [];
    });
  },

  header(place, { data: { facts: f } }, t) {
    const name = nameOf(place, t);
    const s = f.strongest;
    const vars = { ...scopeVars(f, place, t), name, n: f.usgs, floor: f.floor, from: String(f.usgsFrom), to: String(f.to), m: s?.m ?? 0, ...strongestDates(f, t) };
    // A page with tsunamis and no quakes (Sri Lanka) says so in its name.
    const waves = f.quakeEvents === 0 && f.tsunamis > 0;
    const sentences = hazardSentences(f, nameOf(place, t), t);
    const span = f.range === '10y' ? 10 : 100;
    const title = f.range === 'all'
      ? fit(placeFirst(place, [
        ...(waves ? [(t: Translate, name: string) => t('{name} earthquake and tsunami history', { name })] : []),
        (t, name) => t('{name} earthquake history, {from} to today', { name, from: fromWord(f, t) }),
        (t, name) => t('{name} earthquake history', { name }),
      ]), t, TITLE_MAX)
      : fit(placeFirst(place, [
        ...(waves ? [(t: Translate, name: string) => t('{name} earthquakes and tsunamis in the last {span} years', { name, span })] : []),
        ...(f.usgs > 0 ? [(t: Translate, name: string) => t('{name} earthquakes in the last {span} years: {n} of M{floor}+', { ...vars, name, span })] : []),
        (t, name) => t('{name} earthquakes in the last {span} years', { name, span }),
        (t, name) => t('{name} earthquakes, last {span} years', { name, span }),
        (t, name) => t('{name} quakes since {from}', { name, from: String(f.from) }),
      ]), t, TITLE_MAX);
    const description = fit([
      ...(f.range === 'all' ? [
        (t: Translate) => t('{place}’s earthquake record from {from}: the strongest and deadliest quakes, tsunamis and eruptions NOAA lists, and USGS’s since 1900, on a free map.', { place: name, from: fromWord(f, t) }),
      ] : []),
      ...(waves && f.waveDeadliest ? [
        (t: Translate) => t('{n, plural, one {One tsunami} other {# tsunamis}} reached {place} from {from} to {to}; the deadliest, on {date}, killed {d} there by NOAA’s runup records. On a free map.', {
          n: f.tsunamis, place: name, from: String(f.from), to: String(f.to), date: hazardDate(f.waveDeadliest!.e.d, t), d: f.waveDeadliest!.deaths,
        }),
      ] : []),
      ...(f.usgs >= 2 && s ? [
        (t: Translate) => t('{n} earthquakes of magnitude {floor}+ {scope, select, city {near {place}} inland {in {place}} other {in or off {place}}} from {from} to {to}; the strongest, of {m}, {tie, select, two {struck twice, on {date} and {date2}} many {struck {k} times, last on {date}} other {struck on {date}}}. Each on a free map, with deaths from NOAA.', vars),
        (t: Translate) => t('{n} earthquakes of magnitude {floor}+ {scope, select, city {near {place}} inland {in {place}} other {in or off {place}}} from {from} to {to}; the strongest, of {m}, {tie, select, two {struck twice, on {date} and {date2}} many {struck {k} times, last on {date}} other {struck on {date}}}. See them on a free map.', vars),
        (t: Translate) => t('{n} earthquakes of magnitude {floor}+ {scope, select, city {near {place}} inland {in {place}} other {in or off {place}}} from {from} to {to}; the strongest, of {m}, {tie, select, two {struck twice, in {year} and {year2}} many {struck {k} times, last in {year}} other {struck in {year}}}. See them on a free map.', vars),
        (t: Translate) => t('{n} earthquakes of magnitude {floor}+ {scope, select, city {near {place}} inland {in {place}} other {in or off {place}}} from {from} to {to}, with the strongest and the deadliest, on a free map.', vars),
      ] : []),
      t => t('Earthquakes {scope, select, city {near {place}} inland {in {place}} other {in or off {place}}} from {from} to {to}: how many USGS recorded, the strongest, the deadliest and NOAA’s significant ones, on a free map.', vars),
      t => t('Earthquakes {scope, select, city {near {place}} inland {in {place}} other {in or off {place}}} from {from} to {to}: the count, the strongest and the deadliest, from USGS and NOAA, on a free map.', vars),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]);
    return {
      title,
      description,
      heading: f.range === 'all'
        ? t('{scope, select, city {Earthquakes near {place}} other {Earthquakes in {place}}} through history', scopeVars(f, place, t))
        : waves
          ? t('{scope, select, city {Earthquakes and tsunamis near {place}} other {Earthquakes and tsunamis in {place}}}, {from}–{to}', { ...scopeVars(f, place, t), from: String(f.from), to: String(f.to) })
          : t('{scope, select, city {Earthquakes near {place}} other {Earthquakes in {place}}}, {from}–{to}', { ...scopeVars(f, place, t), from: String(f.from), to: String(f.to) }),
      lede: sentences.slice(0, 2).join(' '),
    };
  },

  summary(place, { data: { facts: f } }, t) {
    const s = f.strongest;
    if (f.quakeEvents === 0 && f.tsunamis > 0) {
      const wd = f.waveDeadliest;
      return wd
        ? t('{n, plural, one {One tsunami} other {# tsunamis}} on NOAA’s list; the deadliest killed {d} here, {date}.', { n: f.tsunamis, d: wd.deaths, date: hazardDate(wd.e.d, t) })
        : t('{n, plural, one {One tsunami} other {# tsunamis}} on NOAA’s list.', { n: f.tsunamis });
    }
    if (f.usgs >= 2 && s?.m !== undefined) {
      return t('{n} of magnitude {floor}+ from {from}; the strongest {m}, {tie, select, two {twice: {date} and {date2}} many {{k} times, last {date}} other {{date}}}.', { n: f.usgs, floor: f.floor, from: String(f.usgsFrom), m: s.m, ...strongestDates(f, t) });
    }
    if (f.quakes > 0) return t('{n, plural, one {One earthquake} other {# earthquakes}} on NOAA’s list of significant ones, from {from}.', { n: f.quakes, from: fromWord(f, t) });
    return hazardSentences(f, nameOf(place, t), t)[0];
  },

  open(place, { data: { facts: f, box } }) {
    // History's clock reaches back to 3000 BCE.
    const from = Math.max(f.from, -2999);
    return {
      zoom: place.kind === 'city' ? 7 : undefined,
      mode: { view: 'history', year: from, layer: null, range: { from, to: f.to }, families: ['hazard'] },
      embed: {
        layers: ['earthquakes'], bbox: box, minMag: f.floor,
        // Up to the day counted to, as data/site/earthquakes.json holds it, so the map answers from disk.
        window: { from: Date.UTC(f.usgsFrom, 0, 1), to: Date.parse(f.asOf) },
      },
    };
  },

  live: (place, { data: { box } }) => hazardsNow(place, box, table().meta?.cityKm),
  liveLabel: msg('The last 30 days · as of {time}'),
};

export type HazardPage = TopicPage<HazardData>;
