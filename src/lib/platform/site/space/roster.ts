import { msg } from '@/lib/core/i18n/translator';
import type { SiteKind } from '@/lib/space/craft/landing-sites';
import type { GlobeWorldId } from '@/lib/space/worlds';

/**
 * TAKIP — the spacecraft with a public page at /spacecraft/<slug>: the craft JPL Horizons places that have a
 * mission note, and the landers and rovers on the Moon and Mars. A fixed list, so slugs never move and no page
 * appears or vanishes with a fleet sweep. Slugs are the words people search ("curiosity-rover"); never rename one.
 */

export type CraftKind = SiteKind | 'orbiter' | 'probe' | 'observatory' | 'satellite' | 'station' | 'other';

export interface RosterCraft {
  slug: string;
  name: string;
  /** English Wikipedia title (checked against the API). */
  wiki: string;
  kind: CraftKind;
  /** JPL Horizons ID, where Horizons places it. */
  horizons?: number;
  /** Where it came down (LANDING_SITES). */
  site?: { world: GlobeWorldId; id: string };
  /** The key NASA publishes its position under on mars.nasa.gov. */
  rover?: 'curiosity' | 'perseverance';
  /** For a craft with neither a mission note nor a landing-site note. */
  summary?: string;
  agency?: string;
  /** It no longer exists (Cassini burned up in Saturn), so Horizons has no "now" for it, only its flight. */
  gone?: boolean;
}

export const KIND_LABEL: Record<CraftKind, string> = {
  crewed: msg('Crewed landing'),
  rover: msg('Rover'),
  lander: msg('Lander'),
  'sample-return': msg('Sample return'),
  orbiter: msg('Orbiter'),
  probe: msg('Space probe'),
  observatory: msg('Space telescope'),
  satellite: msg('Satellite'),
  station: msg('Space station'),
  other: msg('Spacecraft'),
};

export interface RosterGroup { id: string; label: string; craft: RosterCraft[] }

const mars = (id: string) => ({ world: 'mars' as const, id });
const moon = (id: string) => ({ world: 'moon' as const, id });

