import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonical, createAutosave, type SaveOutcome, type SaveStatus } from './autosave';
import type { WorkspaceStateV1 } from './state';

let state: WorkspaceStateV1;
let statuses: SaveStatus[];
let outcome: SaveOutcome;
let save: ReturnType<typeof vi.fn<(s: WorkspaceStateV1) => Promise<SaveOutcome>>>;

function start() {
  const autosave = createAutosave({ capture: () => state, save, onStatus: s => statuses.push(s) });
  autosave.baseline(state);
  return autosave;
}

const change = (layers: Record<string, boolean>) => {
  state = { ...state, layers };
};

beforeEach(() => {
  vi.useFakeTimers();
  state = { v: 1, layers: { maritime: true }, tool: null };
  statuses = [];
  outcome = 'saved';
  save = vi.fn(async () => outcome);
});
afterEach(() => vi.useRealTimers());

describe('autosave', () => {
  it('saves once, 2 s after the last of a run of changes', async () => {
    const autosave = start();
    change({ maritime: false });
    autosave.changed();
    await vi.advanceTimersByTimeAsync(1500);
    change({ maritime: false, flights: true });
    autosave.changed();
    await vi.advanceTimersByTimeAsync(1999);
    expect(save).not.toHaveBeenCalled();
    expect(autosave.status()).toBe('unsaved');

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ v: 1, layers: { maritime: false, flights: true }, tool: null });
    expect(statuses).toEqual(['unsaved', 'saving', 'saved']);
  });

  it('skips a save when nothing differs from what the server holds', async () => {
    const autosave = start();
    autosave.changed();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();

    change({ maritime: false });
    autosave.changed();
    change({ maritime: true });
    autosave.changed();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(autosave.status()).toBe('saved');
  });

  it('compares regardless of key order, as the api returns its own', async () => {
    const autosave = start();
    autosave.baseline({ tool: null, layers: { maritime: true }, v: 1 } as WorkspaceStateV1);
    autosave.changed();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(canonical({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 3 } })).toBe('{"a":{"c":3,"d":[{"x":2,"y":1}]},"b":1}');
  });

  it('saves again when the state changed while a save was in flight', async () => {
    let finish!: () => void;
    save.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve('saved'); }));
    const autosave = start();
    change({ maritime: false });
    autosave.changed();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);

    change({ maritime: false, flights: true });
    autosave.changed();
    finish();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].layers).toEqual({ maritime: false, flights: true });
    expect(autosave.status()).toBe('saved');
  });

  it('goes offline when the api is out of reach, and saves on flush', async () => {
    outcome = 'offline';
    const autosave = start();
    change({ maritime: false });
    autosave.changed();
    await vi.advanceTimersByTimeAsync(2000);
    expect(autosave.status()).toBe('offline');

    outcome = 'saved';
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(autosave.status()).toBe('saved');
  });

  it('stays unsaved after a refused save, until the next change', async () => {
    outcome = 'failed';
    const autosave = start();
    change({ maritime: false });
    autosave.changed();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.status()).toBe('unsaved');
  });

  it('does nothing once stopped', async () => {
    const autosave = start();
    autosave.stop();
    change({ maritime: false });
    autosave.changed();
    await autosave.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });
});
