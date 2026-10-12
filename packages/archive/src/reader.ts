import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import zlib from 'node:zlib';
import type { ArchiveLine } from './envelope';
import { type Codec, EXT, hourFile } from './paths';
import { zstd } from './zstd';
import { splitZstdFrames } from './zstd-frames';

export type ReadOptions = { onIssue?: (message: string) => void };

const exists = (file: string) => access(file).then(() => true, () => false);

/** Every line archived for `src` in the UTC hour containing `hour`, in write order. Nothing if the hour wasn't recorded. */
export async function* readSourceHour(dir: string, src: string, hour: number, options: ReadOptions = {}): AsyncGenerator<ArchiveLine> {
  for (const codec of ['zstd', 'gzip'] as Codec[]) {
    const file = hourFile(dir, src, hour, codec);
    if (await exists(file)) yield* readArchiveFile(file, options);
  }
}

const listNumeric = async (dir: string) => {
  try {
    return (await readdir(dir)).filter(name => /^\d+$/.test(name)).sort();
  } catch {
    return [];
  }
};

/** Every UTC hour (epoch ms) that has a file for `src`, ascending. */
export async function archivedHours(dir: string, src: string): Promise<number[]> {
  const root = join(dir, 'raw', src);
  const hours = new Set<number>();
  for (const y of await listNumeric(root)) {
    for (const m of await listNumeric(join(root, y))) {
      for (const d of await listNumeric(join(root, y, m))) {
        for (const file of await readdir(join(root, y, m, d)).catch(() => [] as string[])) {
          const hh = /^(\d{2})\.ndjson\.(zst|gz)$/.exec(file)?.[1];
          if (hh) hours.add(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh)));
        }
      }
    }
  }
  return [...hours].sort((a, b) => a - b);
}

export async function* readArchiveFile(file: string, { onIssue = () => {} }: ReadOptions = {}): AsyncGenerator<ArchiveLine> {
  const parse = (text: string) => {
    try {
      return JSON.parse(text) as ArchiveLine;
    } catch {
      onIssue(`${file}: skipped an unparseable line`);
      return undefined;
    }
  };

  if (file.endsWith(EXT.zstd)) {
    const { frames, truncated } = splitZstdFrames(await readFile(file));
    for (const frame of frames) {
      for (const text of zstd.zstdDecompressSync!(frame).toString('utf8').split('\n')) {
        const line = text && parse(text);
        if (line) yield line;
      }
    }
    if (truncated) onIssue(`${file}: last frame incomplete (still being written, or cut off)`);
    return;
  }

  // gunzip reads concatenated members; SYNC_FLUSH returns what a cut-off tail still holds instead of throwing.
  const text = zlib.gunzipSync(await readFile(file), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8');
  for (const raw of text.split('\n')) {
    const line = raw && parse(raw);
    if (line) yield line;
  }
}
