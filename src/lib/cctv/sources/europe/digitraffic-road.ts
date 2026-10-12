import { haversine } from '@/lib/geo';
import { admitRoadCondition, type RoadCondition } from '@/lib/cctv/road-condition';
import { DIGITRAFFIC_PAIRS } from '@/lib/cctv/generated/digitraffic-pairs.generated';

/**
 * TAKIP — Fintraffic road-weather readings for the station each weathercam is paired with. CC BY 4.0, credit Fintraffic.
 * The pairing is Fintraffic's own (generated table); the distance is measured between the two positions.
 * KELI_1 is the surface state, TIE_1 road temperature, ILMA air temperature.
 */

export const WEATHER_STATIONS_URL = 'https://tie.digitraffic.fi/api/weather/v1/stations';
export const WEATHER_DATA_URL = 'https://tie.digitraffic.fi/api/weather/v1/stations/data';

export interface WeatherStation { id: number; name: string; lat: number; lng: number; state: string | null }
export interface SensorValue { name?: string; value?: number; measuredTime?: string; sensorValueDescriptionEn?: string }

/** Station states where Fintraffic itself doubts the readings. */
const FAULT_STATES = new Set(['FAULT_DOUBT', 'REPAIR_REQUEST_POSTED']);

export function parseWeatherStations(json: unknown): Map<number, WeatherStation> {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new Error('Digitraffic weather stations: unexpected response');
  const out = new Map<number, WeatherStation>();
  for (const f of features as { id?: unknown; geometry?: { coordinates?: number[] }; properties?: { name?: string; state?: string | null } }[]) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof f.id !== 'number' || typeof lat !== 'number' || typeof lng !== 'number') continue;
    out.set(f.id, { id: f.id, name: f.properties?.name ?? String(f.id), lat, lng, state: f.properties?.state ?? null });
  }
  return out;
}

export function parseWeatherData(json: unknown): Map<number, SensorValue[]> {
  const stations = (json as { stations?: unknown } | null)?.stations;
  if (!Array.isArray(stations)) throw new Error('Digitraffic weather data: unexpected response');
  const out = new Map<number, SensorValue[]>();
  for (const s of stations as { id?: unknown; sensorValues?: SensorValue[] }[]) {
    if (typeof s.id === 'number' && Array.isArray(s.sensorValues)) out.set(s.id, s.sensorValues);
  }
  return out;
}

export function digitrafficRoad(
  cameraId: string, camLat: number, camLng: number,
  stations: Map<number, WeatherStation>, data: Map<number, SensorValue[]>, now = Date.now(),
): RoadCondition | null {
  const stationId = DIGITRAFFIC_PAIRS[cameraId];
  const station = stationId == null ? undefined : stations.get(stationId);
  const sensors = stationId == null ? undefined : data.get(stationId);
  if (!station || !sensors || (station.state && FAULT_STATES.has(station.state))) return null;
  const get = (name: string) => sensors.find(s => s.name === name);
  const keli = get('KELI_1');
  const surface = keli?.sensorValueDescriptionEn?.trim();
  if (!surface || !keli?.measuredTime || /fault/i.test(surface)) return null;
  const temp = (name: string) => (typeof get(name)?.value === 'number' ? get(name)!.value : undefined);
  return admitRoadCondition({
    surface,
    road_temp: temp('TIE_1'),
    air_temp: temp('ILMA'),
    observed_at: keli.measuredTime,
    station: station.name,
    distance_km: Math.round(haversine([camLng, camLat], [station.lng, station.lat]) * 10) / 10,
    source: 'Fintraffic',
  }, now);
}
