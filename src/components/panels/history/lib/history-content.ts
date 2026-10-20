import { msg } from '@/lib/core/i18n/translator';
import type { WarLayer } from '@/lib/history/war-layers';

export type Place = WarLayer['view'];

const THIS_YEAR = new Date().getUTCFullYear();

// GTD and the Stanford war borders are non-commercial; each map popup names its record's source.
/** How the History panel names each event family, the years its sources cover (astronomical: -7499 is 7500 BCE), and what it holds. */
export const FAMILY_TEXT: Record<string, { name: string; years: [number, number]; note: string }> = {
  conflict: { name: msg('Wars and battles'), years: [-7499, THIS_YEAR], note: msg('Wars, battles, military operations, rebellions, massacres, pogroms and expulsions, with death tolls') },
  terror: { name: msg('Attacks'), years: [-43, THIS_YEAR], note: msg('GTD for 1970–2017, Wikidata before and since') },
  territorial: { name: msg('Territorial claims'), years: [1816, 2018], note: msg('Claims and transfers of land between states') },
  // The danger list is as of 2021, so earlier years show only sites taken off it.
  heritage: { name: msg('Heritage in danger'), years: [1988, 2022], note: msg('Sites UNESCO lists in danger, as of 2021') },
  // One eruption GVP dates to 55,500 BCE; the rest of its record starts in the Holocene.
  hazard: { name: msg('Natural hazards'), years: [-55499, THIS_YEAR], note: msg('Quakes, tsunamis, eruptions, tropical cyclones and fireballs') },
  politics: { name: msg('Politics'), years: [-2333, THIS_YEAR], note: msg('Treaties, peace agreements, coups, revolutions, assassinations, protests, riots and strikes') },
  nuclear: { name: msg('Nuclear explosions'), years: [1945, 1998], note: msg('Tests, and Hiroshima and Nagasaki') },
  disaster: { name: msg('Disasters'), years: [-2499, THIS_YEAR], note: msg('Famines, epidemics, fires, accidents and shipwrecks, and where floods, storms and droughts struck') },
  crime: { name: msg('Crime'), years: [725, THIS_YEAR], note: msg('Murders and shootings with a Wikipedia article') },
  space: { name: msg('Rocket launches'), years: [1945, THIS_YEAR], note: msg('Orbital launches and suborbital rockets, at their pads') },
  missile: { name: msg('Missile tests'), years: [1942, THIS_YEAR], note: msg('Missile test launches, at their sites') },
  slavery: { name: msg('Slave trade'), years: [1514, 1866], note: msg('Slave voyages, at the port where people were bought') },
  events: { name: msg('Events'), years: [-2999, THIS_YEAR], note: msg('Dated events from Wikipedia’s year pages in ten languages, placed by what they link') },
};

export type Moment = {
  label: string;
  at: number;
  /** Where the map goes. */
  place: Place;
  /** Shown under the name when picking the moment does more than move the clock and the map. */
  note?: string;
  /** Event families the moment needs on. */
  families?: string[];
  /** Also colours countries by this metric, at `speed` (simulated seconds per second). */
  metric?: string;
  speed?: number;
};

/** Epoch ms for a calendar date; years at or below 0 count astronomically (-489 is 490 BCE). */
function utc(year: number, month: number, day: number) {
  const d = new Date(0);
  d.setUTCFullYear(year, month, day);
  return d.getTime();
}

export const MOMENTS: Moment[] = [
  { label: msg('Battle of Marathon'), at: utc(-489, 7, 1), place: { lat: 38.4, lng: 23.6, zoom: 5 } },
  { label: msg('Fall of the Western Roman Empire'), at: utc(476, 8, 4), place: { lat: 44.4, lng: 12.2, zoom: 4.5 }, families: ['politics'], note: msg('Also shows treaties, coups and revolutions') },
  { label: msg('Battle of Hastings'), at: utc(1066, 9, 14), place: { lat: 50.9, lng: 0.5, zoom: 5.5 } },
  { label: msg('Fall of Constantinople'), at: utc(1453, 4, 29), place: { lat: 41, lng: 28.9, zoom: 5 } },
  { label: msg('Battle of Waterloo'), at: utc(1815, 5, 18), place: { lat: 50.7, lng: 4.4, zoom: 5 } },
  { label: msg('First World War begins'), at: utc(1914, 6, 28), place: { lat: 48, lng: 16, zoom: 3.6 } },
  { label: msg('Second World War begins'), at: utc(1939, 8, 1), place: { lat: 51, lng: 17, zoom: 4 } },
  { label: msg('Korean War begins'), at: utc(1950, 5, 25), place: { lat: 38, lng: 127.5, zoom: 4.8 } },
  { label: msg('Cuban missile crisis'), at: utc(1962, 9, 16), place: { lat: 23, lng: -80, zoom: 4.2 } },
  { label: msg('Berlin Wall falls'), at: utc(1989, 10, 9), place: { lat: 52.5, lng: 13.4, zoom: 4.5 } },
  { label: msg('Soviet Union dissolves'), at: utc(1991, 11, 26), place: { lat: 55, lng: 60, zoom: 2.6 } },
  { label: msg('September 11 attacks'), at: utc(2001, 8, 11), place: { lat: 40.7, lng: -74, zoom: 4.5 }, families: ['terror'], note: msg('Also shows attacks') },
  {
    label: msg('COVID-19 pandemic'), at: utc(2020, 2, 11), place: { lat: 25, lng: 10, zoom: 1.6 }, note: msg('Also colours countries by weekly deaths'),
    metric: 'owid:covid_weekly_deaths_pm', speed: 7 * 86_400,
  },
];
