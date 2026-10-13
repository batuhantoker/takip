import type { WindowKind } from '@/components/map/windows/kinds';

/** Where the person last put each kind of window, and how big. */
export interface Place { docked?: boolean; x?: number; y?: number; w?: number; h?: number | null }

const KEY = 'takip.windows.v1';

export function loadPlaces(): Partial<Record<WindowKind, Place>> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

export function savePlace(kind: WindowKind, place: Place) {
  try {
    const all = loadPlaces();
    all[kind] = { ...all[kind], ...place };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* private mode or full: windows just open docked */ }
}

export function clearPlaces() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
