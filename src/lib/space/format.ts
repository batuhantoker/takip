/**
 * TAKIP — numbers for the space views, at the precision they deserve.
 */

import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, type Translate } from '@/lib/core/i18n/translator';
import { AU_KM, LY_KM } from './astro';

const ENGLISH = createTranslator(DEFAULT_LOCALE, {});

const fixed = (n: number, digits: number, tag: string) =>
  n.toLocaleString(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "2.54 million", "45.3 billion", "453亿": three significant digits, in the locale's own words for big numbers. */
export const compact = (n: number, tag: string, minDigits = 3) =>
  new Intl.NumberFormat(tag, { notation: 'compact', compactDisplay: 'long', minimumSignificantDigits: minDigits, maximumSignificantDigits: 3 }).format(n);

/** Kilometres up to a few million, astronomical units to the Oort cloud, light-years beyond. */
export function distance(km: number, t: Translate = ENGLISH): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 10_000) return `${fixed(Math.round(km), 0, t.intl)} km`;
  if (km < 5_000_000) return `${fixed(Math.round(km / 100) * 100, 0, t.intl)} km`;
  const au = km / AU_KM;
  if (au < 10_000) return `${fixed(au, au < 10 ? 3 : au < 1000 ? 1 : 0, t.intl)} AU`;
  const ly = km / LY_KM;
  return `${ly < 1e6 ? lightYears(ly, t.intl) : compact(ly, t.intl)} ly`;
}

function lightYears(ly: number, tag: string): string {
  if (ly < 10) return fixed(ly, 2, tag);
  if (ly < 100) return fixed(ly, 1, tag);
  return fixed(Math.round(ly), 0, tag);
}

/** One-way light time: "1.3 s", "8 min 19 s", "23 h 14 min", "5.8 days", "4.24 years". */
export function lightTime(seconds: number, t: Translate = ENGLISH): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return t('{n} s', { n: fixed(seconds, 1, t.intl) });
  const m = Math.floor(seconds / 60);
  if (m < 60) return t('{m} min {s} s', { m, s: Math.round(seconds - m * 60) });
  const h = Math.floor(m / 60);
  if (h < 48) return t('{h} h {m} min', { h, m: m - h * 60 });
  const days = seconds / 86_400;
  if (days < 365.25) return t('{n, plural, one {# day} other {# days}}', { n: days < 10 ? +days.toFixed(1) : Math.round(days) });
  const years = days / 365.25;
  if (years < 1e6) return t('{n, plural, one {# year} other {# years}}', { n: years < 10 ? +years.toFixed(2) : years < 100 ? +years.toFixed(1) : Math.round(years) });
  return t('{amount} years', { amount: compact(years, t.intl) });
}

export function speed(kmS: number, t: Translate = ENGLISH): string {
  return Number.isFinite(kmS) ? `${fixed(kmS, kmS < 10 ? 2 : 1, t.intl)} km/s` : '—';
}

/** "3 min ago", "2 h ago", "4 d ago" — for frame and data timestamps. */
export function age(iso: string | null, now = Date.now(), t: Translate = ENGLISH): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return t('time unknown');
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 90) return t('just now');
  if (s < 5400) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 172_800) return t('{n} h ago', { n: Math.round(s / 3600) });
  return t('{n} d ago', { n: Math.round(s / 86_400) });
}

export function latLng(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}
