import type { CctvCamera } from './types';

const TURKEY_CAMERAS: CctvCamera[] = [
  {
    id: 'tr-kapikule',
    lat: 41.717, lng: 26.33,
    name: 'Kapıkule – Kapitan Andreevo Border', city: 'Edirne', country: 'Turkey',
    external_url: 'https://weather-webcam.eu/svilengrad-kapitan-andreevo-kapakule-odrin-live-kamera/',
    source: 'weather-webcam.eu',
  },
];

export async function fetchTurkeyCameras(): Promise<CctvCamera[]> {
  return TURKEY_CAMERAS.filter((cam) => cam.feed_url || cam.stream_url || cam.external_url);
}
