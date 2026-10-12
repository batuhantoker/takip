import { afterEach, expect, it, vi } from 'vitest';
import { startKeepalive } from './keepalive';

afterEach(() => vi.restoreAllMocks());

it('asks only for routes that still have a source recording', async () => {
  const asked: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    asked.push(new URL(String(input)).pathname);
    return new Response('{}');
  });
  const stop = startKeepalive('http://127.0.0.1:3000', code => code !== 'cctv' && code !== 'opensky', () => {});
  await vi.waitFor(() => expect(asked).toHaveLength(3));
  stop();
  // Flights still has adsb.lol and adsb.fi recording; cameras have nothing left.
  expect(asked.sort()).toEqual(['/api/flights', '/api/maritime', '/api/satellites']);
});
