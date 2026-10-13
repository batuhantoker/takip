/**
 * TAKIP — numbers for the space views, at the precision they deserve.
 */

import { AU_KM, LY_KM } from './astro';

/** Kilometres up to a few million, astronomical units to the Oort cloud, light-years beyond. */
export function distance(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 10_000) return `${Math.round(km).toLocaleString('en-US')} km`;
  if (km < 5_000_000) return `${(Math.round(km / 100) * 100).toLocaleString('en-US')} km`;
  const au = km / AU_KM;
  if (au < 10_000) return `${au < 10 ? au.toFixed(3) : au < 1000 ? au.toFixed(1) : Math.round(au).toLocaleString('en-US')} AU`;
  return `${lightYears(km / LY_KM)} ly`;
}

function lightYears(ly: number): string {
  if (ly < 10) return ly.toFixed(2);
  if (ly < 100) return ly.toFixed(1);
  if (ly < 1e6) return Math.round(ly).toLocaleString('en-US');
  if (ly < 1e9) return `${+(ly / 1e6).toFixed(ly < 1e7 ? 2 : ly < 1e8 ? 1 : 0)} million`;
  return `${(ly / 1e9).toFixed(ly < 1e10 ? 2 : 1)} billion`;
}

/** One-way light time: "1.3 s", "8 min 19 s", "23 h 14 min", "5.8 days", "4.24 years". */
export function lightTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ${Math.round(seconds - m * 60)} s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m - h * 60} min`;
  const days = seconds / 86_400;
  if (days < 365.25) return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
  return `${lightYears(days / 365.25)} years`;
}

export function speed(kmS: number): string {
  return Number.isFinite(kmS) ? `${kmS < 10 ? kmS.toFixed(2) : kmS.toFixed(1)} km/s` : '—';
}

/** "3 min ago", "2 h ago", "4 d ago" — for frame and data timestamps. */
export function age(iso: string | null, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return 'time unknown';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172_800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

export function latLng(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}
