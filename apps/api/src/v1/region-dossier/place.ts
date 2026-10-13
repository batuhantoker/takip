import { httpJson } from '@takip/connectors/http-json';
import { cachedSource } from '@takip/connectors/source-cache';

/*
 * Which place a coordinate falls in, from Photon — komoot's geocoder over
 * OpenStreetMap, which the search box already uses.
 *
 * This used to go through lib/places/nominatim.ts, whose one queue the whole app
 * shares and which may send one request every two seconds, as Nominatim's
 * policy requires. The hover label, the alert pins and search all wait in the
 * same line; in production it sat full at 40, so a right-click was refused in
 * a fifth of a second and the dossier came back empty. A dossier is one lookup
 * per deliberate click, well inside Photon's fair use, and it no longer waits
 * behind anyone.
 *
 * Rounded to ~100 m, which is plenty for naming a city and lets a second click
 * on the same spot come from the cache instead of Photon.
 */
export interface PhotonPlace { city?: string; state?: string; country?: string; countrycode?: string }
const PLACE_TTL_MS = 24 * 60 * 60 * 1000;

export async function placeAt(lat: number, lng: number): Promise<PhotonPlace | null> {
  const at = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const rows = await cachedSource<PhotonPlace>(`dossier:place:${at}`, async () => {
    /* One retry. Photon's public server answers 503 in short bursts — two in
       a row were seen while this was being tested, and it was answering again
       seconds later — and a single miss would otherwise be an empty panel. */
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        /* radius=50 (km). Photon names the nearest OpenStreetMap object, and by
           default looks only a short way — farmland outside Granby, the Sahara,
           Siberia and the Amazon all came back with nothing, so the dossier
           was empty for most of the world's land. Fifty is the smallest radius
           that found a place for each; the nearest still wins, so a click in a
           city names that city. */
        const json = await httpJson<{ features?: { properties?: PhotonPlace }[] }>(
          `https://photon.komoot.io/reverse?lat=${lat.toFixed(3)}&lon=${lng.toFixed(3)}&lang=en&radius=50`,
          { timeoutMs: 8000 },
        );
        const found = json.features?.[0]?.properties;
        return found ? [found] : [];  // open sea has no place, and no dossier
      } catch (e) {
        console.warn(`[TAKIP] Photon reverse failed (attempt ${attempt}):`, e instanceof Error ? e.message : e);
        if (attempt === 1) await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    return [];
  }, PLACE_TTL_MS)();
  return rows[0] ?? null;
}
