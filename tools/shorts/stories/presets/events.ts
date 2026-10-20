/** Event families worth a minute, from History's own records. Every fact a preset gives the narrator is computed from these. */
import type { EventRow } from '../history-db';

export interface EventPreset {
  kicker: string;
  /** What the video is about, for the writer. */
  topic: string;
  /** ev_kind codes counted, and the History families the map draws (they must match, or the map shows more than is told). */
  kinds: string[];
  families: string;
  /** Years; `to` is exclusive. */
  from: number;
  to: number;
  zoom: number;
  /** Where an event happened, for "most in …". */
  where(e: EventRow): string | null;
  /** How big it was, to pick the ones worth naming. */
  size(e: EventRow): number;
  /** One line of plain facts about one event. */
  describe(e: EventRow): string;
  /** Said in the facts so the narrator doesn't imply more. */
  coverage: string;
  postTitle: string;
  sources: string[];
  hashtags: string[];
}

const year = (e: EventRow) => new Date(e.t).getUTCFullYear();
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** SIPRI titles read "Platte (United States)" or "Soviet Union nuclear test". */
const tester = (e: EventRow) => e.title.match(/\(([^)]+)\)\s*$/)?.[1] ?? e.title.match(/^(.+?) nuclear test/)?.[1] ?? null;
const deaths = (e: EventRow) => num(e.attrs.deaths);

export const EVENT_PRESETS: Record<string, EventPreset> = {
  'nuclear-tests': {
    kicker: 'Nuclear age',
    topic: 'every nuclear explosion from 1945 to 1998',
    kinds: ['nuclear.test', 'nuclear.combat'],
    families: 'nuclear',
    from: 1945,
    to: 1999,
    zoom: 1.5,
    where: tester,
    size: e => e.magnitude ?? 0,
    describe: e => `${e.title}, ${year(e)}${e.magnitude ? `, about ${e.magnitude.toLocaleString('en')} kilotons` : ''}${str(e.attrs.site) ? `, at ${e.attrs.site}` : ''}`,
    coverage: 'SIPRI records explosions from 1945 to 1998, tests and the two used in war.',
    postTitle: 'Every nuclear explosion, 1945 to 1998',
    sources: ['Nuclear explosions: SIPRI', 'TAKIP'],
    hashtags: ['#TAKIP', '#NuclearTests', '#ColdWar', '#History', '#Maps'],
  },
  'hazards-1900': {
    kicker: 'Natural hazards',
    topic: 'the significant earthquakes, tsunamis and volcanic eruptions since 1900',
    kinds: ['hazard.quake', 'hazard.tsunami', 'hazard.volcano'],
    families: 'hazard',
    from: 1900,
    to: 2026,
    zoom: 1.5,
    where: e => str(e.attrs.country),
    size: e => deaths(e) ?? 0,
    describe: e => `${e.title}, ${year(e)}${e.magnitude ? `, magnitude ${e.magnitude}` : ''}${deaths(e) ? `, ${deaths(e)!.toLocaleString('en')} deaths` : ''}`,
    coverage: 'NOAA lists significant events: those that killed, did serious damage, or were very large.',
    postTitle: '125 years of earthquakes, tsunamis and eruptions',
    sources: ['Natural hazards: NOAA NCEI', 'TAKIP'],
    hashtags: ['#TAKIP', '#Earthquake', '#Tsunami', '#Volcano', '#Maps'],
  },
  disasters: {
    kicker: 'Disasters',
    topic: 'where floods, storms, droughts and other disasters struck from 1960 to 2018',
    kinds: ['disaster.flood', 'disaster.storm', 'disaster.quake', 'disaster.landslide', 'disaster.temperature', 'disaster.drought', 'disaster.volcano', 'disaster.mass_movement'],
    families: 'disaster',
    from: 1960,
    to: 2019,
    zoom: 1.5,
    where: e => e.title.split(' — ')[1]?.trim() ?? null,
    size: e => e.magnitude ?? 0,
    describe: e => `${e.title}, ${year(e)}${e.magnitude ? `, ${e.magnitude} places hit` : ''}`,
    coverage: 'GDIS geocodes the disasters EM-DAT recorded from 1960 to 2018; the record ends there.',
    postTitle: 'Every recorded disaster, 1960 to 2018',
    sources: ['Disasters: GDIS (EM-DAT)', 'TAKIP'],
    hashtags: ['#TAKIP', '#Disasters', '#Floods', '#ClimateData', '#Maps'],
  },
  'border-changes': {
    kicker: 'Borders',
    topic: 'every transfer of land between states since 1816',
    kinds: ['change.territorial'],
    families: 'territorial',
    from: 1816,
    to: 2019,
    zoom: 1.5,
    where: e => str(e.attrs.gaining) ?? str(e.attrs.government),
    size: e => num(e.attrs.area_km2) ?? 0,
    describe: e => `${e.title}, ${year(e)}${num(e.attrs.area_km2) ? `, ${num(e.attrs.area_km2)!.toLocaleString('en')} km²` : ''}`,
    coverage: 'The Correlates of War project records territorial changes from 1816 to 2018.',
    postTitle: 'Every border change since 1816',
    sources: ['Territorial change: Correlates of War', 'TAKIP'],
    hashtags: ['#TAKIP', '#Borders', '#History', '#Geopolitics', '#Maps'],
  },
};
