import type { SpaceSelection } from '@/lib/space/selection';
import type { SkyKey } from '@/lib/space/sky';
import type { MapTarget } from './camera/zoom-anchor';
import type { ReplayState } from './craft/flight-replay';

export type Anchor =
  | { kind: 'body'; key: SkyKey }
  | { kind: 'craft'; id: number }
  | { kind: 'system' }
  | { kind: 'galaxy' }
  | { kind: 'star'; index: number }
  | { kind: 'exohost'; name: string }
  | { kind: 'outer'; key: string }
  | { kind: 'feature'; id: string };

export interface SpaceLayers {
  satellites: boolean; fleet: boolean; orbits: boolean; surface: boolean; labels: boolean;
  /** Model shapes: the heliosphere, the Oort cloud, the Milky Way's disc. */
  illustrations: boolean;
  constellations: boolean;
  exoplanets: boolean;
}

/** Everything drawn: how the space view opens. */
export const DEFAULT_SPACE_LAYERS: SpaceLayers = { satellites: true, fleet: true, orbits: true, surface: true, labels: true, illustrations: true, constellations: true, exoplanets: true };

export interface CameraInfo { anchorName: string; distanceKm: number; sunKm: number }

export interface SpaceSceneEvents {
  onSelect: (sel: SpaceSelection | null) => void;
  onCamera: (info: CameraInfo) => void;
  /** Zoomed into Earth far enough to hand back to the map. */
  onSurface?: (to: MapTarget) => void;
  /** A flight replay's clock, a few times a second while one runs. */
  onReplay?: (state: ReplayState | null) => void;
}
