import type { Limits } from '@/components/map/windows/lib/geometry';
import type { MapArea } from './map-area';

export type WindowKind = 'inspect' | 'watch' | 'dossier' | 'camera' | 'live';

/** Docked width, the width double-click takes it to, and whether it holds a 16:9 picture. */
export const KINDS: Record<WindowKind, { width: number; big: number; video: boolean }> = {
  inspect: { width: 340, big: 480, video: false },
  watch: { width: 340, big: 420, video: false },
  dossier: { width: 400, big: 560, video: false },
  camera: { width: 440, big: 960, video: true },
  live: { width: 560, big: 960, video: true },
};

/** Pictures play in at most this many windows at once; the rest wait with a Play button. */
export const MAX_PLAYING = 4;

export function limitsFor(kind: WindowKind, a: MapArea): Limits {
  const roomW = a.right - a.left - 16, roomH = a.bottom - a.top - 16;
  return KINDS[kind].video
    ? { minW: 320, minH: 0, maxW: roomW, maxH: roomH }
    : { minW: 280, minH: 160, maxW: Math.min(720, roomW), maxH: roomH };
}
