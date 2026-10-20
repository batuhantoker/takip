import { availablePages, type LayerPage } from '../layer-pages';

/** The History topic page (/map/battles-in-history) that covers an event kind, if one does. */
export function topicForKind(kind: string): LayerPage | undefined {
  return availablePages().find(p => p.eventKinds?.includes(kind));
}
