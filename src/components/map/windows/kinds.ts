import type { Limits } from '@/components/map/windows/lib/geometry';
import type { MapArea } from './map-area';

export type WindowKind = 'inspect' | 'watch' | 'dossier' | 'imagery' | 'chart' | 'camera' | 'live' | 'pinned';

/** Docked width, the width double-click takes it to, and whether it holds a 16:9 picture. */
export const KINDS: Record<WindowKind, { width: number; big: number; video: boolean }> = {
  inspect: { width: 340, big: 480, video: false },
  watch: { width: 340, big: 420, video: false },
  dossier: { width: 400, big: 560, video: false },
  imagery: { width: 420, big: 560, video: false },
  chart: { width: 400, big: 640, video: false },
  camera: { width: 440, big: 960, video: true },
  live: { width: 560, big: 960, video: true },
  pinned: { width: 340, big: 480, video: false },
};

/** Pictures play in at most this many windows at once; the rest wait with a Play button. */
export const MAX_PLAYING = 4;

export function limitsFor(kind: WindowKind, a: MapArea): Limits {
  const roomW = a.right - a.left - 16, roomH = a.bottom - a.top - 16;
  return KINDS[kind].video
    ? { minW: 320, minH: 0, maxW: roomW, maxH: roomH }
    : { minW: 280, minH: 160, maxW: Math.min(720, roomW), maxH: roomH };
}

/** A picture window's header and caption line, around its 16:9 picture. */
const VIDEO_CHROME = 84;
/** Map kept in view beside a window opening in a small map, such as an embed's frame. */
const MAP_BESIDE = 240;

/** The width a window opens at: its own, or narrower where the map is small, so a picture fits the column's height. */
export function openWidth(kind: WindowKind, a: MapArea, own: number = KINDS[kind].width): number {
  const fit = KINDS[kind].video ? ((a.colBottom - a.colTop - VIDEO_CHROME) * 16) / 9 : Infinity;
  return Math.round(Math.max(limitsFor(kind, a).minW, Math.min(own, fit, a.right - a.left - MAP_BESIDE)));
}
