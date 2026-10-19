/**
 * TAKIP — how a flight replay reads out time: the date it shows, its playback
 * speeds, and how long until the next event.
 */

import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, msg, type Translate } from '@/lib/core/i18n/translator';
import { msFromJd } from '../horizons';

const ENGLISH = createTranslator(DEFAULT_LOCALE, {});

/** Playback speeds, days of flight per second. */
export const RATES: { days: number; label: string }[] = [
  { days: 1 / 24, label: msg('1 hour/s') },
  { days: 0.25, label: msg('6 hours/s') },
  { days: 1, label: msg('1 day/s') },
  { days: 7, label: msg('1 week/s') },
  { days: 30.44, label: msg('1 month/s') },
  { days: 91.31, label: msg('3 months/s') },
  { days: 365.25, label: msg('1 year/s') },
  { days: 1095.75, label: msg('3 years/s') },
];

/** "1979-03-05 12:05 UTC". */
export function replayDate(jd: number): string {
  const d = new Date(msFromJd(jd));
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

/** "3 min", "5 h 20 min", "12 d 4 h", "1 y 249 d". */
export function span(days: number, t: Translate = ENGLISH): string {
  if (!Number.isFinite(days)) return '—';
  if (days < 1 / 24) return t('{n} min', { n: Math.max(1, Math.round(days * 1440)) });
  if (days < 1) {
    const h = Math.floor(days * 24);
    return t('{h} h {m} min', { h, m: Math.round((days * 24 - h) * 60) });
  }
  if (days < 365.25) {
    const d = Math.floor(days);
    return t('{d} d {h} h', { d, h: Math.round((days - d) * 24) });
  }
  const y = Math.floor(days / 365.25);
  return t('{y} y {d} d', { y, d: Math.round(days - y * 365.25) });
}

/** A playback rate as a readable speed: "2.4 hours/s", "5 days/s". */
export function rateLabel(days: number, t: Translate = ENGLISH): string {
  if (days < 1 / 24) return t('{n} min/s', { n: Math.max(1, Math.round(days * 1440)) });
  if (days < 1) return t('{n} hours/s', { n: +(days * 24).toFixed(days * 24 < 10 ? 1 : 0) });
  if (days < 60) return t('{n} days/s', { n: +days.toFixed(days < 10 ? 1 : 0) });
  return t('{n} months/s', { n: +(days / 30.44).toFixed(1) });
}
