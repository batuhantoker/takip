import type { ReplayClock } from '@/lib/map/replay/clock';
import { baseCode, mayProject, type Projection, projectionPlan, withProjection } from '../projection';
import { type CatalogueMetric, msAt, type Reading, type Scale, type SeriesPayload, type ShapePoint, scaleFor, yearAt } from '../series';

/*
 * Which metric History colours countries by, shared by the panel, the legend and the map layer outside
 * React. The metric's whole series is fetched once (replay-database.md §8.6), with its projections when
 * the source publishes them (projection.ts).
 */

/** `projectedTo`: the picker adds "projected to <year>"; the legend keeps the shorter label. */
export const VIEW_GROUPS: { label: string; views: { code: string; label: string; projectedTo?: number }[] }[] = [
  { label: 'Health', views: [
    { code: 'wpp:LEx', label: 'Life expectancy', projectedTo: 2100 },
    { code: 'owid:le_0', label: 'Life expectancy, since 1543' },
    { code: 'owid:child_mortality', label: 'Child mortality, since 1751' },
    { code: 'wpp:IMR', label: 'Infant mortality', projectedTo: 2100 },
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
    { code: 'wpp:TPopulation1July', label: 'Population', projectedTo: 2100 },
    { code: 'owid:population', label: 'Population, long run' },
    { code: 'wpp:PopGrowthRate', label: 'Population growth', projectedTo: 2100 },
    { code: 'wpp:TFR', label: 'Fertility rate', projectedTo: 2100 },
    { code: 'wup:UrbanShare', label: 'Urban population', projectedTo: 2050 },
    { code: 'wup:CityShare', label: 'People living in cities', projectedTo: 2050 },
    { code: 'wpp:MedianAgePop', label: 'Median age', projectedTo: 2100 },
    { code: 'wpp:Share65', label: 'People aged 65 and over', projectedTo: 2100 },
    { code: 'wpp:OldAgeDep', label: 'Old-age dependency', projectedTo: 2100 },
    { code: 'wpp:CNMR', label: 'Net migration rate', projectedTo: 2100 },
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
    { code: 'oecd-lt:GDPVD_CAP', label: 'GDP per person, OECD scenarios', projectedTo: 2100 },
    { code: 'imf:NGDP_RPCH', label: 'GDP growth', projectedTo: 2031 },
    { code: 'gep:NYGDPMKTPKDZ', label: 'GDP growth, World Bank forecast', projectedTo: 2028 },
    { code: 'imf:PCPIPCH', label: 'Inflation', projectedTo: 2031 },
    { code: 'imf:GGXWDG_NGDP', label: 'Government debt', projectedTo: 2031 },
  ] },
  { label: 'Education', views: [
    { code: 'owid:lays', label: 'Learning-adjusted schooling' },
    { code: 'owid:ner_primary_f', label: 'Girls in primary school' },
    { code: 'wdi:SE.ADT.LITR.ZS', label: 'Adult literacy' },
  ] },
  { label: 'Climate', views: [
    { code: 'cckp:hd35', label: 'Days above 35 °C, modelled', projectedTo: 2100 },
    { code: 'cckp:tas', label: 'Mean temperature, modelled', projectedTo: 2100 },
    { code: 'cckp:tr', label: 'Tropical nights, modelled', projectedTo: 2100 },
    { code: 'era5:tas', label: 'Mean temperature, observed' },
    { code: 'oecd-lt:CO2', label: 'CO₂ emissions, OECD scenarios', projectedTo: 2100 },
  ] },
  { label: 'Technology and environment', views: [
    { code: 'wdi:IT.NET.USER.ZS', label: 'Internet users' },
    { code: 'wdi:EG.ELC.ACCS.ZS', label: 'Access to electricity' },
    { code: 'wdi:EN.GHG.CO2.PC.CE.AR5', label: 'CO₂ per person' },
    { code: 'wdi:AG.LND.FRST.ZS', label: 'Forest area' },
  ] },
];

