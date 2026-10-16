import type { ReplayClock } from './clock';

/** While a clock plays, a dated layer follows it at most this often; each step fetches a screenful of tiles. */
const STEP_MS = 1000;

/** Calls `update` on every clock change, throttled while playing and always once more after the last change. */
export function followClock(clock: ReplayClock, update: () => void) {
  let last = 0;
  let trailing: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    const wait = STEP_MS - (Date.now() - last);
    if (clock.playing() && wait > 0) {
      clearTimeout(trailing);
      trailing = setTimeout(run, wait);
      return;
    }
    last = Date.now();
    update();
  };
  const unsubscribe = clock.subscribe(run);
  return () => { unsubscribe(); clearTimeout(trailing); };
}
