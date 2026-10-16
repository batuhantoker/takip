import { msAt, type SeriesPayload, type ShapePoint, yearAt } from './series';

/*
 * Projections are stored beside the estimates as metrics of their own (tools/import): `<code>.proj` for the
 * publisher's main scenario, `<code>.proj.<scenario>` for the others, and a published range around one as `….lo`
 * and `….hi`. The series API never serves one as another. History joins them per country and keeps where each
 * country's projections start, so every projected year can be drawn and labelled as one.
 */

export type Scenario = { id: string; label: string };

type Publisher = {
  prefix: string;
  /** "UN projection"; with a scenario, "UN projection (medium variant)". */
  name: string;
  /** Where room is tight. */
  short: string;
  /** The main scenario (`.proj`, id '') first. */
  scenarios: Scenario[];
  /** What `.lo` to `.hi` spans. */
  range?: string;
  /** Set when the series before the projections is a model's own run, not observation: what to call it. */
  simulated?: string;
};

/** Metric code prefixes whose source publishes projections, and what its projections and scenarios are called. */
const PUBLISHERS: Publisher[] = [
  {
    prefix: 'wpp:',
    name: 'UN projection',
    short: 'UN projection',
    scenarios: [
      { id: '', label: 'medium variant' },
      { id: 'high', label: 'high variant' },
      { id: 'low', label: 'low variant' },
      { id: 'constant-fertility', label: 'constant-fertility variant' },
      { id: 'zero-migration', label: 'zero-migration variant' },
    ],
    range: '95% prediction interval',
  },
  { prefix: 'wup:', name: 'UN projection', short: 'UN projection', scenarios: [{ id: '', label: 'World Urbanization Prospects 2025' }] },
  { prefix: 'idb:', name: 'US Census projection', short: 'Census projection', scenarios: [{ id: '', label: '' }] },
  { prefix: 'gep:', name: 'World Bank forecast', short: 'World Bank forecast', scenarios: [{ id: '', label: 'Global Economic Prospects, June 2026' }] },
  { prefix: 'imf:', name: 'IMF projection', short: 'IMF projection', scenarios: [{ id: '', label: 'World Economic Outlook, October 2026' }] },
  {
    prefix: 'oecd-lt:',
    name: 'OECD long-term scenario',
    short: 'OECD scenario',
    scenarios: [
      { id: '', label: 'business as usual, median climate damage' },
      { id: 'bau2', label: 'business as usual, high climate damage' },
      { id: 'et1', label: 'faster energy transition, median damage, costs fall slowly' },
      { id: 'et2', label: 'faster energy transition, median damage, costs fall fast' },
      { id: 'et3', label: 'faster energy transition, high damage, costs fall slowly' },
      { id: 'et4', label: 'faster energy transition, high damage, costs fall fast' },
    ],
  },
  {
    prefix: 'cckp:',
    name: 'CMIP6 model median',
    short: 'Climate model',
    scenarios: [
      { id: '', label: 'SSP2-4.5, middle of the road' },
      { id: 'ssp119', label: 'SSP1-1.9, very low emissions, scaled from the others' },
      { id: 'ssp126', label: 'SSP1-2.6, low emissions' },
      { id: 'ssp370', label: 'SSP3-7.0, high emissions' },
      { id: 'ssp585', label: 'SSP5-8.5, very high emissions' },
    ],
    range: 'models’ 10th–90th percentile',
    simulated: 'CMIP6 historical run, model median',
  },
];

export type Projection = {
  /** The projection metric joined. */
  code: string;
  /** "UN projection (medium variant)"; `short` where room is tight. */
  label: string;
  short: string;
  scenario: string;
  /** The scenarios this metric has, the one shown among them. */
  scenarios: Scenario[];
  /** First and last projected year; `starts` holds each country's own first. */
  from: number;
  to: number;
  starts: Record<string, number>;
  /** The publisher's range around each projected value, where it publishes one. */
  range?: { label: string; lo: Record<string, ShapePoint[]>; hi: Record<string, ShapePoint[]> };
  /** The years before the projections are a model's run up to `to`, marked like them but called `label`. */
  simulated?: { label: string; to: number };
};

const PROJ = /\.proj(\..*)?$/;

export const isProjectionCode = (code: string) => PROJ.test(code);

/** The estimates a projection metric extends; any other code is its own base. */
export const baseCode = (code: string) => code.replace(PROJ, '');

const publisherOf = (code: string) => PUBLISHERS.find(p => code.startsWith(p.prefix));

/** Whether the metric's source publishes projections worth looking for. */
export const mayProject = (code: string) => !isProjectionCode(code) && !!publisherOf(code);

