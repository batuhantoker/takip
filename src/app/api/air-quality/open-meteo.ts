/**
 * TAKIP — modelled air quality (CAMS) per city from Open-Meteo, no key.
 * Data CC BY 4.0 (credit Open-Meteo / CAMS); the free API is non-commercial, so commercial use needs a plan.
 * Grid cells are tens of km wide, so this is a city's background air, not a street monitor.
 */

export interface AqCity { name: string; country: string; lat: number; lng: number }

export const AQ_CITIES: AqCity[] = [
  { name: 'London', country: 'GB', lat: 51.507, lng: -0.128 },
  { name: 'Paris', country: 'FR', lat: 48.857, lng: 2.352 },
  { name: 'Berlin', country: 'DE', lat: 52.52, lng: 13.405 },
  { name: 'Madrid', country: 'ES', lat: 40.417, lng: -3.704 },
  { name: 'Rome', country: 'IT', lat: 41.903, lng: 12.496 },
  { name: 'Warsaw', country: 'PL', lat: 52.23, lng: 21.012 },
  { name: 'Kyiv', country: 'UA', lat: 50.45, lng: 30.523 },
  { name: 'Moscow', country: 'RU', lat: 55.756, lng: 37.617 },
  { name: 'Istanbul', country: 'TR', lat: 41.008, lng: 28.978 },
  { name: 'Athens', country: 'GR', lat: 37.984, lng: 23.728 },
  { name: 'Cairo', country: 'EG', lat: 30.044, lng: 31.236 },
  { name: 'Lagos', country: 'NG', lat: 6.524, lng: 3.379 },
  { name: 'Kinshasa', country: 'CD', lat: -4.322, lng: 15.312 },
  { name: 'Nairobi', country: 'KE', lat: -1.286, lng: 36.817 },
  { name: 'Addis Ababa', country: 'ET', lat: 9.03, lng: 38.74 },
  { name: 'Johannesburg', country: 'ZA', lat: -26.204, lng: 28.047 },
  { name: 'Riyadh', country: 'SA', lat: 24.713, lng: 46.675 },
  { name: 'Dubai', country: 'AE', lat: 25.205, lng: 55.271 },
  { name: 'Tehran', country: 'IR', lat: 35.689, lng: 51.389 },
  { name: 'Baghdad', country: 'IQ', lat: 33.315, lng: 44.366 },
  { name: 'Karachi', country: 'PK', lat: 24.861, lng: 67.01 },
  { name: 'Lahore', country: 'PK', lat: 31.52, lng: 74.359 },
  { name: 'Delhi', country: 'IN', lat: 28.614, lng: 77.209 },
  { name: 'Mumbai', country: 'IN', lat: 19.076, lng: 72.878 },
  { name: 'Kolkata', country: 'IN', lat: 22.573, lng: 88.364 },
  { name: 'Dhaka', country: 'BD', lat: 23.811, lng: 90.413 },
  { name: 'Bangkok', country: 'TH', lat: 13.756, lng: 100.502 },
  { name: 'Hanoi', country: 'VN', lat: 21.028, lng: 105.834 },
  { name: 'Jakarta', country: 'ID', lat: -6.208, lng: 106.846 },
  { name: 'Manila', country: 'PH', lat: 14.6, lng: 120.984 },
  { name: 'Beijing', country: 'CN', lat: 39.904, lng: 116.407 },
  { name: 'Shanghai', country: 'CN', lat: 31.23, lng: 121.474 },
  { name: 'Chengdu', country: 'CN', lat: 30.573, lng: 104.066 },
  { name: 'Hong Kong', country: 'HK', lat: 22.319, lng: 114.169 },
  { name: 'Seoul', country: 'KR', lat: 37.567, lng: 126.978 },
  { name: 'Tokyo', country: 'JP', lat: 35.676, lng: 139.65 },
  { name: 'Ulaanbaatar', country: 'MN', lat: 47.886, lng: 106.906 },
  { name: 'Sydney', country: 'AU', lat: -33.869, lng: 151.209 },
  { name: 'Auckland', country: 'NZ', lat: -36.849, lng: 174.763 },
  { name: 'Los Angeles', country: 'US', lat: 34.052, lng: -118.244 },
  { name: 'Chicago', country: 'US', lat: 41.878, lng: -87.63 },
  { name: 'New York', country: 'US', lat: 40.713, lng: -74.006 },
  { name: 'Toronto', country: 'CA', lat: 43.653, lng: -79.383 },
  { name: 'Mexico City', country: 'MX', lat: 19.433, lng: -99.133 },
  { name: 'Bogotá', country: 'CO', lat: 4.711, lng: -74.072 },
  { name: 'Lima', country: 'PE', lat: -12.046, lng: -77.043 },
  { name: 'São Paulo', country: 'BR', lat: -23.551, lng: -46.633 },
  { name: 'Buenos Aires', country: 'AR', lat: -34.604, lng: -58.382 },
  { name: 'Santiago', country: 'CL', lat: -33.449, lng: -70.669 },
];

