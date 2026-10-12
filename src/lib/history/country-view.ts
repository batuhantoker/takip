import type { ReplayClock } from '@/lib/replay/clock';
import { type CatalogueMetric, msAt, type Reading, type Scale, type SeriesPayload, type ShapePoint, scaleFor, yearAt } from './series';

/*
 * Which metric History colours countries by, shared by the panel, the legend and the map layer outside
 * React. The metric's whole series is fetched once (replay-database.md §8.6).
 */

export const VIEW_GROUPS: { label: string; views: { code: string; label: string }[] }[] = [
  { label: 'Health', views: [
    { code: 'owid:le_0', label: 'Life expectancy' },
    { code: 'owid:child_mortality', label: 'Child mortality, since 1751' },
    { code: 'wdi:SP.DYN.IMRT.IN', label: 'Infant mortality' },
    { code: 'owid:water_safely_managed', label: 'Safe drinking water' },
    { code: 'owid:prev_depression', label: 'Depression' },
    { code: 'owid:suicide_rate', label: 'Suicide rate' },
  ] },
  { label: 'COVID-19', views: [
    { code: 'owid:covid_weekly_deaths_pm', label: 'COVID-19 deaths, weekly' },
    { code: 'owid:covid_weekly_cases_pm', label: 'COVID-19 cases, weekly' },
    { code: 'owid:covid_vaccinated', label: 'Vaccinated against COVID-19' },
  ] },
  { label: 'People', views: [
    { code: 'owid:population', label: 'Population' },
    { code: 'wdi:SP.DYN.TFRT.IN', label: 'Fertility rate' },
    { code: 'wdi:SP.URB.TOTL.IN.ZS', label: 'Urban population' },
  ] },
  { label: 'Conflict', views: [
    { code: 'owid:conflict_deaths_all', label: 'Deaths in conflicts' },
    { code: 'wdi:MS.MIL.XPND.GD.ZS', label: 'Military spending' },
  ] },
  { label: 'Politics', views: [
    { code: 'owid:electdem_vdem', label: 'Electoral democracy, since 1789' },
    { code: 'owid:civlibs_vdem', label: 'Human rights, since 1789' },
  ] },
  { label: 'Economy', views: [
    { code: 'wdi:NY.GDP.PCAP.KD', label: 'GDP per person' },
    { code: 'owid:gdp_pc_maddison', label: 'GDP per person, since 1 CE' },
    { code: 'wdi:FP.CPI.TOTL.ZG', label: 'Inflation' },
  ] },
  { label: 'Education', views: [
    { code: 'owid:lays', label: 'Learning-adjusted schooling' },
    { code: 'owid:ner_primary_f', label: 'Girls in primary school' },
    { code: 'wdi:SE.ADT.LITR.ZS', label: 'Adult literacy' },
  ] },
  { label: 'Technology and environment', views: [
    { code: 'wdi:IT.NET.USER.P2', label: 'Internet users' },
    { code: 'wdi:EG.ELC.ACCS.ZS', label: 'Access to electricity' },
    { code: 'wdi:EN.ATM.CO2E.PC', label: 'CO₂ per person' },
    { code: 'wdi:AG.LND.FRST.ZS', label: 'Forest area' },
  ] },
];

export type CountryViewState =
  | { status: 'off' }
  | { status: 'loading'; code: string }
  | { status: 'ready'; code: string; data: SeriesPayload; scale: Scale }
  | { status: 'error'; code: string; message: string };

export type HoveredCountry = { key: string; name: string; reading: Reading | null };

export type CountryView = {
  state(): CountryViewState;
  /**
   * null turns the view off; `source` picks among the sources publishing the metric. When the clock is
   * outside the metric's years it moves to where most countries have data, at a year a second or faster
   * (a week a second for a weekly series).
   */
  select(code: string | null, source?: string): void;
  /** Whether the map is dark, which flips the ramp; set by the map layer, read by the legend. */
  dark(): boolean;
  setDark(dark: boolean): void;
  hovered(): HoveredCountry | null;
  setHovered(h: HoveredCountry | null): void;
  /** Every mappable metric, fetched once. */
  catalogue(): Promise<CatalogueMetric[]>;
  subscribe(listener: () => void): () => void;
};

const PAYLOAD_CACHE = 6;
const YEAR_SPEED = 365 * 86_400;
const WEEK_SPEED = 7 * 86_400;
function utcYearStart(year: number) {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  return d.getTime();
}

/** The first year by which half the countries the metric covers have a value. */
export function busyFrom(values: Record<string, readonly ShapePoint[]>): number | null {
  const firsts = Object.values(values).map(p => p[0]?.[0]).filter((y): y is number => y !== undefined).sort((a, b) => a - b);
  return firsts.length ? firsts[Math.floor((firsts.length - 1) / 2)] : null;
}

function seekInto(clock: ReplayClock, data: SeriesPayload) {
  if (!data.years) return;
  const y = yearAt(clock.time());
  const [first, last] = data.years;
  if (data.step === 'day') {
    if (y >= first && y <= last) return;
    clock.seek(msAt(busyFrom(data.values) ?? first));
    clock.setSpeed(WEEK_SPEED);
    return;
  }
  if (y >= first && y < last + 1) return;
  clock.seek(utcYearStart(busyFrom(data.values) ?? first));
  if (clock.speed() < YEAR_SPEED) clock.setSpeed(YEAR_SPEED);
}

export function createCountryView(clock: ReplayClock, get: typeof fetch = fetch): CountryView {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());
  const payloads = new Map<string, Promise<SeriesPayload>>();
  let state: CountryViewState = { status: 'off' };
  let hovered: HoveredCountry | null = null;
  let dark = true;
  let catalogue: Promise<CatalogueMetric[]> | null = null;
  let generation = 0;

  const load = (code: string, source?: string) => {
    const key = source ? `${code}?source=${source}` : code;
    let p = payloads.get(key);
    if (p) payloads.delete(key);
    else {
      const url = `/api/replay/history/series/${encodeURIComponent(code)}${source ? `?source=${encodeURIComponent(source)}` : ''}`;
      p = get(url).then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(res.status === 429 ? 'Too many requests, try again in a moment' : body.message ?? body.error ?? `HTTP ${res.status}`);
        return body as SeriesPayload;
      });
      p.catch(() => payloads.delete(key));
    }
    payloads.set(key, p);
    while (payloads.size > PAYLOAD_CACHE) payloads.delete(payloads.keys().next().value!);
    return p;
  };

  return {
    state: () => state,
    select(code, source) {
      const mine = ++generation;
      hovered = null;
      if (!code) {
        state = { status: 'off' };
        emit();
        return;
      }
      state = { status: 'loading', code };
      emit();
      load(code, source).then(
        data => {
          if (mine !== generation) return;
          const scale = scaleFor(data.values);
          state = scale ? { status: 'ready', code, data, scale } : { status: 'error', code, message: 'No country values for this metric' };
          if (scale) seekInto(clock, data);
          emit();
        },
        (e: Error) => {
          if (mine !== generation) return;
          state = { status: 'error', code, message: e.message };
          emit();
        },
      );
    },
    dark: () => dark,
    setDark(next) {
      if (next === dark) return;
      dark = next;
      emit();
    },
    hovered: () => hovered,
    setHovered(h) {
      if (h?.key === hovered?.key && h?.reading?.shown === hovered?.reading?.shown) return;
      hovered = h;
      emit();
    },
    catalogue() {
      catalogue ??= get('/api/replay/history/series')
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then(body => (body as { metrics: CatalogueMetric[] }).metrics);
      catalogue.catch(() => { catalogue = null; });
      return catalogue;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