export type ProjectionPlan = { main: string; lo?: string; hi?: string; scenario: Scenario; scenarios: Scenario[]; name: string; short: string; range?: string; simulated?: string };

/**
 * Which metrics to fetch for `scenario` of `code`, given the metric codes the catalogue lists (null when it couldn't
 * be read: then the main scenario is tried alone). An unlisted scenario falls back to the main one.
 */
export function projectionPlan(code: string, scenario: string | undefined, listed: ReadonlySet<string> | null): ProjectionPlan | null {
  const pub = mayProject(code) ? publisherOf(code)! : undefined;
  if (!pub) return null;
  const codeOf = (id: string) => `${code}.proj${id ? `.${id}` : ''}`;
  const main = pub.scenarios[0];
  const named = { name: pub.name, short: pub.short, ...(pub.simulated && { simulated: pub.simulated }) };
  if (!listed) return { main: codeOf(''), scenario: main, scenarios: [main], ...named };
  const scenarios = pub.scenarios.filter(s => listed.has(codeOf(s.id)));
  if (!scenarios.length) return null;
  const chosen = scenarios.find(s => s.id === scenario) ?? scenarios[0];
  const at = codeOf(chosen.id);
  const ranged = !!pub.range && listed.has(`${at}.lo`) && listed.has(`${at}.hi`);
  return { main: at, scenario: chosen, scenarios, ...named, ...(ranged && { lo: `${at}.lo`, hi: `${at}.hi`, range: pub.range }) };
}

/**
 * The estimates with their projections after them, per country, each country's projections starting where its own
 * do. Only a yearly projection from the same source joins; anything else would pass one publisher's projection off
 * as another's series.
 */
export function withProjection(est: SeriesPayload, proj: SeriesPayload, plan: ProjectionPlan, range?: { lo: SeriesPayload; hi: SeriesPayload }): SeriesPayload {
  if (!proj.years || proj.source.code !== est.source.code || est.step === 'day' || proj.step === 'day') return est;
  const starts: Record<string, number> = {};
  for (const [key, points] of Object.entries(proj.values)) if (points.length) starts[key] = points[0][0];
  const values: Record<string, ShapePoint[]> = {};
  for (const key of new Set([...Object.keys(est.values), ...Object.keys(proj.values)])) {
    const start = starts[key];
    values[key] = [...(est.values[key] ?? []).filter(p => start === undefined || p[0] < start), ...(proj.values[key] ?? [])];
  }
  // A simulated past is no more measured than the projections: marked from its first year.
  if (plan.simulated) for (const [key, points] of Object.entries(values)) if (points.length) starts[key] = points[0][0];
  const from = Math.min(...Object.values(starts));
  const label = plan.scenario.label ? `${plan.name} (${plan.scenario.label})` : plan.name;
  return {
    ...est,
    values,
    names: { ...est.names, ...proj.names },
    years: [Math.min(est.years?.[0] ?? from, from), proj.years[1]],
    projection: {
      code: proj.metric.code, label, short: plan.short, scenario: plan.scenario.id, scenarios: plan.scenarios,
      from, to: proj.years[1], starts,
      ...(range && plan.range && { range: { label: plan.range, lo: range.lo.values, hi: range.hi.values } }),
      ...(plan.simulated && est.years && { simulated: { label: plan.simulated, to: est.years[1] } }),
    },
  };
}

/** What a value in `year` is: the simulated run's name up to its end, the projection's after. */
export const labelAt = (p: Projection, year: number) => (p.simulated && year <= p.simulated.to ? p.simulated.label : p.label);

/** The last moment the projections cover: the end of their last year. */
export const projectionEnd = (p: Projection) => msAt(p.to + 1) - 1;

/** Whether epoch ms `t` falls in the projected years of any country. */
export const projectedAt = (p: Projection | null | undefined, t: number) => !!p && Math.floor(yearAt(t)) >= p.from;

/** Whether every country's projections start in the same year. */
export const startsTogether = (p: Projection) => Object.values(p.starts).every(s => s === p.from);

/** The year the last country's projections start: from then on every value shown is projected. */
export const lastStart = (p: Projection) => Math.max(p.from, ...Object.values(p.starts));

/** "projected from 2024", or "projected from 2008–2026 by country". */
export const startText = (p: Projection) => (startsTogether(p) ? `projected from ${p.from}` : `projected from ${p.from}–${lastStart(p)} by country`);

/** Whether every country is projected at epoch ms `t`, not only some. */
export const allProjectedAt = (p: Projection | null | undefined, t: number) => !!p && Math.floor(yearAt(t)) >= lastStart(p);
