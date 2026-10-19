import { msg, type Translate } from '@/lib/core/i18n/translator';
import { foldName as fold, PORT_KM, type HarbourSize, type HarbourType, type HarbourUse, type MapPort, type NearPort, type PlacePorts, type PortFacility } from './ports-data';

/**
 * What a place's ports-and-ships page says, worked out from its own row: which harbour it leads with, what kind of
 * port that is, what the World Port Index records there and how well AIS is heard. A container hub, a fishing
 * harbour and a town on a strait get different sentences, not one paragraph with the name swapped.
 */

/**
 * When a port page is worth a search result; below it the page still renders, with noindex, and stays out of the
 * sitemap. Each harbour is credited to one place (the builder's claimant), so Istanbul's districts don't all
 * index the Port of Istanbul.
 */
export const PORT_INDEX = {
  /** A harbour credited to the place, within PORT_KM, that the Index rates at least this size… */
  sizes: ['large', 'medium'] as readonly HarbourSize[],
  /** …or a smaller one where the AIS sample heard at least this many different ships, or a major port the map marks. */
  busyHeard: 50,
  /** And, where the table has an AIS sample, at least this many ships heard where the live line counts. */
  minHeard: 10,
} as const;

/** The map's chokepoints (lib/feeds/maritime/ports.ts keeps them in English for the API), so pages can name them in the reader's language. */
const STRAITS = new Set<string>([
  msg('Strait of Hormuz'), msg('Strait of Malacca'), msg('Suez Canal'), msg('Bab el-Mandeb'), msg('Panama Canal'),
  msg('Turkish Straits'), msg('Danish Straits'), msg('Cape of Good Hope'), msg('Taiwan Strait'), msg('Lombok Strait'),
]);
export const straitName = (name: string, t: Translate) => (STRAITS.has(name) ? t(name) : name);

/** Within this of a chokepoint's point the place is on the strait, not just near it. */
export const STRAIT_KM = 30;

export type PortKind = 'container-hub' | 'energy-port' | 'naval-base' | 'strait' | 'ferry' | 'fishing' | 'cargo' | 'river' | 'roadstead' | 'harbour';
export type AisCoverage = 'busy' | 'heard' | 'thin' | 'silent' | 'unknown';

const SIZE_RANK: Record<HarbourSize, number> = { large: 4, medium: 3, small: 2, 'very-small': 1 };
function rank(s?: HarbourSize) {
  return s ? SIZE_RANK[s] : 0;
}
const CARGO: PortFacility[] = ['container', 'roro', 'dry-bulk', 'liquid-bulk', 'breakbulk'];
const has = (p: NearPort, fs: PortFacility[]) => fs.some(f => p.facilities.includes(f));

/** The major port the map marks that this place is credited with, if any. */
export const homeMajor = (d: PlacePorts): MapPort | undefined => (d.major?.home === d.id ? d.major : undefined);

/** The harbour the page leads with: one credited to the place first, then the biggest, then the nearest. */
export function leadPort(d: PlacePorts): NearPort | undefined {
  const within = d.ports.filter(p => p.km <= PORT_KM);
  // An unrated harbour sorts with the very small ones, so a nearer one isn't passed over for it.
  const r = (p: NearPort) => rank(p.size) || 1;
  return [...(within.length ? within : d.ports)]
    .sort((a, b) => Number(b.home === d.id) - Number(a.home === d.id) || r(b) - r(a) || a.km - b.km)[0];
}

/** Where the live line counts ships, and what the AIS sample heard there: a major port at the map's own point for it. */
export function watchPoint(d: PlacePorts): { name: string; at: [number, number]; km: number; heard?: number } | undefined {
  const major = homeMajor(d);
  if (major) return { name: major.name, at: major.at, km: PORT_KM, heard: major.heard };
  const lead = leadPort(d);
  return lead && { name: lead.name, at: lead.at, km: PORT_KM, heard: lead.heard };
}

/** How well AIS is heard where the live line counts. A big port that few ships are heard at is thinly covered, not quiet. */
export function coverageOf(d: PlacePorts): AisCoverage {
  const heard = watchPoint(d)?.heard;
  if (!d.ais || heard === undefined) return 'unknown';
  if (heard === 0) return 'silent';
  const big = !!homeMajor(d) || rank(leadPort(d)?.size) >= 3;
  if (heard < (big ? PORT_INDEX.busyHeard : PORT_INDEX.minHeard)) return 'thin';
  return heard >= 100 ? 'busy' : 'heard';
}

export function portsIndexable(d: PlacePorts): boolean {
  const credited = d.ports.filter(p => p.home === d.id && p.km <= PORT_KM);
  const strong = !!homeMajor(d) || credited.some(p => PORT_INDEX.sizes.includes(p.size!) || (p.heard ?? 0) >= PORT_INDEX.busyHeard);
  if (!strong) return false;
  return !d.ais || (watchPoint(d)?.heard ?? 0) >= PORT_INDEX.minHeard;
}

