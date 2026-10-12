import { describe, expect, it } from 'vitest';
import { tarEntries } from './tar';
import { tar } from './tar-fixture';

const enc = new TextEncoder();

/** Splits like a download does: chunk edges in the middle of headers and data. */
async function* chunked(bytes: Uint8Array, sizes: number[]) {
  let at = 0;
  for (let i = 0; at < bytes.length; i++) {
    const n = sizes[i % sizes.length];
    yield bytes.subarray(at, at + n);
    at += n;
  }
}

const collect = async (it: AsyncIterable<{ name: string; data: Uint8Array }>) => {
  const out: [string, string][] = [];
  for await (const e of it) out.push([e.name, new TextDecoder().decode(e.data)]);
  return out;
};

describe('tarEntries', () => {
  const longName = `./traces/e9/${'x'.repeat(120)}.json`;
  const bytes = tar([
    { name: './traces/', data: new Uint8Array(0), type: '5' },
    { name: './traces/e9/trace_full_ad66e9.json', data: enc.encode('{"icao":"ad66e9"}') },
    { name: longName, data: enc.encode('long') },
    { name: './traces/e9/empty.json', data: new Uint8Array(0) },
  ]);

  it('reads regular files, skipping directories and resolving GNU long names', async () => {
    expect(await collect(tarEntries(chunked(bytes, [bytes.length])))).toEqual([
      ['./traces/e9/trace_full_ad66e9.json', '{"icao":"ad66e9"}'],
      [longName, 'long'],
      ['./traces/e9/empty.json', ''],
    ]);
  });

  it('gives the same entries whatever the chunk boundaries', async () => {
    const whole = await collect(tarEntries(chunked(bytes, [bytes.length])));
    for (const sizes of [[1], [100, 7], [511, 513], [300, 1000, 37]]) {
      expect(await collect(tarEntries(chunked(bytes, sizes)))).toEqual(whole);
    }
  });

  it('reports a stream cut off inside an entry', async () => {
    await expect(collect(tarEntries(chunked(bytes.subarray(0, 1100), [1100])))).rejects.toThrow(/ended inside/);
    await expect(collect(tarEntries(chunked(bytes.subarray(0, 1536), [1536])))).rejects.toThrow(/without its end marker/);
  });
});
