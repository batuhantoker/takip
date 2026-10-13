/**
 * TAKIP — asks the shell to open the space view on something, from places with
 * no prop path to it (an Earth-map popup is plain HTML).
 */

import type { SpaceSelection } from './selection';
import type { SpaceFocus } from './worlds';

const EVENT = 'takip:world';

export interface WorldRequest {
  focus: SpaceFocus;
  /** Something to select on arrival. */
  select?: SpaceSelection;
  /** A spacecraft (Horizons ID) whose flight to play back. */
  replay?: number;
}

export function requestWorld(req: WorldRequest) {
  window.dispatchEvent(new CustomEvent<WorldRequest>(EVENT, { detail: req }));
}

export function onWorldRequest(handler: (req: WorldRequest) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<WorldRequest>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
