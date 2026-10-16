import type { SatKey } from './motion';

/**
 * TAKIP — the satellite keyframe worker (propagate.worker.ts) from the main thread. One per replay
 * session: it holds the parsed catalogue, so dispose() frees it.
 */

type Waiting = { resolve: (key: SatKey) => void; reject: (error: unknown) => void };
type Reply = { id: number; t: number; at: Float32Array };

export type SatPropagator = {
  /** The satellites later keyframes cover, in order: each one's two TLE lines. */
  set(tles: [string, string][]): void;
  /** Every satellite of the last set() at `t` (epoch ms). */
  at(t: number): Promise<SatKey>;
  dispose(): void;
};

export function createSatPropagator(): SatPropagator {
  const worker = new Worker(new URL('./propagate.worker.ts', import.meta.url), { type: 'module' });
  const waiting = new Map<number, Waiting>();
  let nextId = 0;
  const failAll = (error: Error) => {
    for (const job of waiting.values()) job.reject(error);
    waiting.clear();
  };
  worker.onmessage = ({ data }: MessageEvent<Reply>) => {
    const job = waiting.get(data.id);
    waiting.delete(data.id);
    job?.resolve({ t: data.t, at: data.at });
  };
  worker.onerror = event => failAll(new Error(event.message || 'Satellite worker failed'));

  return {
    set(tles) {
      worker.postMessage({ type: 'set', tles });
    },
    at(t) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        worker.postMessage({ type: 'at', id, t });
      });
    },
    dispose() {
      worker.terminate();
      failAll(new Error('Satellite worker stopped'));
    },
  };
}
