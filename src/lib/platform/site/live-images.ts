import { msg } from '@/lib/core/i18n/translator';
import { ownApi } from './live/own-api';

/**
 * The latest picture of the Sun or the Earth, served at /live/<file>.jpg from TAKIP's own address so image
 * search credits the page that shows it (app/live/[file]). `taken` and `latest` are captions with and without
 * the frame's time.
 */

export type LiveImageId = 'sun' | 'earth';

export interface LiveImageSpec {
  file: string;
  size: number;
  /** For the ImageObject, as the source asks to be credited. */
  credit: string;
  alt: string;
  taken: string;
  latest: string;
}

export const LIVE_IMAGES: Record<LiveImageId, LiveImageSpec> = {
  sun: {
    file: 'sun-sdo-171',
    size: 1024,
    credit: 'NASA/SDO and the AIA science team, via Helioviewer',
    alt: msg('The Sun today in extreme ultraviolet light at 171 Å, showing its corona, loops and active regions, in the latest image from NASA’s Solar Dynamics Observatory'),
    taken: msg('Taken at {time} by NASA’s Solar Dynamics Observatory (AIA, 171 Å), through Helioviewer. Checked every 10 minutes.'),
    latest: msg('The latest frame from NASA’s Solar Dynamics Observatory (AIA, 171 Å), through Helioviewer. Checked every 10 minutes.'),
  },
  earth: {
    file: 'earth-meteosat',
    size: 1024,
    credit: '© EUMETSAT',
    alt: msg('The Earth from space as Meteosat sees it from 36,000 km above 0° longitude: Europe, Africa, the Middle East and the Atlantic in GeoColour'),
    taken: msg('Taken at {time} by Meteosat-12 above 0° longitude. GeoColour imagery © EUMETSAT, redrawn by TAKIP as the satellite sees it. Checked every 10 minutes.'),
    latest: msg('The latest frame from Meteosat-12 above 0° longitude. GeoColour imagery © EUMETSAT, redrawn by TAKIP as the satellite sees it. Checked every 10 minutes.'),
  },
};

export const liveImagePath = (id: LiveImageId) => `/live/${LIVE_IMAGES[id].file}.jpg`;

export const liveImageByFile = (file: string): LiveImageId | null =>
  (Object.keys(LIVE_IMAGES) as LiveImageId[]).find(id => LIVE_IMAGES[id].file === file) ?? null;

/** What /live/<file>.json answers. */
export interface LiveImageInfo { taken: string }

/** When the picture now served was taken, epoch ms; null when it isn't known yet. */
export async function liveImageTaken(id: LiveImageId): Promise<number | null> {
  const info = await ownApi<LiveImageInfo>(`/live/${LIVE_IMAGES[id].file}.json`, 300);
  const at = info ? Date.parse(info.taken) : NaN;
  return Number.isFinite(at) ? at : null;
}
