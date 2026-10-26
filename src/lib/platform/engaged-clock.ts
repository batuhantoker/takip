/** Without a scroll, click, key or touch for this long, the reader has looked away. */
export const IDLE_MS = 30_000;

/**
 * Time a page is on screen with input in the last IDLE_MS, from the monotonic timestamps the caller passes. Opening the
 * page or coming back to its tab counts as input: a click or tap brought the reader there.
 */
export function engagedClock(at: number, visible: boolean) {
  let total = 0;
  let mark = at;
  let shown = visible;
  let activeUntil = visible ? at + IDLE_MS : -Infinity;
  const settle = (now: number) => {
    if (shown) total += Math.max(0, Math.min(now, activeUntil) - mark);
    mark = Math.max(mark, now);
  };
  return {
    input(now: number) {
      settle(now);
      activeUntil = now + IDLE_MS;
    },
    shown(now: number, visible: boolean) {
      settle(now);
      if (visible && !shown) activeUntil = now + IDLE_MS;
      shown = visible;
    },
    total(now: number) {
      settle(now);
      return total;
    },
  };
}