export function portKind(d: PlacePorts): PortKind {
  const major = homeMajor(d), lead = leadPort(d);
  if (major) return major.type === 'container' ? 'container-hub' : major.type === 'energy' ? 'energy-port' : 'naval-base';
  if (d.chokepoint && d.chokepoint.km <= STRAIT_KM) return 'strait';
  if (!lead) return 'harbour';
  if (lead.use === 'ferry') return 'ferry';
  if (lead.use === 'fishing') return 'fishing';
  if (lead.use === 'military') return 'naval-base';
  if (rank(lead.size) >= 3 && has(lead, ['oil', 'lng'])) return 'energy-port';
  if (lead.use === 'cargo' || (rank(lead.size) >= 3 && has(lead, CARGO))) return 'cargo';
  if (lead.type?.startsWith('river')) return 'river';
  if (lead.type === 'roadstead') return 'roadstead';
  return 'harbour';
}

/** One sentence of the page: which one, and its raw values. renderSentence turns it into the reader's language. */
export type PortSentence =
  | { id: 'hub'; port: string; volume?: string; rank?: number }
  | { id: 'energy-major'; port: string; volume?: string }
  | { id: 'energy-terminals'; port: string; km: number; terminals: PortFacility[] }
  | { id: 'naval'; port: string; fleet?: string }
  | { id: 'strait'; strait: string }
  | { id: 'use'; port: string; use: HarbourUse }
  | { id: 'cargo'; port: string; facilities: PortFacility[] }
  | { id: 'nearest'; port: string; km: number }
  | { id: 'rating'; port: string; size?: HarbourSize; type?: HarbourType }
  | { id: 'facilities'; facilities: PortFacility[] }
  | { id: 'limits'; lengthM?: number; depthM?: number }
  | { id: 'ice' }
  | { id: 'vts' }
  | { id: 'others'; ports: { name: string; km: number }[] }
  | { id: 'major-nearby'; port: string; km: number }
  | { id: 'chokepoint-near'; strait: string; km: number }
  | { id: 'ais-dark' }
  | { id: 'coverage'; level: Exclude<AisCoverage, 'unknown'>; port: string; n: number; hours: number; from: string; to: string; small: boolean };

export interface PortStory {
  kind: PortKind;
  lead: NearPort;
  /** The place this harbour is credited to, when it isn't this one: its page is the one to link to. */
  creditedTo?: number;
  coverage: AisCoverage;
  index: boolean;
  /** Where the live line counts ships, and what the AIS sample heard there. */
  watch: { name: string; at: [number, number]; km: number; heard?: number };
  sentences: PortSentence[];
}

const round = (km: number) => (km < 1 ? 1 : Math.round(km));

/** The page's story for one place; undefined when it has no harbour to lead with. */
export function portStory(d: PlacePorts): PortStory | undefined {
  const lead = leadPort(d), watch = watchPoint(d);
  if (!lead || !watch) return undefined;
  const kind = portKind(d), major = homeMajor(d), coverage = coverageOf(d);
  const s: PortSentence[] = [];
  const terminals: PortFacility[] = lead.facilities.filter(f => f === 'oil' || f === 'lng');
  let facilitiesSaid = false;

  switch (kind) {
    case 'container-hub': s.push({ id: 'hub', port: major!.name, volume: major!.volume, rank: major!.rank }); break;
    case 'energy-port':
      if (major) s.push({ id: 'energy-major', port: major.name, volume: major.volume });
      else s.push({ id: 'energy-terminals', port: lead.name, km: round(lead.km), terminals });
      break;
    case 'naval-base': s.push(major ? { id: 'naval', port: major.name, fleet: major.fleet } : { id: 'use', port: lead.name, use: 'military' }); break;
    case 'strait': s.push({ id: 'strait', strait: d.chokepoint!.name }); break;
    case 'ferry': case 'fishing': s.push({ id: 'use', port: lead.name, use: kind }); break;
    case 'cargo': {
      const cargo = lead.facilities.filter(f => CARGO.includes(f));
      s.push({ id: 'cargo', port: lead.name, facilities: cargo });
      facilitiesSaid = cargo.length > 0 && cargo.length === lead.facilities.length;
      break;
    }
    default: s.push({ id: 'nearest', port: lead.name, km: round(lead.km) });
  }

  // A major port's name on the map and in the Index can differ ("Dubai (Jebel Ali)" and "Jebel Ali").
  if (lead.size || lead.type) s.push({ id: 'rating', port: lead.name, size: lead.size, type: lead.type });
  const rest = lead.facilities.filter(f => kind !== 'energy-port' || major || !terminals.includes(f));
  if (!facilitiesSaid && rest.length) s.push({ id: 'facilities', facilities: rest });
  if (lead.maxLengthM || lead.channelM) s.push({ id: 'limits', lengthM: lead.maxLengthM, depthM: lead.channelM });
  if (lead.ice) s.push({ id: 'ice' });
  if (lead.vts) s.push({ id: 'vts' });

  const others = d.ports.filter(p => p !== lead && p.km <= PORT_KM).slice(0, 3);
  if (others.length) s.push({ id: 'others', ports: others.map(p => ({ name: p.name, km: round(p.km) })) });
  if (d.major && !major && d.major.km <= PORT_KM * 2) s.push({ id: 'major-nearby', port: d.major.name, km: round(d.major.km) });
  if (d.chokepoint && kind !== 'strait') s.push({ id: 'chokepoint-near', strait: d.chokepoint.name, km: d.chokepoint.km });
  if (kind === 'naval-base' || lead.use === 'military') s.push({ id: 'ais-dark' });
  if (coverage !== 'unknown' && d.ais) {
    s.push({ id: 'coverage', level: coverage, port: watch.name, n: watch.heard ?? 0, hours: d.ais.hours, from: d.ais.from, to: d.ais.to, small: rank(lead.size) < 3 && !major });
  }

  return {
    kind, lead, coverage, sentences: s,
    creditedTo: lead.home && lead.home !== d.id ? lead.home : undefined,
    index: portsIndexable(d),
    watch,
  };
}

