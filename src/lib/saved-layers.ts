/**
 * Which map layers this browser had switched on, so a reload opens on the same
 * map. Kept in this browser's localStorage only; nothing leaves the device.
 */

const KEY = 'osiris.layers';

/** The stored choices for layers that still exist; unknown keys and non-booleans are dropped. */
export function parseLayers(raw: string | null, known: Record<string, boolean>): Record<string, boolean> {
  try {
    const v: unknown = JSON.parse(raw || '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, boolean> = {};
    for (const [k, on] of Object.entries(v)) {
      if (Object.hasOwn(known, k) && typeof on === 'boolean') out[k] = on;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadLayers(known: Record<string, boolean>): Record<string, boolean> {
  try { return parseLayers(window.localStorage.getItem(KEY), known); } catch { return {}; }
}

export function saveLayers(layers: Record<string, boolean>): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(layers)); } catch { /* storage blocked: the layers just do not persist */ }
}
