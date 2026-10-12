import { rgb } from './arcs';
import { outcomeColor } from './forecast';
import type { RunState } from './state';
import type { Move } from './types';

/**
 * OI's palette: violet where actors align or work together, magenta where
 * they oppose or dispute, indigo for everything in between. The Style Studio
 * can change all three (see map-palette); these are the defaults.
 */
export interface ToneColors { support: string; oppose: string; neutral: string }
export const DEFAULT_TONES: ToneColors = { support: '#b388ff', oppose: '#ff5ccb', neutral: '#8c7cff' };

/** A colour lifted toward white: actors read as the brightest points of the web. */
export function lift(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex).map(v => Math.round((v + (1 - v) * amount) * 255));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

const LEAN_STOPS: [number, number, number][] = [[0x6e, 0x8b, 0xff], [0xb3, 0x88, 0xff], [0xff, 0x5c, 0xcb]];

/** OI's lean: indigo toward NO (or lower), magenta toward YES (or higher), violet between. */
export function leanColor(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '#b388ff';
  const x = Math.min(1, Math.max(0, p));
  const [a, b] = x <= 0.5 ? [LEAN_STOPS[0], LEAN_STOPS[1]] : [LEAN_STOPS[1], LEAN_STOPS[2]];
  const t = x <= 0.5 ? x / 0.5 : (x - 0.5) / 0.5;
  return `#${a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A cast actor's colour: the way its latest move pushes (magenta toward YES
 * or higher, indigo toward NO or lower, violet when it holds), or on a choice
 * question the outcome it works for.
 */
export function actorTint(s: RunState, move: Move | undefined): string {
  if (!move) return '#b388ff';
  if (s.frame?.kind === 'choice' && move.favors) return outcomeColor(Math.max(0, s.frame.outcomes.indexOf(move.favors)));
  return leanColor(move.push === 'yes' ? 0.88 : move.push === 'no' ? 0.12 : 0.5);
}
