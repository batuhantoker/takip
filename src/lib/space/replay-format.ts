/**
 * TAKIP — how a flight replay reads out time: the date it shows, its playback
 * speeds, and how long until the next event.
 */

import { msFromJd } from './horizons';

/** Playback speeds, days of flight per second. */
export const RATES: { days: number; label: string }[] = [
  { days: 1 / 24, label: '1 hour/s' },
  { days: 0.25, label: '6 hours/s' },
  { days: 1, label: '1 day/s' },
  { days: 7, label: '1 week/s' },
  { days: 30.44, label: '1 month/s' },
  { days: 91.31, label: '3 months/s' },
  { days: 365.25, label: '1 year/s' },
  { days: 1095.75, label: '3 years/s' },
];

/** "1979-03-05 12:05 UTC". */
export function replayDate(jd: number): string {
  const d = new Date(msFromJd(jd));
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

/** "3 min", "5 h 20 min", "12 d 4 h", "1 y 249 d". */
export function span(days: number): string {
  if (!Number.isFinite(days)) return '—';
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))} min`;
  if (days < 1) {
    const h = Math.floor(days * 24);
    return `${h} h ${Math.round((days * 24 - h) * 60)} min`;
  }
  if (days < 365.25) {
    const d = Math.floor(days);
    return `${d} d ${Math.round((days - d) * 24)} h`;
  }
  const y = Math.floor(days / 365.25);
  return `${y} y ${Math.round(days - y * 365.25)} d`;
}

/** A playback rate as a readable speed: "2.4 hours/s", "5 days/s". */
export function rateLabel(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))} min/s`;
  if (days < 1) return `${+(days * 24).toFixed(days * 24 < 10 ? 1 : 0)} hours/s`;
  if (days < 60) return `${+days.toFixed(days < 10 ? 1 : 0)} days/s`;
  return `${+(days / 30.44).toFixed(1)} months/s`;
}
