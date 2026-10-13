import { deserializeShapes, serializeShapes } from '@/lib/areas/aoi-export';
import type { DrawnShape } from '@/lib/areas/draw';
import { parseLayers } from '@/lib/layers/saved';
import type { StoredArea } from './state';

/** Converters for the page's registration lines: saved values are checked before the page takes them. */

/** Drawn areas as a workspace stores them, and back; a malformed one is dropped. */
export const storedAreas = (shapes: DrawnShape[]) => JSON.parse(serializeShapes(shapes)) as StoredArea[];
export const areasFrom = (stored: StoredArea[]) => deserializeShapes(JSON.stringify(stored));

/** Saved layer switches laid over the current ones; ids this build doesn't know are ignored. */
export const layersOver = <T extends Record<string, boolean>>(current: T, saved: Record<string, boolean>): T =>
  ({ ...current, ...parseLayers(JSON.stringify(saved), current) });

/** `value` when it's one of `allowed`, else `fallback`. */
export const oneOf = <T extends string, F>(value: string | null | undefined, allowed: readonly T[], fallback: F): T | F =>
  (allowed as readonly (string | null | undefined)[]).includes(value) ? (value as T) : fallback;
