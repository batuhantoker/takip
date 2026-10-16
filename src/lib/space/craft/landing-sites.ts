/**
 * TAKIP — where spacecraft have landed on the Moon and Mars.
 * Planetocentric latitude, east longitude; crashes are left out.
 */

import type { GlobeWorldId } from '../worlds';

export type SiteKind = 'crewed' | 'rover' | 'lander' | 'sample-return';

export interface LandingSite {
  id: string;
  name: string;
  year: number;
  agency: string;
  kind: SiteKind;
  lat: number;
  lng: number;
  note?: string;
}

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  crewed: 'Crewed landing',
  rover: 'Rover',
  lander: 'Lander',
  'sample-return': 'Sample return',
};

export const LANDING_SITES: Record<GlobeWorldId, LandingSite[]> = {
  moon: [
    { id: 'luna-9', name: 'Luna 9', year: 1966, agency: 'USSR', kind: 'lander', lat: 7.08, lng: -64.37, note: 'First soft landing on another world.' },
    { id: 'surveyor-1', name: 'Surveyor 1', year: 1966, agency: 'NASA', kind: 'lander', lat: -2.474, lng: -43.339 },
    { id: 'surveyor-3', name: 'Surveyor 3', year: 1967, agency: 'NASA', kind: 'lander', lat: -3.016, lng: -23.418, note: 'Apollo 12 landed beside it and brought its camera home.' },
    { id: 'surveyor-5', name: 'Surveyor 5', year: 1967, agency: 'NASA', kind: 'lander', lat: 1.455, lng: 23.196 },
    { id: 'surveyor-6', name: 'Surveyor 6', year: 1967, agency: 'NASA', kind: 'lander', lat: 0.474, lng: -1.427 },
    { id: 'surveyor-7', name: 'Surveyor 7', year: 1968, agency: 'NASA', kind: 'lander', lat: -40.981, lng: -11.512 },
    { id: 'apollo-11', name: 'Apollo 11 · Tranquility Base', year: 1969, agency: 'NASA', kind: 'crewed', lat: 0.67408, lng: 23.47297, note: 'Armstrong and Aldrin, 20 July 1969.' },
    { id: 'apollo-12', name: 'Apollo 12', year: 1969, agency: 'NASA', kind: 'crewed', lat: -3.01239, lng: -23.42157 },
    { id: 'apollo-14', name: 'Apollo 14', year: 1971, agency: 'NASA', kind: 'crewed', lat: -3.6453, lng: -17.47136 },
    { id: 'apollo-15', name: 'Apollo 15', year: 1971, agency: 'NASA', kind: 'crewed', lat: 26.13222, lng: 3.63386, note: 'First Lunar Roving Vehicle.' },
    { id: 'apollo-16', name: 'Apollo 16', year: 1972, agency: 'NASA', kind: 'crewed', lat: -8.97301, lng: 15.50019 },
    { id: 'apollo-17', name: 'Apollo 17', year: 1972, agency: 'NASA', kind: 'crewed', lat: 20.1908, lng: 30.77168, note: 'The last crewed landing, December 1972.' },
    { id: 'luna-16', name: 'Luna 16', year: 1970, agency: 'USSR', kind: 'sample-return', lat: -0.5137, lng: 56.3638 },
    { id: 'lunokhod-1', name: 'Luna 17 · Lunokhod 1', year: 1970, agency: 'USSR', kind: 'rover', lat: 38.2378, lng: -35.0017, note: 'First robotic rover on another world.' },
    { id: 'luna-20', name: 'Luna 20', year: 1972, agency: 'USSR', kind: 'sample-return', lat: 3.7866, lng: 56.6297 },
    { id: 'lunokhod-2', name: 'Luna 21 · Lunokhod 2', year: 1973, agency: 'USSR', kind: 'rover', lat: 25.85, lng: 30.45 },
    { id: 'luna-24', name: 'Luna 24', year: 1976, agency: 'USSR', kind: 'sample-return', lat: 12.7145, lng: 62.2129 },
    { id: 'change-3', name: 'Chang’e 3 · Yutu', year: 2013, agency: 'CNSA', kind: 'rover', lat: 44.1214, lng: -19.5116 },
    { id: 'change-4', name: 'Chang’e 4 · Yutu-2', year: 2019, agency: 'CNSA', kind: 'rover', lat: -45.4446, lng: 177.5991, note: 'First landing on the far side, in Von Kármán crater.' },
    { id: 'change-5', name: 'Chang’e 5', year: 2020, agency: 'CNSA', kind: 'sample-return', lat: 43.0576, lng: -51.9161 },
    { id: 'chandrayaan-3', name: 'Chandrayaan-3 · Vikram & Pragyan', year: 2023, agency: 'ISRO', kind: 'rover', lat: -69.3741, lng: 32.3191, note: 'First landing near the south pole.' },
    { id: 'slim', name: 'SLIM', year: 2024, agency: 'JAXA', kind: 'lander', lat: -13.316, lng: 25.251, note: 'Landed within 100 m of its target, on its nose.' },
    { id: 'im-1', name: 'IM-1 · Odysseus', year: 2024, agency: 'Intuitive Machines', kind: 'lander', lat: -80.13, lng: 1.44, note: 'First commercial lunar landing.' },
    { id: 'change-6', name: 'Chang’e 6', year: 2024, agency: 'CNSA', kind: 'sample-return', lat: -41.6385, lng: -153.9852, note: 'First samples from the far side.' },
    { id: 'blue-ghost-1', name: 'Blue Ghost Mission 1', year: 2025, agency: 'Firefly Aerospace', kind: 'lander', lat: 18.56, lng: 61.81, note: 'Mare Crisium.' },
    { id: 'im-2', name: 'IM-2 · Athena', year: 2025, agency: 'Intuitive Machines', kind: 'lander', lat: -84.79, lng: 29.2, note: 'Near Mons Mouton; tipped over on landing.' },
  ],
  mars: [
    { id: 'mars-3', name: 'Mars 3', year: 1971, agency: 'USSR', kind: 'lander', lat: -45, lng: -158, note: 'First soft landing on Mars; fell silent after 20 seconds. Position approximate.' },
    { id: 'viking-1', name: 'Viking 1', year: 1976, agency: 'NASA', kind: 'lander', lat: 22.27, lng: -47.95, note: 'Chryse Planitia.' },
    { id: 'viking-2', name: 'Viking 2', year: 1976, agency: 'NASA', kind: 'lander', lat: 47.64, lng: 134.29, note: 'Utopia Planitia.' },
    { id: 'pathfinder', name: 'Mars Pathfinder · Sojourner', year: 1997, agency: 'NASA', kind: 'rover', lat: 19.13, lng: -33.22, note: 'Ares Vallis; the first Mars rover.' },
    { id: 'beagle-2', name: 'Beagle 2', year: 2003, agency: 'ESA · UK', kind: 'lander', lat: 11.5265, lng: 90.4295, note: 'Landed, but its panels never fully opened.' },
    { id: 'spirit', name: 'Spirit', year: 2004, agency: 'NASA', kind: 'rover', lat: -14.5684, lng: 175.4726, note: 'Gusev crater.' },
    { id: 'opportunity', name: 'Opportunity', year: 2004, agency: 'NASA', kind: 'rover', lat: -1.9462, lng: -5.5272, note: 'Meridiani Planum; drove 45 km in 14 years.' },
    { id: 'phoenix', name: 'Phoenix', year: 2008, agency: 'NASA', kind: 'lander', lat: 68.22, lng: -125.7, note: 'Dug up water ice in the northern plains.' },
    { id: 'curiosity-landing', name: 'Curiosity · Bradbury Landing', year: 2012, agency: 'NASA', kind: 'rover', lat: -4.5895, lng: 137.4417, note: 'Gale crater.' },
    { id: 'insight', name: 'InSight', year: 2018, agency: 'NASA', kind: 'lander', lat: 4.5024, lng: 135.6234, note: 'Elysium Planitia; recorded over 1,300 marsquakes.' },
    { id: 'perseverance-landing', name: 'Perseverance · Octavia E. Butler Landing', year: 2021, agency: 'NASA', kind: 'rover', lat: 18.4447, lng: 77.4508, note: 'Jezero crater.' },
    { id: 'zhurong', name: 'Tianwen-1 · Zhurong', year: 2021, agency: 'CNSA', kind: 'rover', lat: 25.066, lng: 109.925, note: 'Utopia Planitia.' },
  ],
};

/** The fleet's landers by Horizons ID: where each came down, and the rover key NASA publishes its position under. */
export const LANDER_SITES: Record<number, { world: GlobeWorldId; site: string; rover?: string }> = {
  [-76]: { world: 'mars', site: 'curiosity-landing', rover: 'curiosity' },
  [-168]: { world: 'mars', site: 'perseverance-landing', rover: 'perseverance' },
  [-189]: { world: 'mars', site: 'insight' },
  [-253]: { world: 'mars', site: 'opportunity' },
  [-254]: { world: 'mars', site: 'spirit' },
};

/** The landing site nearest a spot, within `maxDeg`. */
export function siteNear(world: GlobeWorldId, lat: number, lng: number, maxDeg = 1): LandingSite | null {
  let best: LandingSite | null = null, bestDeg = maxDeg;
  for (const s of LANDING_SITES[world]) {
    const d = Math.hypot(s.lat - lat, ((s.lng - lng + 540) % 360 - 180) * Math.cos(lat * Math.PI / 180));
    if (d < bestDeg) { best = s; bestDeg = d; }
  }
  return best;
}
