import { afterEach, describe, expect, it, vi } from 'vitest';

type FakeSocket = { readyState: number; emit(event: string, ...args: unknown[]): boolean };

const sockets = vi.hoisted(() => [] as FakeSocket[]);

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  class WebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    readyState = WebSocket.OPEN;
    constructor() {
      super();
      sockets.push(this);
    }
    send() {}
    terminate() {
      this.readyState = 3;
      this.emit('close');
    }
  }
  return { default: WebSocket };
});
vi.mock('@takip/archive/recorder', () => ({ record: () => {} }));

describe('AIS socket', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('drops a socket that stays open but goes quiet, then reconnects', async () => {
    vi.useFakeTimers();
    vi.stubEnv('AIS_API_KEY', 'test-key');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await import('./route');
    expect(sockets).toHaveLength(1);

    vi.advanceTimersByTime(45_000);
    sockets[0].emit('message', Buffer.from('{}'));
    vi.advanceTimersByTime(45_000);
    expect(sockets[0].readyState).toBe(1);

    vi.advanceTimersByTime(30_000);
    expect(sockets[0].readyState).toBe(3);

    vi.advanceTimersByTime(5_000);
    expect(sockets).toHaveLength(2);
  });
});
