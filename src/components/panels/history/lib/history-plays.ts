import type { Translate } from '@/lib/core/i18n/translator';
import { formatYear } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import type { WarLayer } from '@/lib/history/war-layers';
import { clockYear, WORLD_BORDERS } from '@/lib/history/world-borders';
import { countAction } from '@/lib/platform/usage-actions';
import type { Place } from './history-content';

/** `onArrive` runs once the camera gets there. */
export type FlyTo = (place: Place, onArrive?: () => void) => void;

/** A layer of borders played from its first year to its last, at `speed` simulated seconds a second. */
function playBorders(session: HistorySession, layer: Pick<WarLayer, 'code' | 'start' | 'end' | 'view'>, speed: number, onFlyTo?: FlyTo) {
  countAction('history.jump');
  session.setLayer(layer.code, true);
  session.clock.pause();
  session.clock.seek(layer.start);
  session.clock.setSpeed(speed);
  const start = () => session.clock.play(layer.end);
  // The clock waits for the camera, so the first months don't pass mid-flight.
  if (onFlyTo) onFlyTo(layer.view, start);
  else start();
}

/** A war, a month a second, with its battles on; the borders already show the annexations. */
export function playWar(session: HistorySession, war: WarLayer, onFlyTo?: FlyTo) {
  session.setFamily('conflict', true);
  playBorders(session, war, 30 * 86_400, onFlyTo);
}

export function playWorldBorders(session: HistorySession, onFlyTo?: FlyTo) {
  playBorders(session, WORLD_BORDERS, WORLD_BORDERS.speed, onFlyTo);
}

/** "500 BCE–2024": what Play runs through. */
export const worldBordersYears = (t: Translate) => `${formatYear(clockYear(WORLD_BORDERS.start), t)}–${formatYear(clockYear(WORLD_BORDERS.end) - 1, t)}`;

/** The deep-time documentary, from where it was left or from its first chapter. */
export function playStory(session: HistorySession) {
  session.story.setAuto(true);
  if (session.story.index() === null) session.story.go(0);
}
