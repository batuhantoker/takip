/*
 * The replay time, outside React: the map layer reads it every frame and the timeline a few times a
 * second, so neither re-renders the page as it moves. Epoch ms; playback stops when it reaches now.
 */

export type ReplayClock = {
  time(): number;
  playing(): boolean;
  speed(): number;
  seek(t: number): void;
  /** With `until`, stops there; a pause or a seek forgets it. */
  play(until?: number): void;
  pause(): void;
  setSpeed(x: number): void;
  /** Called on every change, including each frame while playing. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

type Deps = {
  now?: () => number;
  frame?: (cb: (ms: number) => void) => number;
  cancelFrame?: (id: number) => void;
};

export function createReplayClock(start: number, { now = Date.now, frame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }: Deps = {}): ReplayClock {
  let t = Math.min(start, now());
  let playing = false;
  let speed = 60;
  let stop: number | undefined;
  let handle: number | undefined;
  let last: number | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());

  const step = (ms: number) => {
    if (last !== undefined) {
      const end = Math.min(now(), stop ?? Infinity);
      t = Math.min(end, t + (ms - last) * speed);
      if (t >= end) {
        playing = false;
        stop = undefined;
      }
      emit();
    }
    last = ms;
    handle = playing ? frame(step) : undefined;
  };

  const clock: ReplayClock = {
    time: () => t,
    playing: () => playing,
    speed: () => speed,
    seek(next) {
      t = Math.min(next, now());
      stop = undefined;
      emit();
    },
    play(until) {
      if (playing) return;
      if (t >= now() - 1000) return;
      stop = until !== undefined && until > t ? until : undefined;
      playing = true;
      last = undefined;
      handle = frame(step);
      emit();
    },
    pause() {
      playing = false;
      stop = undefined;
      if (handle !== undefined) cancelFrame(handle);
      handle = undefined;
      emit();
    },
    setSpeed(x) {
      speed = x;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      clock.pause();
      listeners.clear();
    },
  };
  return clock;
}
