/**
 * Reading model output. Models are asked for JSON and mostly comply, but they
 * wrap it in prose, fence it in markdown, think out loud before it, leave
 * trailing commas and write "45%" for 0.45. Everything here is defensive: a
 * value that is missing or out of range becomes a safe default, never a crash,
 * and nothing the model writes reaches the page as markup (it is rendered as
 * text) or grows beyond a fixed length.
 */

import { centroidFor } from '@/lib/places/country-centroids';
import type { Located } from '../types';

/** The first JSON object in a model's reply. Throws when there is none. */
export function extractJson(text: string): Record<string, unknown> {
  let s = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  const start = s.indexOf('{');
  if (start < 0) throw new Error('no JSON object in the reply');
  s = s.slice(start);

  // Walk to the brace that closes the first one, minding strings.
  let depth = 0;
  let inString = false;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = i; break; }
  }
  const body = end >= 0 ? s.slice(0, end + 1) : s;

  for (const candidate of [body, body.replace(/,\s*([}\]])/g, '$1')]) {
    try {
      const v = JSON.parse(candidate);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch { /* try the next repair */ }
  }
  throw new Error('the reply was not valid JSON');
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A number in range, from a number or a numeric string. */
export function num(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
}

/**
 * A probability in [0.01, 0.99]. Reads 0.45, "0.45", 45 and "45%" alike.
 * Never 0 or 1: a world that has not settled the question is not certain of it; only a resolution is.
 */
export function prob(v: unknown, fallback: number): number {
  let n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  if (n > 1 && n <= 100) n /= 100;
  return clamp(n, 0.01, 0.99);
}

/** Plain text: control characters out, whitespace collapsed, cut to `max`. */
export function text(v: unknown, max: number, fallback = ''): string {
  if (typeof v !== 'string' && typeof v !== 'number') return fallback;
  const s = String(v).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return fallback;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** A short id: lowercase letters, digits, underscore. */
export function slug(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) : '';
  return s || fallback;
}

export function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : '';
  return (options as readonly string[]).includes(s) ? (s as T) : fallback;
}

export function list(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** A model-given place. Falls back to the country's centroid, then to nowhere. (0, 0) is a missing value, not the Gulf of Guinea. */
export function locate(v: Record<string, unknown>, fallbackPlace = ''): Located {
  const place = text(v.place ?? v.location ?? v.city, 80, fallbackPlace);
  const lat = num(v.lat ?? v.latitude, -90, 90, NaN);
  const lng = num(v.lng ?? v.lon ?? v.longitude, -180, 180, NaN);
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
    && Math.abs(lat) <= 85;
  if (valid) return { place, lat: round4(lat), lng: round4(lng) };
  const c = centroidFor(typeof v.country === 'string' ? v.country.toUpperCase().slice(0, 2) : null);
  if (c) return { place, lat: c[1], lng: c[0] };
  return { place, lat: null, lng: null };
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Nodes that share a spot (three actors "in Washington") are fanned out on a
 * small ring, so arcs between them have length and their markers do not stack.
 */
export function spreadDuplicates<T extends Located>(nodes: T[], radiusDeg = 0.9): T[] {
  const groups = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    if (n.lat === null || n.lng === null) return;
    const k = `${n.lat.toFixed(1)},${n.lng.toFixed(1)}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const out = nodes.slice();
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    idx.forEach((i, j) => {
      const n = out[i];
      const a = (2 * Math.PI * j) / idx.length;
      const lat = clamp(n.lat! + radiusDeg * Math.sin(a), -85, 85);
      const lng = n.lng! + (radiusDeg * Math.cos(a)) / Math.max(0.2, Math.cos((n.lat! * Math.PI) / 180));
      out[i] = { ...n, lat: round4(lat), lng: round4(((lng + 540) % 360) - 180) };
    });
  }
  return out;
}

/** The outcome a driver or signpost helps, matched to the frame's labels. */
export function favored(v: unknown, outcomes: string[]): string {
  const s = text(v, 60).toLowerCase();
  if (!s) return '';
  return outcomes.find(o => o.toLowerCase() === s) ?? outcomes.find(o => s.includes(o.toLowerCase()) || o.toLowerCase().includes(s)) ?? '';
}
