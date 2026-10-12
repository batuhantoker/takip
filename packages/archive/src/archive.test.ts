import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeControl } from './control';
import { type ArchiveLine, isEnvelope, isHeartbeat } from './envelope';
import { hourFile, stripKeys } from './paths';
import { archivedHours, readArchiveFile, readSourceHour } from './reader';
import { GB, Recorder } from './recorder';
import { zstd } from './zstd';
import { splitZstdFrames } from './zstd-frames';

const H = Date.parse('2026-10-12T13:00:00Z');
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'archive-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const collect = async (it: AsyncIterable<ArchiveLine>) => {
  const out: ArchiveLine[] = [];
  for await (const line of it) out.push(line);
  return out;
};

const make = (over: Partial<ConstructorParameters<typeof Recorder>[0]> = {}) =>
  new Recorder({ dir, freeBytes: () => 500 * GB, log: () => {}, ...over });

describe('Recorder', () => {
  it('writes each flush as its own frame and rotates on the hour by receive time', async () => {
    const rec = make();
    rec.record('opensky', { at: H + 10, url: 'https://x/states/all', status: 200, ms: 812 }, '{"time":1,"states":[]}');
    await rec.flush();
    rec.record('opensky', { at: H + 20 }, '{"time":2}');
    rec.record('opensky', { at: H + 3_600_000 }, '{"time":3}');
    await rec.flush();

    const first = hourFile(dir, 'opensky', H, 'zstd');
    expect(first).toMatch(/raw\/opensky\/2026\/10\/12\/13\.ndjson\.zst$/);
    expect(splitZstdFrames(readFileSync(first)).frames).toHaveLength(2);

    const lines = await collect(readSourceHour(dir, 'opensky', H));
    expect(lines.map(l => (isEnvelope(l) ? l.body : null))).toEqual([{ time: 1, states: [] }, { time: 2 }]);
    expect(lines[0]).toMatchObject({ v: 1, src: 'opensky', at: H + 10, status: 200, ms: 812 });
    expect((lines[0] as { sha256: string }).sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await collect(readSourceHour(dir, 'opensky', H + 3_600_000))).toHaveLength(1);
  });

  it('keeps text bodies as strings and re-serialises multi-line JSON onto one line', async () => {
    const rec = make();
    rec.record('celestrak', { at: H }, 'ISS\n1 25544U\n2 25544', 'text');
    rec.record('opensky', { at: H }, '{\n  "a": 1\n}');
    rec.record('opensky', { at: H }, 'not json\n<html>');
    await rec.flush();
    expect((await collect(readSourceHour(dir, 'celestrak', H)))[0]).toMatchObject({ body: 'ISS\n1 25544U\n2 25544' });
    expect((await collect(readSourceHour(dir, 'opensky', H))).map(l => (l as { body: unknown }).body)).toEqual([{ a: 1 }, 'not json\n<html>']);
  });

  it('strips credentials from recorded URLs', () => {
    expect(stripKeys('https://u:p@511on.ca/api/v2/get/cameras?key=SECRET&format=json&api_token=t')).toBe('https://511on.ca/api/v2/get/cameras?format=json');
  });

  it('reads the complete frames of a file whose last frame is cut off', async () => {
    const rec = make();
    rec.record('aisstream', { at: H }, '{"n":1}');
    await rec.flush();
    rec.record('aisstream', { at: H + 1 }, '{"n":2}');
    await rec.flush();
    const file = hourFile(dir, 'aisstream', H, 'zstd');
    const partial = zstd.zstdCompressSync!(Buffer.from('{"n":3}\n')).subarray(0, 7);
    appendFileSync(file, partial);

    const issues: string[] = [];
    const lines = await collect(readArchiveFile(file, { onIssue: m => issues.push(m) }));
    expect(lines.map(l => (l as { body: { n: number } }).body.n)).toEqual([1, 2]);
    expect(issues).toEqual([expect.stringContaining('last frame incomplete')]);
  });

  it('falls back to gzip, which also survives a cut-off tail', async () => {
    const rec = make({ codec: 'gzip' });
    rec.record('opensky', { at: H }, '{"n":1}');
    await rec.flush();
    rec.record('opensky', { at: H }, '{"n":2}');
    await rec.flush();
    const file = hourFile(dir, 'opensky', H, 'gzip');
    appendFileSync(file, zlib.gzipSync('{"n":3}\n').subarray(0, 12));
    const lines = await collect(readSourceHour(dir, 'opensky', H));
    expect(lines.map(l => (l as { body: { n: number } }).body.n)).toEqual([1, 2]);
  });

  it('drops past the queue bound and says so in a _recorder line and the heartbeat', async () => {
    const rec = make({ maxQueuedBytes: 200, now: () => H + 5 });
    for (let i = 0; i < 10; i++) rec.record('aisstream', { at: H }, `{"i":${i},"pad":"${'x'.repeat(40)}"}`);
    rec.heartbeat();
    await rec.flush();
    const ais = await collect(readSourceHour(dir, 'aisstream', H));
    const kept = ais.filter(isEnvelope).length;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(10);
    expect(ais.find(isHeartbeat)).toMatchObject({ hb: { n: 10, dropped: 10 - kept, paused: false } });
    expect(await collect(readSourceHour(dir, '_recorder', H))).toEqual([
      { v: 1, src: '_recorder', at: H + 5, drop: { src: 'aisstream', n: 10 - kept, reason: 'queue_full' } },
    ]);
  });

  it('pauses AIS first, then OpenSky, then everything as free disk shrinks', async () => {
    let free = 45 * GB;
    const logs: string[] = [];
    const rec = make({ minFreeBytes: 50 * GB, freeBytes: () => free, log: m => logs.push(m) });
    const write = () => {
      for (const src of ['aisstream', 'opensky', 'celestrak']) rec.record(src, { at: H }, '{}');
    };
    write();
    free = 35 * GB;
    rec.heartbeat();
    write();
    free = 20 * GB;
    rec.heartbeat();
    write();
    await rec.flush();
    const count = async (src: string) => (await collect(readSourceHour(dir, src, H))).filter(isEnvelope).length;
    expect([await count('aisstream'), await count('opensky'), await count('celestrak')]).toEqual([0, 1, 2]);
    expect(logs).toEqual([
      expect.stringContaining('paused sources aisstream'),
      expect.stringContaining('paused sources aisstream,opensky'),
      expect.stringContaining('paused sources all'),
    ]);
  });

  it('skips sources switched off in control.json, picking up changes at the next heartbeat', async () => {
    writeControl(dir, { cctv: { record: false }, opensky: { record: true } });
    const rec = make({ now: () => H });
    rec.record('cctv', { at: H }, '{"a":1}');
    rec.record('opensky', { at: H }, '{"a":1}');
    writeControl(dir, { cctv: { record: true } }, H + 1);
    // mtime granularity can hide a rewrite within the same tick; force a different one.
    const later = new Date(Date.now() + 5_000);
    (await import('node:fs')).utimesSync(join(dir, 'control.json'), later, later);
    rec.heartbeat();
    rec.record('cctv', { at: H }, '{"a":2}');
    await rec.flush();
    const cctv = await collect(readSourceHour(dir, 'cctv', H));
    expect(cctv.filter(isEnvelope).map(l => (l.body as { a: number }).a)).toEqual([2]);
    expect(cctv.find(isHeartbeat)?.hb).toEqual({ n: 1, dropped: 0, paused: false, off: true });
    expect((await collect(readSourceHour(dir, 'opensky', H))).filter(isEnvelope)).toHaveLength(1);
  });

  it('files a backfilled payload under the hour it describes, keeping the real receive time', async () => {
    const rec = make();
    rec.recordValue('adsblol-history', { at: H, for: H - 86_400_000 }, { icao: 'abc123' });
    await rec.settle(0);
    const [line] = await collect(readSourceHour(dir, 'adsblol-history', H - 86_400_000));
    expect(line).toMatchObject({ at: H, for: H - 86_400_000, body: { icao: 'abc123' } });
    expect(await collect(readSourceHour(dir, 'adsblol-history', H))).toEqual([]);
  });

  it('lists the hours a source has files for', async () => {
    const rec = make();
    rec.record('opensky', { at: H + 3_600_000 }, '{}');
    rec.record('opensky', { at: H }, '{}');
    rec.record('opensky', { at: H - 86_400_000 }, '{}');
    await rec.flush();
    expect(await archivedHours(dir, 'opensky')).toEqual([H - 86_400_000, H, H + 3_600_000]);
    expect(await archivedHours(dir, 'nothing')).toEqual([]);
  });

  it('rejects source codes that are not safe directory names', () => {
    expect(() => make().record('../etc', {}, '{}')).toThrow(/invalid archive source/);
  });
});

describe.runIf(hasZstdCli())('zstd CLI', () => {
  it('decodes a recorder file with every frame', async () => {
    const rec = make();
    rec.record('opensky', { at: H }, '{"n":1}');
    await rec.flush();
    rec.record('opensky', { at: H }, '{"n":2}');
    await rec.flush();
    const file = hourFile(dir, 'opensky', H, 'zstd');
    execFileSync('zstd', ['-tq', file]);
    const lines = execFileSync('zstd', ['-dcq', file]).toString().trim().split('\n');
    expect(lines.map(l => JSON.parse(l).body.n)).toEqual([1, 2]);
  });
});

function hasZstdCli() {
  try {
    execFileSync('zstd', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
