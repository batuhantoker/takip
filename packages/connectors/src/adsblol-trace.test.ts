import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fetchTrace, partRanges, type Trace } from './adsblol-trace';

const trace: Trace = { icao: '4ca7b5', r: 'EI-DCL', t: 'B738', timestamp: 1791676800, trace: [[0, 53.4, -6.2, 'ground', 0, 0, 0, null, { flight: 'RYR1AB  ' }]] };

/** Byte ranges of the given files, as GitHub's release downloads serve them; `ranged: false` ignores Range like a plain server. */
function server(files: Record<string, Uint8Array>, { ranged = true } = {}) {
  const asked: string[] = [];
  const get = (async (url: string | URL | Request, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('range');
    asked.push(`${url} ${range}`);
    const body = files[String(url)] as Uint8Array<ArrayBuffer>;
    const m = /^bytes=(\d+)-(\d+)$/.exec(range ?? '');
    if (!m || !ranged) return new Response(body);
    return new Response(body.subarray(Number(m[1]), Number(m[2]) + 1), { status: 206 });
  }) as typeof fetch;
  return { get, asked };
}

describe('adsb.lol trace by range', () => {
  const parts = [{ name: 'v.tar.aa', size: 10, url: 'https://x/aa' }, { name: 'v.tar.ab', size: 5, url: 'https://x/ab' }];

  it('maps an offset in the joined parts onto each part it touches', () => {
    expect(partRanges(parts, 2, 3)).toEqual([{ url: 'https://x/aa', first: 2, last: 4 }]);
    expect(partRanges(parts, 8, 4)).toEqual([{ url: 'https://x/aa', first: 8, last: 9 }, { url: 'https://x/ab', first: 0, last: 1 }]);
    expect(partRanges(parts, 10, 5)).toEqual([{ url: 'https://x/ab', first: 0, last: 4 }]);
    expect(() => partRanges(parts, 12, 5)).toThrow(/past the release/);
  });

  it('fetches an entry that straddles two parts and parses its gzip JSON', async () => {
    const data = gzipSync(JSON.stringify(trace));
    const joined = new Uint8Array(300 + data.length);
    joined.set(data, 250);
    const split = 250 + Math.floor(data.length / 2);
    const two = [{ name: 'v.tar.aa', size: split, url: 'https://x/aa' }, { name: 'v.tar.ab', size: joined.length - split, url: 'https://x/ab' }];
    const { get, asked } = server({ 'https://x/aa': joined.subarray(0, split), 'https://x/ab': joined.subarray(split) });
    expect(await fetchTrace(two, 250, data.length, get)).toEqual(trace);
    expect(asked).toEqual([`https://x/aa bytes=250-${split - 1}`, `https://x/ab bytes=0-${250 + data.length - split - 1}`]);
  });

  it('refuses a server that ignores the range rather than read a whole part', async () => {
    const { get } = server({ 'https://x/aa': new Uint8Array(10) }, { ranged: false });
    await expect(fetchTrace(parts, 2, 3, get)).rejects.toThrow(/HTTP 200 to a range request/);
  });
});
