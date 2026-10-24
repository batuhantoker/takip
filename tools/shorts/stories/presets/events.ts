/** Event families worth a minute, from History's own records. Every fact a preset gives the narrator is computed from these. */
import type { EventRow } from '../history-db';

export interface EventPreset {
  kicker: string;
  /** What the video is about, for the writer. */
  topic: string;
  /** ev_kind codes counted; the map is opened on exactly these kinds (`&kinds=`), so it shows what is told. `families` is
   *  kept for the record. */
  kinds: string[];
  /** meta_source codes counted and told: the dataset the coverage line names, not other sources' retellings of it. */
  counted: string[];
  families: string;
  /** Years; `to` is exclusive. */
  from: number;
  to: number;
  zoom: number;
  /** Where an event happened, for "most in …". */
  /** Only events inside this box count (west, south, east, north), for a story about one region; the camera frames it. */
  box?: [number, number, number, number];
  /** Records that would mislead when told, left out of the count and the words. */
  skip?: (e: EventRow) => boolean;
  where(e: EventRow): string | null;
  /** How big it was, to pick the ones worth naming. */
  size(e: EventRow): number;
  /** One line of plain facts about one event. */
  describe(e: EventRow): string;
  /** How a line names its event, where the facts give no name of its own. */
  tell?: string;
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
/** A hazard by its physical size, never its deaths: a quake's magnitude, an eruption's explosivity, a tsunami's water. */
const measured = (e: EventRow) => (e.magnitude ? `magnitude ${e.magnitude}` : num(e.attrs.vei) ? `explosivity ${num(e.attrs.vei)} of 8`
  : num(e.attrs.max_water_height_m) ? `water up to ${num(e.attrs.max_water_height_m)} m` : null);
/** COW calls the Soviet Union "Russia" throughout; from 1922 to 1991 it is said as the Soviet Union. */
const soviet = <T extends string | null>(text: T, e: EventRow): T =>
  (text && year(e) >= 1922 && year(e) <= 1991 ? text.replace(/\bRussia\b/g, 'the Soviet Union') : text) as T;
/** SIPRI's site codes as places people know. */
const SITES: Record<string, string> = {
  'Nts': 'the Nevada Test Site', 'Semi Kazakh': 'Semipalatinsk', 'Nz Russ': 'Novaya Zemlya', 'Christmas Is': 'Christmas Island',
  'Johnston Is': 'Johnston Island', 'Astrak Russ': 'Astrakhan', 'In Ecker Alg': 'In Ekker, Algeria', 'Reggane Alg': 'Reggane, Algeria',
  'Azgir Kazakh': 'Azgir, Kazakhstan', 'Marali Austr': 'Maralinga, Australia', 'Nellis Nv': 'Nevada',
};
const site = (e: EventRow) => { const s = str(e.attrs.site); return s ? SITES[s] ?? (/ (Russ|Kazakh|Alg|Austr)$/.test(s) ? null : s) : null; };
/** GCAT's launch sites ("NIIP-5, Baykonur, Kazakstan", "1-y Gosudarstvenniy Ispitatelniy Kosmodrom MO RF") as spaceports people know. */
const SPACEPORTS: [RegExp, string][] = [
  [/Baykonur|Baikonur/, 'Baikonur'], [/Plesetsk|1-y Gosudarstvenniy/, 'Plesetsk'], [/Canaveral|Kennedy/, 'Cape Canaveral'],
  [/Vandenberg/, 'Vandenberg'], [/Kourou/, 'Kourou'], [/Jiuquan/, 'Jiuquan'], [/Xichang/, 'Xichang'], [/Taiyuan/, 'Taiyuan'],
  [/Wenchang/, 'Wenchang'], [/Tanegashima/, 'Tanegashima'], [/Uchinoura|Kagoshima/, 'Uchinoura'], [/Sriharikota|Satish Dhawan/, 'Sriharikota'],
  [/Wallops/, 'Wallops'], [/Kapustin/, 'Kapustin Yar'], [/Vostochn/, 'Vostochny'], [/Svobodn/, 'Svobodny'], [/Mahia/, 'Mahia, New Zealand'],
  [/Semnan|Shahroud/, 'Iran'], [/Sohae|Tongchang/, 'Sohae, North Korea'], [/Palmachim/, 'Palmachim, Israel'], [/Naro/, 'Naro, South Korea'],
];
const spaceport = (e: EventRow) => { const s = str(e.attrs.site); return s ? SPACEPORTS.find(([re]) => re.test(s))?.[1] ?? s.split(',').at(-1)!.trim() : null; };
const knots = (e: EventRow) => num(e.attrs.max_wind_kt);
/**
 * A test's yield as SIPRI gives it: a number, or a range ("1000–10000") whose top the import keeps as the magnitude, which
 * told as "about 10,000 kilotons" overstated Handley (1970) tenfold. A range ranks by its floor and is said as one.
 */
export const yieldOf = (e: EventRow): { size: number; said: string | null } => {
  const r = str(e.attrs.yield_kt)?.match(/^(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)$/);
  if (!r) return { size: e.magnitude ?? 0, said: e.magnitude ? `about ${e.magnitude.toLocaleString('en')} kilotons` : null };
  const [lo, hi] = [Number(r[1]), Number(r[2])];
  return { size: lo, said: lo > 0 ? `over ${lo.toLocaleString('en')} kilotons` : `up to ${hi.toLocaleString('en')} kilotons` };
};
/** An area as a chip reads it: "8.3 million km²", "450,000 km²". */
const area = (km2: number) => (km2 >= 1e6 ? `${Number((km2 / 1e6).toPrecision(2))} million km²` : `${Number(km2.toPrecision(2)).toLocaleString('en')} km²`);
/** NOAA files some volcanoes surname first: "Eruption of Ruiz, Nevado del". */
const eruption = (e: EventRow) => e.title.replace(/^(Eruption of )([^,]+), (.+)$/, '$1$3 $2');

export const EVENT_PRESETS: Record<string, EventPreset> = {
  'nuclear-tests': {
    kicker: 'Nuclear age',
    topic: 'every nuclear explosion from 1945 to 1998',
    kinds: ['nuclear.test', 'nuclear.combat'],
    counted: ['sipri-nuclear'],
    families: 'nuclear',
    from: 1945,
    to: 1999,
    zoom: 1.5,
    where: tester,
    size: e => yieldOf(e).size,
    // by country and site: a shot's codename ("Handley") means nothing out loud
    describe: e => `${tester(e) ?? 'A'} test, ${year(e)}${yieldOf(e).said ? `, ${yieldOf(e).said}` : ''}${site(e) ? `, at ${site(e)}` : ''}`,
    coverage: 'SIPRI records explosions from 1945 to 1998, tests and the two used in war.',
    postTitle: 'Every nuclear explosion, 1945 to 1998',
    sources: ['Nuclear explosions: SIPRI', 'TAKIP'],
    hashtags: ['#TAKIP', '#NuclearTests', '#ColdWar', '#History', '#Maps'],
  },
  'hazards-1900': {
    kicker: 'Natural hazards',
    topic: 'the significant earthquakes, tsunamis and volcanic eruptions since 1900',
    kinds: ['hazard.quake', 'hazard.tsunami', 'hazard.volcano'],
    counted: ['noaa-hazards'],
    families: 'hazard',
    from: 1900,
    to: 2026,
    zoom: 1.5,
    where: e => str(e.attrs.country),
    // by physical size, not deaths (tragedies stay plain): an eruption's explosivity weighed against quake magnitudes
    size: e => e.magnitude ?? (num(e.attrs.vei) ? num(e.attrs.vei)! * 1.3 : 0),
    describe: e => `${e.title}, ${year(e)}${measured(e) ? `, ${measured(e)}` : ''}`,
    coverage: 'NOAA lists the significant earthquakes, tsunamis and eruptions since 1900, each with its physical size.',
    postTitle: '125 years of earthquakes, tsunamis and eruptions',
    sources: ['Natural hazards: NOAA NCEI', 'TAKIP'],
    hashtags: ['#TAKIP', '#Earthquake', '#Tsunami', '#Volcano', '#Maps'],
  },
  disasters: {
    kicker: 'Disasters',
    topic: 'where floods, storms, droughts and other disasters struck from 1960 to 2018',
    kinds: ['disaster.flood', 'disaster.storm', 'disaster.quake', 'disaster.landslide', 'disaster.temperature', 'disaster.drought', 'disaster.volcano', 'disaster.mass_movement'],
    counted: ['gdis'],
    families: 'disaster',
    from: 1960,
    to: 2019,
    zoom: 1.5,
    where: e => e.title.split(' — ')[1]?.trim() ?? null,
    size: e => e.magnitude ?? 0,
    // GDIS names no event ("Drought — India") and counts the local areas it reached, which "places hit" didn't say
    describe: e => {
      const [kind, country] = e.title.split(' — ');
      return `${kind} in ${country}, ${year(e)}${e.magnitude ? `, across ${e.magnitude} local areas` : ''}`;
    },
    coverage: 'GDIS geocodes the disasters EM-DAT recorded from 1960 to 2018, each with the local areas it reached; the record ends there.',
    tell: 'Each line names its disaster as its kind, country and year ("India\'s 2009 drought"), with how many local areas it reached.',
    postTitle: 'Every recorded disaster, 1960 to 2018',
    sources: ['Disasters: GDIS (EM-DAT)', 'TAKIP'],
    hashtags: ['#TAKIP', '#Disasters', '#Floods', '#ClimateData', '#Maps'],
  },
  'border-changes': {
    kicker: 'Borders',
    topic: 'every transfer of land between states since 1816',
    kinds: ['change.territorial'],
    counted: ['cow-territorial'],
    families: 'territorial',
    from: 1816,
    to: 2019,
    zoom: 1.5,
    // COW codes the dominions' 1920 entry into its state system as an "unknown" transfer of the whole country from Britain
    skip: e => year(e) === 1920 && str(e.attrs.losing) === 'United Kingdom' && str(e.attrs.process) === 'unknown',
    where: e => soviet(str(e.attrs.gaining) ?? str(e.attrs.government), e),
    size: e => num(e.attrs.area_km2) ?? 0,
    // COW's procedure is mostly "unknown", which says nothing on a chip read in a second
    describe: e => `${soviet(e.title.replace(/ \(unknown\)$/, ''), e)}, ${year(e)}${num(e.attrs.area_km2) ? `, about ${area(num(e.attrs.area_km2)!)}` : ''}`,
    coverage: 'The Correlates of War project records territorial changes from 1816 to 2018.',
    postTitle: 'Every border change since 1816',
    sources: ['Territorial change: Correlates of War', 'TAKIP'],
    hashtags: ['#TAKIP', '#Borders', '#History', '#Geopolitics', '#Maps'],
  },
  'tsunamis-1900': {
    kicker: 'Tsunamis',
    topic: 'the tsunamis recorded since 1900',
    kinds: ['hazard.tsunami'],
    counted: ['noaa-hazards'],
    families: 'hazard',
    from: 1900,
    to: 2026,
    zoom: 1.5,
    where: e => e.title.split(' — ')[1]?.trim() ?? null,
    // NOAA's deaths are the whole event's, earthquake included, so a tsunami is told by the water it raised
    size: e => num(e.attrs.max_water_height_m) ?? 0,
    describe: e => `${e.title}, ${year(e)}, water up to ${num(e.attrs.max_water_height_m)} m`,
    coverage: "NOAA's Global Historical Tsunami Database, each placed at the area of its source, with the highest water measured. Its death counts include the earthquakes that raised them, so they are not told.",
    postTitle: 'Every tsunami since 1900, on one map',
    sources: ['Tsunamis: NOAA NCEI', 'TAKIP'],
    hashtags: ['#TAKIP', '#Tsunami', '#NaturalDisasters', '#History', '#Maps'],
  },
  'volcanoes-1800': {
    kicker: 'Volcanoes',
    topic: 'the significant volcanic eruptions recorded since 1800',
    kinds: ['hazard.volcano'],
    counted: ['noaa-hazards'],
    families: 'hazard',
    from: 1800,
    to: 2026,
    zoom: 1.5,
    where: e => str(e.attrs.country),
    size: e => num(e.attrs.vei) ?? 0,
    describe: e => `${eruption(e)}, ${year(e)}${num(e.attrs.vei) ? `, explosivity ${num(e.attrs.vei)} of 8` : ''}`,
    coverage: 'NOAA lists the significant eruptions since 1800, each with its explosivity on the scale from 0 to 8.',
    postTitle: 'The biggest eruptions since 1800, on one map',
    sources: ['Volcanoes: NOAA NCEI', 'TAKIP'],
    hashtags: ['#TAKIP', '#Volcano', '#NaturalDisasters', '#History', '#Maps'],
  },
  'big-quakes': {
    kicker: 'Earthquakes',
    topic: 'the significant earthquakes recorded since 1900, the strongest named',
    kinds: ['hazard.quake'],
    counted: ['noaa-hazards'],
    families: 'hazard',
    from: 1900,
    to: 2026,
    zoom: 1.5,
    where: e => str(e.attrs.country),
    size: e => e.magnitude ?? 0,
    describe: e => `${e.title}, ${year(e)}, magnitude ${e.magnitude}`,
    coverage: 'NOAA lists the significant earthquakes since 1900, each with its magnitude.',
    postTitle: 'The strongest earthquakes since 1900, on one map',
    sources: ['Earthquakes: NOAA NCEI', 'TAKIP'],
    hashtags: ['#TAKIP', '#Earthquake', '#NaturalDisasters', '#History', '#Maps'],
  },
  // a launch has no size worth telling, so a stretch's chip is its busiest spaceport (events.ts)
  launches: {
    kicker: 'Rocket launches',
    topic: 'every orbital rocket launch since Sputnik in 1957',
    kinds: ['space.launch'],
    counted: ['gcat-launches'],
    families: 'space',
    from: 1957,
    to: 2026,
    zoom: 1.5,
    where: spaceport,
    size: () => 0,
    describe: e => `${e.title}, ${year(e)}`,
    coverage: "Jonathan McDowell's GCAT lists every orbital launch attempt, failures included, each at its launch site.",
    postTitle: 'Every orbital launch since Sputnik, on one map',
    sources: ['Launches: GCAT (Jonathan McDowell)', 'TAKIP'],
    hashtags: ['#TAKIP', '#Space', '#RocketLaunch', '#SpaceHistory', '#Maps'],
  },
  'space-race-launches': {
    kicker: 'Space race',
    topic: 'the space race: every orbital rocket launch from Sputnik in 1957 to 1975, by spaceport',
    kinds: ['space.launch'],
    counted: ['gcat-launches'],
    families: 'space',
    from: 1957,
    to: 1976,
    zoom: 1.5,
    where: spaceport,
    size: () => 0,
    describe: e => `${e.title}, ${year(e)}`,
    coverage: "Jonathan McDowell's GCAT lists every orbital launch attempt, failures included, each at its launch site.",
    postTitle: 'The space race, launch by launch',
    sources: ['Launches: GCAT (Jonathan McDowell)', 'TAKIP'],
    hashtags: ['#TAKIP', '#SpaceRace', '#SpaceHistory', '#Space', '#Maps'],
  },
  'hurricanes-1950': {
    kicker: 'Hurricanes',
    topic: 'the tropical cyclones (hurricanes and typhoons) recorded since 1950, each placed where it peaked',
    kinds: ['hazard.storm'],
    counted: ['ibtracs'],
    families: 'hazard',
    from: 1950,
    to: 2026,
    zoom: 1.5,
    where: e => str(e.attrs.basin)?.split(',')[0] ?? null,
    size: e => knots(e) ?? 0,
    describe: e => `${e.title}, ${year(e)}, winds up to ${knots(e)} knots (about ${Math.round(knots(e)! * 1.852 / 5) * 5} km/h)`,
    coverage: 'IBTrACS gathers every tropical cyclone the world\'s weather agencies tracked, with its strongest sustained wind.',
    postTitle: '75 years of hurricanes and typhoons, on one map',
    sources: ['Tropical cyclones: NOAA IBTrACS', 'TAKIP'],
    hashtags: ['#TAKIP', '#Hurricane', '#Typhoon', '#Weather', '#Maps'],
  },
  'peace-agreements': {
    kicker: 'Peace deals',
    topic: 'the peace agreements signed since 1990, in wars between and within countries',
    kinds: ['politics.peace_agreement'],
    counted: ['pax'],
    families: 'politics',
    from: 1990,
    to: 2026,
    zoom: 1.5,
    where: e => str(e.attrs.conflict)?.split('/')[0].trim() ?? null,
    size: () => 0,
    describe: e => `${e.title}, ${year(e)}`,
    coverage: 'PA-X, at the University of Edinburgh, records every written peace agreement since 1990, from ceasefires to full settlements.',
    postTitle: 'Every peace agreement since 1990, on one map',
    sources: ['Peace agreements: PA-X (University of Edinburgh)', 'TAKIP'],
    hashtags: ['#TAKIP', '#Peace', '#Conflict', '#History', '#Maps'],
  },
  fireballs: {
    kicker: 'Fireballs',
    topic: 'the fireballs, space rocks exploding in the sky, that US government sensors caught since 1988',
    kinds: ['hazard.fireball'],
    counted: ['cneos-fireballs'],
    families: 'hazard',
    from: 1988,
    to: 2027,
    zoom: 1.5,
    where: () => null,
    size: e => num(e.attrs.impact_energy_kt) ?? 0,
    describe: e => `A fireball, ${year(e)}, about ${num(e.attrs.impact_energy_kt)} kilotons of energy, ${e.lat >= 0 ? `${e.lat.toFixed(0)}° N` : `${(-e.lat).toFixed(0)}° S`}`,
    coverage: "NASA's CNEOS lists the fireballs US government sensors detected, with the energy each released; most burst over the ocean.",
    postTitle: 'Every fireball spotted since 1988, on one map',
    sources: ['Fireballs: NASA CNEOS', 'TAKIP'],
    hashtags: ['#TAKIP', '#Fireball', '#Meteor', '#Space', '#Maps'],
  },
};