export type CountryViewState =
  | { status: 'off' }
  | { status: 'loading'; code: string }
  | { status: 'ready'; code: string; data: SeriesPayload; scale: Scale }
  | { status: 'error'; code: string; message: string };

/** A picked metric; the one colouring the map is `state()` itself. */
export type CountryPick = Exclude<CountryViewState, { status: 'off' }>;

/** The picks in order, to put back with `restore`. */
export type PicksSnapshot = { codes: string[]; coloured: string; source?: string; scenario?: string };

export type HoveredCountry = { key: string; name: string; reading: Reading | null };

/** How many metrics the picker lets a person read at once. */
export const MAX_PICKS = 10;

export type CountryView = {
  /** The metric colouring the map. */
  state(): CountryViewState;
  /**
   * Colours the map by `code`, adding it to the picks; the one colouring before stays picked. null drops every
   * pick. `source` picks among the sources publishing the metric. When the clock is outside the metric's years it
   * moves to where most countries have data, at a year a second or faster (a week a second for a weekly series).
   * A projection code selects the estimates it extends; `scenario` picks among the projections' scenarios.
   */
  select(code: string | null, source?: string, scenario?: string): void;
  /** Every metric picked, in the order picked: the one colouring the map and the ones read beside it. */
  picks(): CountryPick[];
  /** Drops a pick; dropping the one colouring the map colours the latest of the rest. */
  remove(code: string): void;
  snapshot(): PicksSnapshot | null;
  restore(snapshot: PicksSnapshot): void;
  /** The projections in view, kept while the next metric loads; the History clock may run to their end. */
  projection(): Projection | null;
  /** Whether the map is dark, which flips the ramp; set by the map layer, read by the legend. */
  dark(): boolean;
  setDark(dark: boolean): void;
  hovered(): HoveredCountry | null;
  setHovered(h: HoveredCountry | null): void;
  /** Every mappable metric, fetched once. */
  catalogue(): Promise<CatalogueMetric[]>;
  subscribe(listener: () => void): () => void;
};