const FACILITY: Record<PortFacility, string> = {
  container: msg('container berths'),
  roro: msg('ramps for roll-on, roll-off ships'),
  'dry-bulk': msg('dry bulk berths'),
  'liquid-bulk': msg('liquid bulk berths'),
  oil: msg('an oil terminal'),
  lng: msg('an LNG terminal'),
  breakbulk: msg('general cargo berths'),
  repairs: msg('yards for major repairs'),
  'dry-dock': msg('a dry dock'),
};

const listOf = (items: string[], t: Translate) =>
  new Intl.ListFormat(t.locale === 'en' ? 'en-GB' : t.intl, { type: 'conjunction' }).format(items);
const num = (n: number, t: Translate) => new Intl.NumberFormat(t.intl).format(n);
const span = (from: string, to: string, t: Translate) =>
  new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', timeZone: 'UTC' }).formatRange(Date.parse(from), Date.parse(to) - 1);
const facilities = (fs: PortFacility[], t: Translate) => listOf(fs.map(f => t(FACILITY[f])), t);

/** One sentence in the reader's language. `place` is the place's name as the page writes it. */
export function renderSentence(sentence: PortSentence, place: string, t: Translate): string {
  // The Index spells Helsingør "Helsingor"; on Helsingør's page its harbour takes the place's spelling.
  const same = (port: string) => (fold(port) === fold(place) ? place : port);
  const s = 'port' in sentence ? { ...sentence, port: same(sentence.port) } : sentence;
  switch (s.id) {
    case 'hub':
      if (fold(s.port) === fold(place)) {
        return s.volume
          ? t('{place} is one of the major container ports the map marks, at {volume} a year by its reference figures.', { place, volume: s.volume })
          : t('{place} is one of the major container ports the map marks.', { place });
      }
      return s.volume && s.rank
        ? t('{place} is home to {port}, one of the major container ports the map marks: {volume} a year, number {rank} in the world by the map’s reference figures.', { place, port: s.port, volume: s.volume, rank: s.rank })
        : s.volume
          ? t('{place} is home to {port}, one of the major container ports the map marks, at {volume} a year by its reference figures.', { place, port: s.port, volume: s.volume })
          : t('{place} is home to {port}, one of the major container ports the map marks.', { place, port: s.port });
    case 'energy-major':
      return s.volume && /\d/.test(s.volume)
        ? t('{port} is one of the oil and gas ports the map marks, shipping about {volume} by its reference figures.', { port: s.port, volume: s.volume })
        : t('{port} is one of the industrial energy ports the map marks.', { port: s.port });
    case 'energy-terminals':
      return t('{port}, {km} km from the centre, has {terminals}, by the World Port Index.', { port: s.port, km: s.km, terminals: facilities(s.terminals, t) });
    case 'naval':
      return s.fleet
        ? t('{port} is a naval base, home to the {fleet}.', { port: s.port, fleet: s.fleet })
        : t('{port} is a naval base.', { port: s.port });
    case 'strait':
      return t('{place} lies on the {strait}, one of the ten chokepoints where the map counts the ships going through.', { place, strait: straitName(s.strait, t) });
    case 'use':
      return t('By the World Port Index, {port} is {use, select, ferry {a ferry port} fishing {a fishing harbour} military {a military harbour} other {a cargo port}}.', { port: s.port, use: s.use });
    case 'cargo':
      return s.facilities.length
        ? t('{port} handles cargo: the World Port Index lists {facilities}.', { port: s.port, facilities: facilities(s.facilities, t) })
        : t('By the World Port Index, {port} is a cargo port.', { port: s.port });
    case 'nearest':
      return s.port === place
        ? t('{place}’s own harbour is {km} km from the centre.', { place, km: s.km })
        : t('The nearest harbour to {place} is {port}, {km} km from the centre.', { place, port: s.port, km: s.km });
    case 'rating':
      return s.size
        ? t('The Index rates {port} a {size, select, large {large} medium {medium-sized} small {small} other {very small}} {type, select, coastal {natural harbour on the coast} breakwater {coastal harbour behind breakwaters} tide-gates {coastal harbour behind tide gates} river {river harbour} river-basins {river harbour built around basins} river-tide-gates {river harbour behind tide gates} canal-lake {harbour on a canal or lake} roadstead {open roadstead, where ships anchor off the coast} typhoon {typhoon shelter} other {harbour}}.', { port: s.port, size: s.size, type: s.type ?? 'other' })
        : t('The Index lists {port} as a {type, select, coastal {natural harbour on the coast} breakwater {coastal harbour behind breakwaters} tide-gates {coastal harbour behind tide gates} river {river harbour} river-basins {river harbour built around basins} river-tide-gates {river harbour behind tide gates} canal-lake {harbour on a canal or lake} roadstead {open roadstead, where ships anchor off the coast} typhoon {typhoon shelter} other {harbour}}.', { port: s.port, type: s.type ?? 'other' });
    case 'facilities':
      return t('It lists {facilities} there.', { facilities: facilities(s.facilities, t) });
    case 'limits':
      return s.lengthM && s.depthM
        ? t('It takes ships up to {length} m long, through a channel at least {depth} m deep.', { length: num(s.lengthM, t), depth: num(s.depthM, t) })
        : s.lengthM
          ? t('It takes ships up to {length} m long.', { length: num(s.lengthM, t) })
          : t('Its entrance channel is at least {depth} m deep.', { depth: num(s.depthM!, t) });
    case 'ice':
      return t('Ice can restrict the way in.');
    case 'vts':
      return t('A vessel traffic service watches the approaches.');
    case 'others':
      return t('Also within {km} km: {ports}.', { km: PORT_KM, ports: listOf(s.ports.map(p => t('{port} ({km} km)', { port: same(p.name), km: p.km })), t) });
    case 'major-nearby':
      return t('{port}, {km} km away, is one of the major ports the map marks.', { port: s.port, km: s.km });
    case 'chokepoint-near':
      return t('It is about {km} km from the point where the map counts the ships going through the {strait}.', { km: s.km, strait: straitName(s.strait, t) });
    case 'ais-dark':
      return t('Warships often sail with AIS switched off, so most of a navy is missing from the live map.');
    case 'coverage': {
      const vars = { hours: s.hours, span: span(s.from, s.to, t), port: s.port, km: PORT_KM, n: s.n };
      if (s.level === 'silent') {
        return s.small
          ? t('In {hours} hours of AIS recorded {span}, the map heard no ship within {km} km of {port}. Small boats need not carry AIS, and the receivers TAKIP draws on may not reach here.', vars)
          : t('In {hours} hours of AIS recorded {span}, the map heard no ship within {km} km of {port}: the receivers TAKIP draws on don’t reach here, so its ships won’t show.', vars);
      }
      if (s.level === 'thin') {
        return t('In {hours} hours of AIS recorded {span}, the map heard only {n, plural, one {one ship} other {# ships}} within {km} km of {port}: reception here is patchy, so most ships won’t show.', vars);
      }
      return s.level === 'busy'
        ? t('In {hours} hours of AIS recorded {span}, the map heard {n} different ships within {km} km of {port}, one of the best-covered harbours on the map.', { ...vars, n: num(s.n, t) })
        : t('In {hours} hours of AIS recorded {span}, the map heard {n} different ships within {km} km of {port}.', { ...vars, n: num(s.n, t) });
    }
  }
}

/** The whole story as paragraphs: what the port is, what it can take, and what the live map can see there. */
export function renderStory(story: PortStory, place: string, t: Translate): string[] {
  const group = (ids: PortSentence['id'][]) => story.sentences.filter(s => ids.includes(s.id)).map(s => renderSentence(s, place, t)).join(' ');
  return [
    group(['hub', 'energy-major', 'energy-terminals', 'naval', 'strait', 'use', 'cargo', 'nearest', 'rating', 'facilities', 'limits', 'ice', 'vts']),
    group(['others', 'major-nearby', 'chokepoint-near']),
    group(['ais-dark', 'coverage']),
  ].filter(Boolean);
}
