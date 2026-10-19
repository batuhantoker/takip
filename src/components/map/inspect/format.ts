import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, msg, type Translate } from '@/lib/core/i18n/translator';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const ENGLISH = createTranslator(DEFAULT_LOCALE, {});

export const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** "W" for 274°. */
export function compass(deg: number): string {
  const n = ((Math.round(deg) % 360) + 360) % 360;
  return COMPASS[Math.round(n / 45) % 8];
}

/** 40.7128° N, 74.0060° W */
export function coords(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
}

/** "just now", "40 s ago", "3 min ago" */
export function ago(ms: number, t: Translate = ENGLISH): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return t('just now');
  if (s < 60) return t('{n} s ago', { n: s });
  const m = Math.round(s / 60);
  if (m < 60) return t('{n} min ago', { n: m });
  return t('{n} h ago', { n: Math.round(m / 60) });
}

export function clockTime(iso: string | null | undefined, locale?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(locale ?? [], { hour: '2-digit', minute: '2-digit' });
}

/**
 * A coarse ocean name for positions the geocoder has no answer for.
 * Boxes, not coastlines: good enough to say "over the North Atlantic".
 */
export function seaName(lat: number, lng: number): string {
  if (lat > 66) return msg('Arctic Ocean');
  if (lat < -60) return msg('Southern Ocean');
  if (lat > 30 && lat < 46 && lng > -6 && lng < 36) return msg('Mediterranean Sea');
  if (lat > 10 && lat < 30 && lng > 32 && lng < 44) return msg('Red Sea');
  if (lat > 18 && lat < 31 && lng > -98 && lng < -81) return msg('Gulf of Mexico');
  if (lat > 9 && lat < 22 && lng > -88 && lng < -60) return msg('Caribbean Sea');
  if (lat >= 0 && lng > -100 && lng < 20 && !(lat < 15 && lng < -78)) return msg('North Atlantic Ocean');
  if (lat < 0 && lng > -68 && lng < 20) return msg('South Atlantic Ocean');
  if (lng >= 20 && lng < 120 && lat < 25) return msg('Indian Ocean');
  return lat >= 0 ? msg('North Pacific Ocean') : msg('South Pacific Ocean');
}

/** 274 → "274°", -90 → "270°". */
export const bearing = (deg: number) => `${((Math.round(deg) % 360) + 360) % 360}°`;