const PAYLOAD_CACHE = MAX_PICKS + 2;
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
  // Past the last values (a series that stops before today), its latest year; before them, where most countries start.
  if (y >= last + 1) {
    clock.seek(msAt(last + 0.5));
    return;
  }
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
  let projection: Projection | null = null;
  /** Pick order, the coloured metric included. */
  let order: string[] = [];
  const others = new Map<string, CountryPick>();

  /** `optional`: a 404 is no series rather than an error. */
  const fetchSeries = (code: string, source?: string, optional = false) => {
    const url = `/api/replay/history/series/${encodeURIComponent(code)}${source ? `?source=${encodeURIComponent(source)}` : ''}`;
    return get(url).then(async res => {
      if (optional && res.status === 404) return null;
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 429 ? 'Too many requests, try again in a moment' : body.message ?? body.error ?? `HTTP ${res.status}`);
      return body as SeriesPayload;
    });
  };

  const listCatalogue = () => {
    catalogue ??= get('/api/replay/history/series')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(body => (body as { metrics: CatalogueMetric[] }).metrics);
    catalogue.catch(() => { catalogue = null; });
    return catalogue;
  };

  /** The estimates, joined with the scenario's projections and range where the catalogue lists them. */
  const withProjections = async (code: string, source: string | undefined, scenario: string | undefined) => {
    const [est, listed] = await Promise.all([
      fetchSeries(code, source) as Promise<SeriesPayload>,
      listCatalogue().then(ms => new Set(ms.map(m => m.code)), () => null),
    ]);
    const plan = projectionPlan(code, scenario, listed);
    if (!plan) return est;
    const [proj, lo, hi] = await Promise.all([
      fetchSeries(plan.main, undefined, true),
      plan.lo ? fetchSeries(plan.lo, undefined, true) : null,
      plan.hi ? fetchSeries(plan.hi, undefined, true) : null,
    ]);
    return proj ? withProjection(est, proj, plan, lo && hi ? { lo, hi } : undefined) : est;
  };

  const load = (code: string, source?: string, scenario?: string) => {
    const key = `${code}?source=${source ?? ''}&scenario=${scenario ?? ''}`;
    let p = payloads.get(key);
    if (p) payloads.delete(key);
    else {
      p = mayProject(code) ? withProjections(code, source, scenario) : fetchSeries(code, source) as Promise<SeriesPayload>;
      p.catch(() => payloads.delete(key));
    }
    payloads.set(key, p);
    while (payloads.size > PAYLOAD_CACHE) payloads.delete(payloads.keys().next().value!);
    return p;
  };

  const settled = (code: string, data: SeriesPayload): CountryPick => {
    const scale = scaleFor(data.values);
    return scale ? { status: 'ready', code, data, scale } : { status: 'error', code, message: 'No country values for this metric' };
  };

  /** Loads a pick that isn't colouring the map; an answer for a pick since dropped or recoloured is ignored. */
  const keep = (code: string) => {
    const pending: CountryPick = { status: 'loading', code };
    others.set(code, pending);
    load(code).then(
      data => {
        if (others.get(code) !== pending) return;
        others.set(code, settled(code, data));
        emit();
      },
      (e: Error) => {
        if (others.get(code) !== pending) return;
        others.set(code, { status: 'error', code, message: e.message });
        emit();
      },
    );
  };

  const select = (code: string | null, source?: string, scenario?: string) => {
    const mine = ++generation;
    hovered = null;
    if (!code) {
      state = { status: 'off' };
      projection = null;
      order = [];
      others.clear();
      emit();
      return;
    }
    code = baseCode(code);
    const kept = others.get(code);
    others.delete(code);
    if (state.status !== 'off' && state.code !== code) {
      if (state.status === 'loading') keep(state.code);
      else others.set(state.code, state);
    }
    if (!order.includes(code)) order = [...order, code];
    // A Moment's metric can push past the picker's cap; the oldest other pick makes room.
    if (order.length > MAX_PICKS) {
      const oldest = order.find(c => c !== code)!;
      order = order.filter(c => c !== oldest);
      others.delete(oldest);
    }
    // A pick already loaded colours at once, with the source it had.
    if (kept?.status === 'ready' && !source && scenario === undefined) {
      state = kept;
      projection = kept.data.projection ?? null;
      seekInto(clock, kept.data);
      emit();
      return;
    }
    state = { status: 'loading', code };
    emit();
    load(code, source, scenario).then(
      data => {
        if (mine !== generation) return;
        state = settled(code, data);
        // Before seeking, so a clock that has to move into the projections may.
        projection = (state.status === 'ready' && data.projection) || null;
        if (state.status === 'ready') seekInto(clock, data);
        emit();
      },
      (e: Error) => {
        if (mine !== generation) return;
        state = { status: 'error', code, message: e.message };
        projection = null;
        emit();
      },
    );
  };

  return {
    state: () => state,
    projection: () => projection,
    select,
    picks: () => order.flatMap(c => {
      if (state.status !== 'off' && state.code === c) return [state];
      const pick = others.get(c);
      return pick ? [pick] : [];
    }),
    remove(code) {
      code = baseCode(code);
      if (!order.includes(code)) return;
      order = order.filter(c => c !== code);
      if (state.status === 'off' || state.code !== code) {
        others.delete(code);
        emit();
        return;
      }
      // Off first, so select doesn't keep the dropped metric as a pick.
      state = { status: 'off' };
      select(order.at(-1) ?? null);
    },
    snapshot() {
      const s = state;
      if (s.status === 'off') return null;
      const scenario = s.status === 'ready' ? s.data.projection?.scenario : undefined;
      return { codes: [...order], coloured: s.code, ...(s.status === 'ready' && { source: s.data.source.code }), ...(scenario && { scenario }) };
    },
    restore({ codes, coloured, source, scenario }) {
      select(null);
      order = [...codes];
      for (const c of codes) if (c !== coloured) keep(c);
      select(coloured, source, scenario);
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
    catalogue: listCatalogue,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
