/**
 * °C or °F for the temperature layer. Until someone picks, it follows the
 * device's time zone (location without a permission prompt); the browser
 * language only decides when the zone is plain UTC.
 */
import { useSyncExternalStore } from 'react';

export type TemperatureUnit = 'c' | 'f';

// The US and its territories, Liberia, the Bahamas, the Cayman Islands, Belize, Palau, Micronesia, the Marshall Islands.
const FAHRENHEIT_REGIONS = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM', 'LR', 'BS', 'KY', 'BZ', 'PW', 'FM', 'MH']);
const FAHRENHEIT_ZONE_PREFIXES = ['US/', 'America/Indiana/', 'America/Kentucky/', 'America/North_Dakota/'];
const FAHRENHEIT_ZONES = new Set([
  'America/New_York', 'America/Detroit', 'America/Chicago', 'America/Menominee', 'America/Denver', 'America/Boise',
  'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'America/Juneau', 'America/Sitka', 'America/Metlakatla',
  'America/Yakutat', 'America/Nome', 'America/Adak', 'Pacific/Honolulu',
  // Old aliases some browsers still report.
  'America/Indianapolis', 'America/Fort_Wayne', 'America/Louisville', 'America/Knox_IN', 'America/Atka', 'America/Shiprock', 'Navajo',
  'America/Puerto_Rico', 'America/St_Thomas', 'America/Virgin', 'Pacific/Guam', 'Pacific/Saipan', 'Pacific/Pago_Pago', 'Pacific/Samoa',
  'Pacific/Midway', 'Pacific/Wake', 'Pacific/Johnston',
  'Africa/Monrovia', 'America/Nassau', 'America/Cayman', 'America/Belize', 'Pacific/Palau',
  'Pacific/Majuro', 'Pacific/Kwajalein', 'Kwajalein', 'Pacific/Pohnpei', 'Pacific/Ponape', 'Pacific/Chuuk', 'Pacific/Truk', 'Pacific/Yap', 'Pacific/Kosrae',
]);

const regionOf = (locale: string): string | undefined => {
  try {
    return new Intl.Locale(locale).region;
  } catch {
    return undefined;
  }
};

/** The unit people use where this device is set. */
export function defaultTemperatureUnit(timeZone: string | undefined, locale: string | undefined): TemperatureUnit {
  const zone = timeZone ?? '';
  if (FAHRENHEIT_ZONES.has(zone) || FAHRENHEIT_ZONE_PREFIXES.some(p => zone.startsWith(p))) return 'f';
  const zoneSaysNothing = !zone || zone === 'UTC' || zone.startsWith('Etc/');
  // A bare "en" has no region; maximize() would call it US, so it isn't used.
  return zoneSaysNothing && locale && FAHRENHEIT_REGIONS.has(regionOf(locale) ?? '') ? 'f' : 'c';
}

export const toUnit = (celsius: number, unit: TemperatureUnit) => (unit === 'f' ? celsius * 1.8 + 32 : celsius);

export const unitSymbol = (unit: TemperatureUnit) => (unit === 'f' ? '°F' : '°C');

/** "72.3 °F"; null when there is no reading. */
export function formatTemperature(celsius: unknown, unit: TemperatureUnit, digits = 1): string | null {
  const n = Number(celsius);
  if (celsius == null || celsius === '' || !Number.isFinite(n)) return null;
  return `${toUnit(n, unit).toFixed(digits)} ${unitSymbol(unit)}`;
}

const STORAGE_KEY = 'takip.temperatureUnit';
const listeners = new Set<() => void>();
let current: TemperatureUnit | null = null;

function deviceDefault(): TemperatureUnit {
  try {
    return defaultTemperatureUnit(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language);
  } catch {
    return 'c';
  }
}

export function getTemperatureUnit(): TemperatureUnit {
  if (current) return current;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch { /* private mode */ }
  current = stored === 'c' || stored === 'f' ? stored : deviceDefault();
  return current;
}

export function setTemperatureUnit(next: TemperatureUnit) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch { /* private mode: the choice lasts for this visit */ }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const useTemperatureUnit = () => useSyncExternalStore(subscribe, getTemperatureUnit, () => 'c' as const);
