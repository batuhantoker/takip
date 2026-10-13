import type { SkyKey } from './sky';
import type { GlobeWorldId } from './worlds';

/** What the space view's inspect card is showing. */
export type SpaceSelection =
  | { kind: 'body'; key: SkyKey }
  | { kind: 'craft'; id: number }
  | { kind: 'site'; world: GlobeWorldId; id: string }
  | { kind: 'rover'; id: string }
  | { kind: 'orbiter'; world: GlobeWorldId; id: number }
  /** A star in the 3D catalogue, by index. */
  | { kind: 'star'; index: number }
  /** A star with known planets, by its NASA Exoplanet Archive host name. */
  | { kind: 'exohost'; name: string }
  /** A dwarf planet or interstellar visitor past Neptune. */
  | { kind: 'outer'; key: string }
  /** Something with a fixed place: a model shell, Sgr A*, a nearby galaxy. */
  | { kind: 'feature'; id: string };

export function sameSelection(a: SpaceSelection | null, b: SpaceSelection | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