export const ROSTER_GROUPS: RosterGroup[] = [
  {
    id: 'mars',
    label: msg('On and around Mars'),
    craft: [
      { slug: 'curiosity-rover', name: 'Curiosity', wiki: 'Curiosity (rover)', kind: 'rover', horizons: -76, site: mars('curiosity-landing'), rover: 'curiosity' },
      { slug: 'perseverance-rover', name: 'Perseverance', wiki: 'Perseverance (rover)', kind: 'rover', horizons: -168, site: mars('perseverance-landing'), rover: 'perseverance' },
      { slug: 'opportunity-rover', name: 'Opportunity', wiki: 'Opportunity (rover)', kind: 'rover', horizons: -253, site: mars('opportunity') },
      { slug: 'spirit-rover', name: 'Spirit', wiki: 'Spirit (rover)', kind: 'rover', horizons: -254, site: mars('spirit') },
      { slug: 'zhurong-rover', name: 'Zhurong', wiki: 'Zhurong (rover)', kind: 'rover', site: mars('zhurong') },
      { slug: 'mars-pathfinder', name: 'Mars Pathfinder', wiki: 'Mars Pathfinder', kind: 'rover', site: mars('pathfinder') },
      { slug: 'insight', name: 'InSight', wiki: 'InSight', kind: 'lander', horizons: -189, site: mars('insight') },
      { slug: 'phoenix-mars-lander', name: 'Phoenix', wiki: 'Phoenix (spacecraft)', kind: 'lander', site: mars('phoenix') },
      { slug: 'viking-1', name: 'Viking 1', wiki: 'Viking 1', kind: 'lander', site: mars('viking-1') },
      { slug: 'viking-2', name: 'Viking 2', wiki: 'Viking 2', kind: 'lander', site: mars('viking-2') },
      { slug: 'beagle-2', name: 'Beagle 2', wiki: 'Beagle 2', kind: 'lander', site: mars('beagle-2') },
      { slug: 'mars-3', name: 'Mars 3', wiki: 'Mars 3', kind: 'lander', site: mars('mars-3') },
      { slug: 'mars-reconnaissance-orbiter', name: 'Mars Reconnaissance Orbiter', wiki: 'Mars Reconnaissance Orbiter', kind: 'orbiter', horizons: -74 },
      { slug: 'maven', name: 'MAVEN', wiki: 'MAVEN', kind: 'orbiter', horizons: -202 },
      { slug: '2001-mars-odyssey', name: '2001 Mars Odyssey', wiki: '2001 Mars Odyssey', kind: 'orbiter', horizons: -53 },
      { slug: 'mars-express', name: 'Mars Express', wiki: 'Mars Express', kind: 'orbiter', horizons: -41 },
      { slug: 'exomars-trace-gas-orbiter', name: 'ExoMars Trace Gas Orbiter', wiki: 'Trace Gas Orbiter', kind: 'orbiter', horizons: -143 },
      { slug: 'hope-mars-mission', name: 'Hope (Emirates Mars Mission)', wiki: 'Emirates Mars Mission', kind: 'orbiter', horizons: -62 },
      { slug: 'tianwen-1', name: 'Tianwen-1', wiki: 'Tianwen-1', kind: 'orbiter', horizons: -9901491 },
      { slug: 'escapade-blue', name: 'ESCAPADE Blue', wiki: 'ESCAPADE', kind: 'probe', horizons: -9 },
      { slug: 'escapade-gold', name: 'ESCAPADE Gold', wiki: 'ESCAPADE', kind: 'probe', horizons: -10 },
    ],
  },
  {
    id: 'moon',
    label: msg('On and around the Moon'),
    craft: [
      { slug: 'apollo-11', name: 'Apollo 11 · Tranquility Base', wiki: 'Apollo 11', kind: 'crewed', site: moon('apollo-11') },
      { slug: 'apollo-12', name: 'Apollo 12', wiki: 'Apollo 12', kind: 'crewed', site: moon('apollo-12') },
      { slug: 'apollo-14', name: 'Apollo 14', wiki: 'Apollo 14', kind: 'crewed', site: moon('apollo-14') },
      { slug: 'apollo-15', name: 'Apollo 15', wiki: 'Apollo 15', kind: 'crewed', site: moon('apollo-15') },
      { slug: 'apollo-16', name: 'Apollo 16', wiki: 'Apollo 16', kind: 'crewed', site: moon('apollo-16') },
      { slug: 'apollo-17', name: 'Apollo 17', wiki: 'Apollo 17', kind: 'crewed', site: moon('apollo-17') },
      { slug: 'luna-9', name: 'Luna 9', wiki: 'Luna 9', kind: 'lander', site: moon('luna-9') },
      { slug: 'luna-16', name: 'Luna 16', wiki: 'Luna 16', kind: 'sample-return', site: moon('luna-16') },
      { slug: 'lunokhod-1', name: 'Lunokhod 1', wiki: 'Lunokhod 1', kind: 'rover', site: moon('lunokhod-1') },
      { slug: 'luna-20', name: 'Luna 20', wiki: 'Luna 20', kind: 'sample-return', site: moon('luna-20') },
      { slug: 'lunokhod-2', name: 'Lunokhod 2', wiki: 'Lunokhod 2', kind: 'rover', site: moon('lunokhod-2') },
      { slug: 'luna-24', name: 'Luna 24', wiki: 'Luna 24', kind: 'sample-return', site: moon('luna-24') },
      { slug: 'surveyor-1', name: 'Surveyor 1', wiki: 'Surveyor 1', kind: 'lander', site: moon('surveyor-1') },
      { slug: 'surveyor-3', name: 'Surveyor 3', wiki: 'Surveyor 3', kind: 'lander', site: moon('surveyor-3') },
      { slug: 'surveyor-5', name: 'Surveyor 5', wiki: 'Surveyor 5', kind: 'lander', site: moon('surveyor-5') },
      { slug: 'surveyor-6', name: 'Surveyor 6', wiki: 'Surveyor 6', kind: 'lander', site: moon('surveyor-6') },
      { slug: 'surveyor-7', name: 'Surveyor 7', wiki: 'Surveyor 7', kind: 'lander', site: moon('surveyor-7') },
      { slug: 'change-3', name: 'Chang’e 3 · Yutu', wiki: "Chang'e 3", kind: 'rover', site: moon('change-3') },
      { slug: 'change-4', name: 'Chang’e 4 · Yutu-2', wiki: "Chang'e 4", kind: 'rover', site: moon('change-4') },
      { slug: 'change-5', name: 'Chang’e 5', wiki: "Chang'e 5", kind: 'sample-return', site: moon('change-5') },
      { slug: 'change-6', name: 'Chang’e 6', wiki: "Chang'e 6", kind: 'sample-return', site: moon('change-6') },
      { slug: 'chandrayaan-3', name: 'Chandrayaan-3 · Vikram & Pragyan', wiki: 'Chandrayaan-3', kind: 'rover', horizons: -158, site: moon('chandrayaan-3') },
      { slug: 'slim-moon-lander', name: 'SLIM', wiki: 'Smart Lander for Investigating Moon', kind: 'lander', horizons: -240, site: moon('slim') },
      { slug: 'im-1-odysseus', name: 'IM-1 · Odysseus', wiki: 'IM-1', kind: 'lander', site: moon('im-1') },
      { slug: 'im-2-athena', name: 'IM-2 · Athena', wiki: 'IM-2', kind: 'lander', site: moon('im-2') },
      { slug: 'blue-ghost-mission-1', name: 'Blue Ghost Mission 1', wiki: 'Blue Ghost Mission 1', kind: 'lander', site: moon('blue-ghost-1') },
      { slug: 'lunar-reconnaissance-orbiter', name: 'Lunar Reconnaissance Orbiter', wiki: 'Lunar Reconnaissance Orbiter', kind: 'orbiter', horizons: -85 },
      { slug: 'danuri', name: 'Danuri (KPLO)', wiki: 'Danuri', kind: 'orbiter', horizons: -155 },
      { slug: 'chandrayaan-2', name: 'Chandrayaan-2 orbiter', wiki: 'Chandrayaan-2', kind: 'orbiter', horizons: -152 },
      { slug: 'capstone', name: 'CAPSTONE', wiki: 'CAPSTONE', kind: 'orbiter', horizons: -1176 },
      { slug: 'artemis-p1', name: 'ARTEMIS P1', wiki: 'THEMIS', kind: 'orbiter', horizons: -192 },
      { slug: 'artemis-p2', name: 'ARTEMIS P2', wiki: 'THEMIS', kind: 'orbiter', horizons: -193 },
      { slug: 'lunar-trailblazer', name: 'Lunar Trailblazer', wiki: 'Lunar Trailblazer', kind: 'probe', horizons: -242 },
      { slug: 'lunar-flashlight', name: 'Lunar Flashlight', wiki: 'Lunar Flashlight', kind: 'probe', horizons: -164 },
      { slug: 'clementine', name: 'Clementine', wiki: 'Clementine (spacecraft)', kind: 'probe', horizons: -40000 },
    ],
  },
  {
    id: 'outer',
    label: msg('Jupiter, Saturn and beyond'),
    craft: [
      { slug: 'voyager-1', name: 'Voyager 1', wiki: 'Voyager 1', kind: 'probe', horizons: -31 },
      { slug: 'voyager-2', name: 'Voyager 2', wiki: 'Voyager 2', kind: 'probe', horizons: -32 },
      { slug: 'pioneer-10', name: 'Pioneer 10', wiki: 'Pioneer 10', kind: 'probe', horizons: -23 },
      { slug: 'pioneer-11', name: 'Pioneer 11', wiki: 'Pioneer 11', kind: 'probe', horizons: -24 },
      { slug: 'new-horizons', name: 'New Horizons', wiki: 'New Horizons', kind: 'probe', horizons: -98 },
      { slug: 'juno', name: 'Juno', wiki: 'Juno (spacecraft)', kind: 'orbiter', horizons: -61 },
      { slug: 'europa-clipper', name: 'Europa Clipper', wiki: 'Europa Clipper', kind: 'probe', horizons: -159 },
      { slug: 'juice', name: 'JUICE', wiki: 'Jupiter Icy Moons Explorer', kind: 'probe', horizons: -28 },
      {
        slug: 'cassini', name: 'Cassini', wiki: 'Cassini–Huygens', kind: 'orbiter', horizons: -82, agency: 'NASA · ESA · ASI', gone: true,
        summary: msg('Orbited Saturn for 13 years and dropped the Huygens probe onto Titan; plunged into Saturn in 2017.'),
      },
    ],
  },
  {
    id: 'inner',
    label: msg('The Sun, Mercury and the asteroids'),
    craft: [
      { slug: 'parker-solar-probe', name: 'Parker Solar Probe', wiki: 'Parker Solar Probe', kind: 'probe', horizons: -96 },
      { slug: 'solar-orbiter', name: 'Solar Orbiter', wiki: 'Solar Orbiter', kind: 'probe', horizons: -144 },
      { slug: 'bepicolombo', name: 'BepiColombo', wiki: 'BepiColombo', kind: 'probe', horizons: -121 },
      { slug: 'psyche', name: 'Psyche', wiki: 'Psyche (spacecraft)', kind: 'probe', horizons: -255 },
      { slug: 'lucy', name: 'Lucy', wiki: 'Lucy (spacecraft)', kind: 'probe', horizons: -49 },
      { slug: 'osiris-apex', name: 'OSIRIS-APEX', wiki: 'OSIRIS-REx', kind: 'probe', horizons: -64 },
      { slug: 'hera', name: 'Hera', wiki: 'Hera (space mission)', kind: 'probe', horizons: -91 },
      { slug: 'hayabusa2', name: 'Hayabusa2', wiki: 'Hayabusa2', kind: 'probe', horizons: -37 },
      { slug: 'dawn', name: 'Dawn', wiki: 'Dawn (spacecraft)', kind: 'probe', horizons: -203 },
      { slug: 'ulysses', name: 'Ulysses', wiki: 'Ulysses (spacecraft)', kind: 'probe', horizons: -55 },
      { slug: 'stereo-a', name: 'STEREO-A', wiki: 'STEREO', kind: 'probe', horizons: -234 },
      { slug: 'tesla-roadster', name: 'Tesla Roadster', wiki: "Elon Musk's Tesla Roadster", kind: 'other', horizons: -143205 },
    ],
  },
  {
    id: 'lagrange',
    label: msg('Telescopes and sentinels beyond the Moon'),
    craft: [
      { slug: 'james-webb-space-telescope', name: 'James Webb Space Telescope', wiki: 'James Webb Space Telescope', kind: 'observatory', horizons: -170 },
      { slug: 'nancy-grace-roman-space-telescope', name: 'Nancy Grace Roman Space Telescope', wiki: 'Nancy Grace Roman Space Telescope', kind: 'observatory', horizons: -211 },
      { slug: 'euclid', name: 'Euclid', wiki: 'Euclid (space telescope)', kind: 'observatory', horizons: -680 },
      { slug: 'gaia', name: 'Gaia', wiki: 'Gaia (spacecraft)', kind: 'observatory', horizons: -139479 },
      { slug: 'planck', name: 'Planck', wiki: 'Planck (spacecraft)', kind: 'observatory', horizons: -489 },
      { slug: 'herschel-space-observatory', name: 'Herschel Space Observatory', wiki: 'Herschel Space Observatory', kind: 'observatory', horizons: -486 },
      { slug: 'kepler-space-telescope', name: 'Kepler', wiki: 'Kepler space telescope', kind: 'observatory', horizons: -227 },
      { slug: 'spitzer-space-telescope', name: 'Spitzer Space Telescope', wiki: 'Spitzer Space Telescope', kind: 'observatory', horizons: -79 },
      { slug: 'soho', name: 'SOHO', wiki: 'Solar and Heliospheric Observatory', kind: 'observatory', horizons: -21 },
      { slug: 'aditya-l1', name: 'Aditya-L1', wiki: 'Aditya-L1', kind: 'observatory', horizons: -156 },
      { slug: 'dscovr', name: 'DSCOVR', wiki: 'Deep Space Climate Observatory', kind: 'probe', horizons: -78 },
      { slug: 'advanced-composition-explorer', name: 'Advanced Composition Explorer', wiki: 'Advanced Composition Explorer', kind: 'probe', horizons: -92 },
      { slug: 'wind-spacecraft', name: 'Wind', wiki: 'Wind (spacecraft)', kind: 'probe', horizons: -8 },
      { slug: 'swfo-l1', name: 'SWFO-L1', wiki: 'Space weather Observations at L1 to Advance Readiness - 1', kind: 'probe', horizons: -231 },
      { slug: 'imap', name: 'IMAP', wiki: 'Interstellar Mapping and Acceleration Probe', kind: 'probe', horizons: -43 },
      { slug: 'carruthers-geocorona-observatory', name: 'Carruthers Geocorona Observatory', wiki: 'Carruthers Geocorona Observatory', kind: 'observatory', horizons: -171 },
    ],
  },
  {
    id: 'earth',
    label: msg('In Earth orbit'),
    craft: [
      { slug: 'international-space-station', name: 'International Space Station', wiki: 'International Space Station', kind: 'station', horizons: -125544 },
      { slug: 'tiangong-space-station', name: 'Tiangong', wiki: 'Tiangong space station', kind: 'station', horizons: -148274 },
      { slug: 'hubble-space-telescope', name: 'Hubble Space Telescope', wiki: 'Hubble Space Telescope', kind: 'observatory', horizons: -48 },
      { slug: 'chandra-x-ray-observatory', name: 'Chandra X-ray Observatory', wiki: 'Chandra X-ray Observatory', kind: 'observatory', horizons: -151 },
      { slug: 'tess', name: 'TESS', wiki: 'Transiting Exoplanet Survey Satellite', kind: 'observatory', horizons: -95 },
      { slug: 'spherex', name: 'SPHEREx', wiki: 'SPHEREx', kind: 'observatory', horizons: -163182 },
      { slug: 'international-ultraviolet-explorer', name: 'International Ultraviolet Explorer', wiki: 'International Ultraviolet Explorer', kind: 'observatory', horizons: -110637 },
      { slug: 'nisar', name: 'NISAR', wiki: 'NISAR (satellite)', kind: 'satellite', horizons: -165053 },
      { slug: 'smile', name: 'SMILE', wiki: 'SMILE (spacecraft)', kind: 'satellite', horizons: -463 },
    ],
  },
];

export const ROSTER: RosterCraft[] = ROSTER_GROUPS.flatMap(g => g.craft);

const BY_SLUG = new Map(ROSTER.map(c => [c.slug, c]));
const BY_HORIZONS = new Map(ROSTER.filter(c => c.horizons !== undefined).map(c => [c.horizons!, c]));
const BY_SITE = new Map(ROSTER.filter(c => c.site).map(c => [`${c.site!.world}:${c.site!.id}`, c]));

export const rosterCraft = (slug: string) => BY_SLUG.get(slug) ?? null;
export const craftByHorizons = (id: number) => BY_HORIZONS.get(id) ?? null;
export const craftBySite = (world: GlobeWorldId, id: string) => BY_SITE.get(`${world}:${id}`) ?? null;

export const craftPath = (c: { slug: string }) => `/spacecraft/${c.slug}`;
