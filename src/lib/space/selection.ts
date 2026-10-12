import type { SkyKey } from './sky';
import type { GlobeWorldId } from './worlds';

/** What the space view's inspect card is showing. */
export type SpaceSelection =
  | { kind: 'body'; key: SkyKey }
  | { kind: 'craft'; id: number }
  | { kind: 'site'; world: GlobeWorldId; id: string }
  | { kind: 'rover'; id: string }
  | { kind: 'orbiter'; world: GlobeWorldId; id: number };

export function sameSelection(a: SpaceSelection | null, b: SpaceSelection | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