const VARS = 'pm2_5,pm10,us_aqi,european_aqi,nitrogen_dioxide,ozone';

export function openMeteoAqUrl(cities: AqCity[]): string {
  const lat = cities.map(c => c.lat).join(',');
  const lng = cities.map(c => c.lng).join(',');
  return `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=${VARS}&timezone=GMT`;
}

/** US EPA AQI bands. */
export function aqiBand(aqi: number): { level: string; color: string } {
  if (aqi > 300) return { level: 'Hazardous', color: '#7E0023' };
  if (aqi > 200) return { level: 'Very Unhealthy', color: '#8F3F97' };
  if (aqi > 150) return { level: 'Unhealthy', color: '#FF1744' };
  if (aqi > 100) return { level: 'Unhealthy (Sensitive)', color: '#FF9500' };
  if (aqi > 50) return { level: 'Moderate', color: '#FFD700' };
  return { level: 'Good', color: '#00E676' };
}

interface Current {
  time?: string;
  pm2_5?: number | null;
  pm10?: number | null;
  us_aqi?: number | null;
  european_aqi?: number | null;
  nitrogen_dioxide?: number | null;
  ozone?: number | null;
}

export interface AqReading {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  pm25: number;
  pm10: number | null;
  us_aqi: number;
  european_aqi: number | null;
  no2: number | null;
  o3: number | null;
  unit: 'µg/m³';
  level: string;
  color: string;
  lastUpdated: string | null;
  kind: 'modelled';
  source: 'Open-Meteo (CAMS)';
}

const val = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One answer per city, in request order; a single city comes back as an object, not an array. */
export function mapOpenMeteoAq(json: unknown, cities: AqCity[]): AqReading[] {
  const rows = Array.isArray(json) ? json : json && typeof json === 'object' && 'current' in json ? [json] : null;
  if (!rows) throw new Error('Open-Meteo AQ: unexpected response');
  return rows.flatMap((row, i) => {
    const city = cities[i];
    const c = (row as { current?: Current })?.current;
    const pm25 = val(c?.pm2_5);
    const aqi = val(c?.us_aqi);
    if (!city || !c || pm25 == null || aqi == null) return [];
    return [{
      id: `aq-${city.country.toLowerCase()}-${city.name.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-')}`,
      name: city.name,
      city: city.name,
      country: city.country,
      lat: city.lat,
      lng: city.lng,
      pm25,
      pm10: val(c.pm10),
      us_aqi: aqi,
      european_aqi: val(c.european_aqi),
      no2: val(c.nitrogen_dioxide),
      o3: val(c.ozone),
      unit: 'µg/m³',
      ...aqiBand(aqi),
      lastUpdated: c.time ? `${c.time}Z` : null,
      kind: 'modelled',
      source: 'Open-Meteo (CAMS)',
    }];
  });
}
