/*
 * A camera riding a moving subject jumps every frame, and every jump ends with a moveend. Those moves
 * carry this event data, so a listener that lifts the view into React can take them a few times a
 * second rather than re-rendering the page on each frame.
 */

export const TRACKING_MOVE = { takipTracking: true };

export const isTrackingMove = (e: object) => (e as { takipTracking?: boolean }).takipTracking === true;

/** Runs `report` at once for an ordinary move, and at most every `ms` while a tracking camera moves. */
export function coalesceTrackingMoves(report: () => void, ms = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    handler(e: object) {
      if (!isTrackingMove(e)) {
        clearTimeout(timer);
        timer = undefined;
        report();
        return;
      }
      timer ??= setTimeout(() => { timer = undefined; report(); }, ms);
    },
    cancel: () => clearTimeout(timer),
  };
}
