import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pinnedAgent, pinnedLookup } from './pinned-agent';

const ask = (lookup: ReturnType<typeof pinnedLookup>, options: Parameters<ReturnType<typeof pinnedLookup>>[1]) =>
  new Promise<{ err: unknown; address: unknown; family?: number }>(resolve =>
    lookup('rebind.test', options, (err, address, family) => resolve({ err, address, family })));

describe('pinnedLookup', () => {
  const lookup = pinnedLookup(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']);

  it('answers every checked address when Node asks for all of them', async () => {
    expect((await ask(lookup, { all: true })).address).toEqual([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);
  });

  it('answers the first checked address of the family asked for', async () => {
    expect(await ask(lookup, {})).toMatchObject({ err: null, address: '93.184.216.34', family: 4 });
    expect(await ask(lookup, { family: 6 })).toMatchObject({ address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 });
  });

  it('fails rather than fall back to DNS when no checked address fits', async () => {
    expect((await ask(pinnedLookup(['93.184.216.34']), { family: 6 })).err).toMatchObject({ code: 'ENOTFOUND' });
  });
});

describe('pinnedAgent', () => {
  let server: Server;
  let port = 0;
  const seen: (string | undefined)[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      seen.push(req.headers.host);
      res.end('pinned');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise(resolve => server.close(resolve)));

  // .test never resolves (RFC 6761), so an answer can only have come through the pinned address.
  it('connects to the pinned address whatever DNS would say, and keeps the hostname in Host', async () => {
    const init: RequestInit & { dispatcher: object } = { dispatcher: pinnedAgent(['127.0.0.1']) };
    const res = await fetch(`http://rebind.test:${port}/x`, init);
    expect(await res.text()).toBe('pinned');
    expect(seen).toEqual([`rebind.test:${port}`]);
  });
});
