import type { ExpressionSpecification } from 'maplibre-gl';
import { MAP_INK } from '@/lib/map/style/tokens';

/**
 * How the 3D buildings are painted: a look and how solid they are, saved in this browser.
 * Each look is one hue rising out of the ground's dark with height, never a rainbow:
 * the tiles carry a height but no building type, so colour only ever says "taller".
 */
export type BuildingLook = 'stone' | 'accent' | 'sand' | 'violet';
export interface BuildingStyle { look: BuildingLook; opacity: number }

export const BUILDINGS_LAYER = 'takip-3d-buildings';

export const BUILDING_LOOKS: { id: BuildingLook; label: string }[] = [
  { id: 'stone', label: 'Stone' },
  { id: 'accent', label: 'Accent' },
  { id: 'sand', label: 'Sand' },
  { id: 'violet', label: 'Violet' },
];

export const BUILDING_DEFAULTS: BuildingStyle = { look: 'stone', opacity: 1 };
export const MIN_OPACITY = 0.25;

const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i;

/** The theme's accent, which the Style studio can change; the default accent before the page has styles. */
export function readAccent(): string {
  if (typeof document === 'undefined') return MAP_INK.blue;
  const v = getComputedStyle(document.body).getPropertyValue('--accent').trim();
  return COLOUR.test(v) ? v : MAP_INK.blue;
}

/** The hue a look rises to. */
export function lookTone(look: BuildingLook, accent: string): string {
  if (look === 'accent') return accent;
  if (look === 'sand') return MAP_INK.sand;
  if (look === 'violet') return MAP_INK.violet;
  return MAP_INK.ink3;
}

/** Stone greys by 150 m; a colour look reaches its hue by 60 m, where most of a city stands, and only the tallest towers pale. */
export function buildingColor(look: BuildingLook, accent: string): ExpressionSpecification {
  const height: ExpressionSpecification = ['get', 'render_height'];
  if (look === 'stone') return ['interpolate-lab', ['linear'], height, 0, MAP_INK.surface3, 150, MAP_INK.ink3];
  return ['interpolate-lab', ['linear'], height, 0, MAP_INK.surface3, 60, lookTone(look, accent), 400, MAP_INK.ink1];
}

export function sanitizeBuildingStyle(v: unknown): BuildingStyle {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Record<keyof BuildingStyle, unknown>>;
  const look = BUILDING_LOOKS.find(l => l.id === o.look)?.id ?? BUILDING_DEFAULTS.look;
  const opacity = typeof o.opacity === 'number' && Number.isFinite(o.opacity)
    ? Math.min(1, Math.max(MIN_OPACITY, o.opacity))
    : BUILDING_DEFAULTS.opacity;
  return { look, opacity };
}

const STORAGE_KEY = 'takip.buildings';
const listeners = new Set<() => void>();
let current: BuildingStyle | null = null;

export function getBuildingStyle(): BuildingStyle {
  if (current) return current;
  try {
    current = sanitizeBuildingStyle(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    current = BUILDING_DEFAULTS;
  }
  return current;
}

export function setBuildingStyle(patch: Partial<BuildingStyle>) {
  current = sanitizeBuildingStyle({ ...getBuildingStyle(), ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch { /* private mode: the look lasts for this visit */ }
  for (const l of listeners) l();
}

export const subscribeBuildingStyle = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
