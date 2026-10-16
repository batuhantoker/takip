import { stealthFetch } from '@/lib/core/net/stealth-fetch';
import {
  WEATHER_DATA_URL, WEATHER_STATIONS_URL, digitrafficRoad, parseWeatherData, parseWeatherStations,
} from './digitraffic-road';

/**
 * TAKIP — Finland CCTV Cameras (Digitraffic / Fintraffic)
 * Source: https://tie.digitraffic.fi/api/weathercam/v1/stations
 * ~470 weathercam stations across Finland — NO API KEY NEEDED
 * Each camera also carries its paired road-weather station's surface reading, when there is one (./digitraffic-road).
 */

async function weatherFor(): Promise<{ stations: ReturnType<typeof parseWeatherStations>; data: ReturnType<typeof parseWeatherData> } | null> {
  const headers = { 'User-Agent': 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)', 'Digitraffic-User': 'TAKIP/0.1', 'Accept-Encoding': 'gzip' };
  try {
    const [stations, data] = await Promise.all([WEATHER_STATIONS_URL, WEATHER_DATA_URL].map(async url => {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`Digitraffic weather HTTP ${res.status}`);
      return res.json();
    }));
    return { stations: parseWeatherStations(stations), data: parseWeatherData(data) };
  } catch (e) {
    console.warn('[TAKIP] Digitraffic road weather unavailable:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function fetchFinlandCameras(): Promise<any[]> {
  try {
    const [res, weather] = await Promise.all([
      stealthFetch('https://tie.digitraffic.fi/api/weathercam/v1/stations', {
        signal: AbortSignal.timeout(12000),
        headers: { 'Digitraffic-User': 'TAKIP/0.1' },
      }),
      weatherFor(),
    ]);
    if (!res.ok) return [];

    const data = await res.json();
    const cams: any[] = [];

    for (const feature of (data.features || [])) {
      const coords = feature.geometry?.coordinates;
      const props = feature.properties;
      if (!coords || coords.length < 2 || !props) continue;

      const presets = props.presets || [];
      if (presets.length === 0) continue;

      // Use the first preset's image URL
      const preset = presets[0];
      const imageUrl = preset.imageUrl || `https://weathercam.digitraffic.fi/${preset.id}.jpg`;

      const road = weather ? digitrafficRoad(String(feature.id || props.id), coords[1], coords[0], weather.stations, weather.data) : null;
      cams.push({
        ...(road ? { road } : {}),
        id: `fin-${feature.id || props.id}`,
        lat: coords[1],
        lng: coords[0],
        name: props.name || props.names?.fi || 'Finland Weathercam',
        city: props.municipality || 'Finland',
        country: 'Finland',
        feed_url: imageUrl,
        source: 'Fintraffic',
      });
    }

    return cams;
  } catch (e) {
    return [];
  }
}
