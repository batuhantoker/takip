/**
 * TAKIP — numbers for the space views, at the precision they deserve.
 */

import { AU_KM } from './astro';

/** Kilometres up to a few million, astronomical units beyond. */
export function distance(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 10_000) return `${Math.round(km).toLocaleString('en-US')} km`;
  if (km < 5_000_000) return `${(Math.round(km / 100) * 100).toLocaleString('en-US')} km`;
  const au = km / AU_KM;
  return `${au < 10 ? au.toFixed(3) : au.toFixed(1)} AU`;
}

/** One-way light time: "1.3 s", "8 min 19 s", "23 h 14 min". */
export function lightTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ${Math.round(seconds - m * 60)} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${m - h * 60} min`;
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
