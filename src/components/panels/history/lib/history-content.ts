import type { WarLayer } from '@/lib/history/war-layers';

export type Place = WarLayer['view'];

const THIS_YEAR = new Date().getUTCFullYear();

// GTD and the Stanford war borders are non-commercial; each map popup names its record's source.
/** How the History panel names each event family, the years its sources cover, and what it holds. */
export const FAMILY_TEXT: Record<string, { name: string; span: string; note: string }> = {
  conflict: { name: 'Wars and battles', span: '3000 BCE–2025', note: 'Battles, sieges, wars and their death tolls' },
  terror: { name: 'Attacks', span: `44 BCE–${THIS_YEAR}`, note: 'GTD for 1970–2017, Wikidata before and since' },
  territorial: { name: 'Territorial claims', span: '1816–2018', note: 'Claims and transfers of land between states' },
  // The danger list is as of 2021, so earlier years show only sites taken off it.
  heritage: { name: 'Heritage in danger', span: '1988–2022', note: 'Sites UNESCO lists in danger, as of 2021' },
  hazard: { name: 'Natural hazards', span: `2150 BCE–${THIS_YEAR}`, note: 'Significant quakes, tsunamis and eruptions' },
  politics: { name: 'Treaties and coups', span: `1300 BCE–${THIS_YEAR}`, note: 'Treaty signings and coups, from Wikidata' },
  nuclear: { name: 'Nuclear explosions', span: '1945–1998', note: 'Tests, and Hiroshima and Nagasaki' },
  disaster: { name: 'Disasters', span: '1960–2018', note: 'Where floods, storms and droughts struck' },
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
  { label: 'Battle of Marathon', at: utc(-489, 7, 1), place: { lat: 38.4, lng: 23.6, zoom: 5 } },
  { label: 'Fall of the Western Roman Empire', at: utc(476, 8, 4), place: { lat: 44.4, lng: 12.2, zoom: 4.5 }, families: ['politics'], note: 'Also shows treaties and coups' },
  { label: 'Battle of Hastings', at: utc(1066, 9, 14), place: { lat: 50.9, lng: 0.5, zoom: 5.5 } },
  { label: 'Fall of Constantinople', at: utc(1453, 4, 29), place: { lat: 41, lng: 28.9, zoom: 5 } },
  { label: 'Battle of Waterloo', at: utc(1815, 5, 18), place: { lat: 50.7, lng: 4.4, zoom: 5 } },
  { label: 'First World War begins', at: utc(1914, 6, 28), place: { lat: 48, lng: 16, zoom: 3.6 } },
  { label: 'Second World War begins', at: utc(1939, 8, 1), place: { lat: 51, lng: 17, zoom: 4 } },
  { label: 'Korean War begins', at: utc(1950, 5, 25), place: { lat: 38, lng: 127.5, zoom: 4.8 } },
  { label: 'Cuban missile crisis', at: utc(1962, 9, 16), place: { lat: 23, lng: -80, zoom: 4.2 } },
  { label: 'Berlin Wall falls', at: utc(1989, 10, 9), place: { lat: 52.5, lng: 13.4, zoom: 4.5 } },
  { label: 'Soviet Union dissolves', at: utc(1991, 11, 26), place: { lat: 55, lng: 60, zoom: 2.6 } },
  { label: 'September 11 attacks', at: utc(2001, 8, 11), place: { lat: 40.7, lng: -74, zoom: 4.5 }, families: ['terror'], note: 'Also shows attacks' },
  {
    label: 'COVID-19 pandemic', at: utc(2020, 2, 11), place: { lat: 25, lng: 10, zoom: 1.6 }, note: 'Also colours countries by weekly deaths',
    metric: 'owid:covid_weekly_deaths_pm', speed: 7 * 86_400,
  },
];
