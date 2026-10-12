import type { WorkspaceStateV1 } from './state';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offline';
export type SaveOutcome = 'saved' | 'offline' | 'failed';

/** JSON with object keys sorted: the api returns parts in its own key order, so plain JSON would never match. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

type Timers = { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (id: never) => void };

/**
 * Saves the workspace `delayMs` after the last change, and only when it differs from what the server holds.
 * Last writer wins: `save` overwrites whatever is stored.
 */
export function createAutosave({ capture, save, onStatus, delayMs = 2000, timers = globalThis as Timers }: {
  capture: () => WorkspaceStateV1;
  save: (state: WorkspaceStateV1) => Promise<SaveOutcome>;
  onStatus: (status: SaveStatus) => void;
  delayMs?: number;
  timers?: Timers;
}) {
  let saved: string | null = null;
  let status: SaveStatus = 'saved';
  let timer: unknown;
  let inFlight: Promise<void> | null = null;
  let stopped = false;

  const setStatus = (next: SaveStatus) => {
    if (next === status) return;
    status = next;
    onStatus(next);
  };
  const cancel = () => {
    if (timer !== undefined) timers.clearTimeout(timer as never);
    timer = undefined;
  };
  const schedule = () => {
    cancel();
    timer = timers.setTimeout(() => {
      timer = undefined;
      void run();
    }, delayMs);
  };

  async function run(): Promise<void> {
    if (inFlight) {
      await inFlight;
      return run();
    }
    const state = capture();
    const text = canonical(state);
    if (text === saved) return setStatus('saved');
    setStatus('saving');
    inFlight = save(state).then(outcome => {
      inFlight = null;
      if (stopped) return;
      if (outcome === 'saved') saved = text;
      if (outcome === 'offline') return setStatus('offline');
      if (canonical(capture()) === saved) return setStatus('saved');
      setStatus('unsaved');
      // Changed while saving: go again. A refused save waits for the next change.
      if (outcome === 'saved') schedule();
    });
    return inFlight;
  }

  function changed() {
    if (stopped) return;
    if (canonical(capture()) === saved) {
      cancel();
      if (!inFlight) setStatus('saved');
      return;
    }
    if (!inFlight && status !== 'offline') setStatus('unsaved');
    schedule();
  }

  return {
    /** What the server holds now: after opening a workspace or an explicit save. */
    baseline(state: WorkspaceStateV1) {
      cancel();
      saved = canonical(state);
      stopped = false;
      setStatus('saved');
    },

    /** Starts again after stop(), against the same baseline. */
    resume() {
      stopped = false;
      changed();
    },

    changed,

    /** Saves at once if anything differs: back online, or the page closing. */
    flush() {
      if (stopped) return Promise.resolve();
      cancel();
      return run();
    },

    stop() {
      stopped = true;
      cancel();
    },

    /** Settles once no save is in flight. */
    idle: () => inFlight ?? Promise.resolve(),

    status: () => status,
  };
}

export type Autosave = ReturnType<typeof createAutosave>;
