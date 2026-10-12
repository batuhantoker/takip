import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, statfsSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { zstd } from './zstd';
import { readDisabled } from './control';
import type { DropReason } from './envelope';
import { assertSource, type Codec, hourFile, stripKeys } from './paths';

export type Meta = {
  /** Receive time; defaults to now. */
  at?: number;
  /** For backfills: the time the payload describes, which picks the hour file (replay-database.md §7.7). */
  for?: number;
  url?: string | null;
  status?: number;
  etag?: string | null;
  ms?: number;
  err?: string;
};

export type RecorderOptions = {
  /** Archive root; files go under `{dir}/raw/`. */
  dir: string;
  flushMs?: number;
  heartbeatMs?: number;
  maxQueuedBytes?: number;
  /** Below this much free disk, sources pause in `pauseOrder`. */
  minFreeBytes?: number;
  pauseOrder?: readonly string[];
  codec?: Codec;
  now?: () => number;
  freeBytes?: (dir: string) => number;
  log?: (message: string) => void;
};

const hasZstd = typeof zstd.zstdCompress === 'function';
const compress = {
  zstd: hasZstd ? promisify(zstd.zstdCompress!) : undefined,
  gzip: promisify(zlib.gzip),
};
const compressSync = { zstd: zstd.zstdCompressSync, gzip: zlib.gzipSync };

export const GB = 1024 ** 3;

const diskFree = (dir: string) => {
  const s = statfsSync(dir);
  return s.bavail * s.bsize;
};

/**
 * Appends raw upstream payloads to hourly NDJSON files, one compressed frame per file every
 * `flushMs`. Frames are independent, so a file that is still open can be read.
 */
export class Recorder {
  readonly dir: string;
  readonly codec: Codec;
  private readonly opts: Required<Omit<RecorderOptions, 'dir' | 'codec'>>;
  private pending = new Map<string, { src: string; lines: string[] }>();
  private queuedBytes = 0;
  private readonly sources = new Map<string, { n: number; dropped: number }>();
  private readonly drops = new Map<string, number>();
  private paused: Set<string> | 'all' = new Set();
  private off = new Set<string>();
  private controlMtime = -1;
  private writing: Promise<void> = Promise.resolve();
  private readonly timers: ReturnType<typeof setInterval>[] = [];

  constructor(options: RecorderOptions) {
    this.dir = options.dir;
    this.codec = options.codec ?? (hasZstd ? 'zstd' : 'gzip');
    this.opts = {
      flushMs: 10_000,
      heartbeatMs: 60_000,
      maxQueuedBytes: 64 * 1024 * 1024,
      minFreeBytes: 50 * GB,
      pauseOrder: ['aisstream', 'opensky', 'adsblol', 'adsbfi'],
      now: Date.now,
      freeBytes: diskFree,
      log: message => console.warn(`[recorder] ${message}`),
      ...stripUndefined(options),
    };
    mkdirSync(this.dir, { recursive: true });
    this.checkControl();
    this.checkDisk();
  }

  /** Starts the flush and heartbeat timers; they never keep the process alive. */
  start() {
    this.timers.push(setInterval(() => void this.flush(), this.opts.flushMs).unref());
    this.timers.push(setInterval(() => this.heartbeat(), this.opts.heartbeatMs).unref());
    return this;
  }

  /** `raw` is the upstream body as received: JSON text, or any text when `kind` is 'text'. Null for a failed request. */
  record(src: string, meta: Meta, raw: string | null, kind: 'json' | 'text' = 'json') {
    let body = 'null';
    let sha256: string | undefined;
    if (raw !== null) {
      sha256 = createHash('sha256').update(raw).digest('hex');
      body = kind === 'text' ? JSON.stringify(raw) : /[\r\n]/.test(raw) ? reserialise(raw) : raw;
    }
    this.push(src, meta, body, sha256);
  }

  /** For taps that only hold a parsed value. */
  recordValue(src: string, meta: Meta, value: unknown) {
    const body = JSON.stringify(value) ?? 'null';
    this.push(src, meta, body, createHash('sha256').update(body).digest('hex'));
  }

  private push(src: string, meta: Meta, body: string, sha256: string | undefined) {
    assertSource(src);
    const stats = this.stat(src);
    stats.n++;
    if (this.off.has(src)) return;
    if (this.paused === 'all' || this.paused.has(src)) return this.drop(src, 'disk');
    const at = meta.at ?? this.opts.now();
    const head = JSON.stringify({
      v: 1,
      src,
      at,
      ...(meta.url !== undefined && { url: meta.url && stripKeys(meta.url) }),
      ...(meta.status !== undefined && { status: meta.status }),
      ...(meta.etag !== undefined && { etag: meta.etag }),
      ...(meta.ms !== undefined && { ms: meta.ms }),
      ...(sha256 && { sha256 }),
      ...(meta.err && { err: meta.err }),
      ...(meta.for !== undefined && { for: meta.for }),
    });
    this.enqueue(src, meta.for ?? at, `${head.slice(0, -1)},"body":${body}}`);
  }

  private enqueue(src: string, at: number, line: string, force = false) {
    if (!force && this.queuedBytes + line.length > this.opts.maxQueuedBytes) return this.drop(src, 'queue_full');
    const file = hourFile(this.dir, src, at, this.codec);
    const entry = this.pending.get(file);
    if (entry) entry.lines.push(line);
    else this.pending.set(file, { src, lines: [line] });
    this.queuedBytes += line.length;
  }

  private stat(src: string) {
    let stats = this.sources.get(src);
    if (!stats) this.sources.set(src, (stats = { n: 0, dropped: 0 }));
    return stats;
  }

  private drop(src: string, reason: DropReason, n = 1) {
    this.stat(src).dropped += n;
    const key = `${src}\t${reason}`;
    this.drops.set(key, (this.drops.get(key) ?? 0) + n);
  }

  /** Heartbeats and drop lines bypass the queue limit: they are tiny and they are the evidence. */
  heartbeat() {
    const at = this.opts.now();
    for (const [src, stats] of this.sources) {
      const paused = this.paused === 'all' || this.paused.has(src);
      const hb = { n: stats.n, dropped: stats.dropped, paused, ...(this.off.has(src) && { off: true }) };
      this.enqueue(src, at, JSON.stringify({ v: 1, src, at, hb }), true);
      stats.n = 0;
      stats.dropped = 0;
    }
    for (const [key, n] of this.drops) {
      const [src, reason] = key.split('\t');
      this.enqueue('_recorder', at, JSON.stringify({ v: 1, src: '_recorder', at, drop: { src, n, reason } }), true);
    }
    this.drops.clear();
    // After reporting: the lines above describe the minute that ended, these settings the next one.
    this.checkControl();
    this.checkDisk();
  }

  /** Sources switched off in the admin console (control.json); re-read only when the file changes. */
  private checkControl() {
    const { disabled, mtimeMs } = readDisabled(this.dir);
    if (mtimeMs === this.controlMtime) return;
    const was = [...this.off].sort().join(',');
    const now = [...disabled].sort().join(',');
    if (was !== now && this.controlMtime !== -1) this.opts.log(`recording switched off for: ${now || 'none'}`);
    this.off = disabled;
    this.controlMtime = mtimeMs;
  }

  private checkDisk() {
    let free: number;
    try {
      free = this.opts.freeBytes(this.dir);
    } catch {
      return;
    }
    const min = this.opts.minFreeBytes;
    const level = free >= min ? 0 : free >= min * 0.8 ? 1 : free >= min * 0.6 ? 2 : -1;
    const next = level === -1 ? 'all' : new Set(this.opts.pauseOrder.slice(0, level));
    const describe = (p: Set<string> | 'all') => (p === 'all' ? 'all' : [...p].join(',') || 'none');
    if (describe(next) !== describe(this.paused)) {
      this.opts.log(`${(free / GB).toFixed(1)} GB free (minimum ${(min / GB).toFixed(0)} GB): paused sources ${describe(next)}`);
    }
    this.paused = next;
  }

  /** For producers faster than the flush timer (backfills): write now rather than drop at the queue bound. */
  async settle(maxQueuedBytes = 16 * 1024 * 1024) {
    if (this.queuedBytes >= maxQueuedBytes) await this.flush();
  }

  private take() {
    const batch = this.pending;
    this.pending = new Map();
    this.queuedBytes = 0;
    return batch;
  }

  /** Writes everything queued so far, one frame per file. Calls are serialised: one writer. */
  flush(): Promise<void> {
    const batch = this.take();
    this.writing = this.writing.then(async () => {
      for (const [file, { src, lines }] of batch) {
        try {
          const frame = await compress[this.codec]!(Buffer.from(`${lines.join('\n')}\n`));
          await mkdir(dirname(file), { recursive: true });
          await appendFile(file, frame);
        } catch (error) {
          this.opts.log(`could not write ${file}: ${(error as Error).message}`);
          this.drop(src, 'write_failed', lines.length);
        }
      }
    });
    return this.writing;
  }

  /** For process exit, where only synchronous work runs. Frames already in flight are lost. */
  flushSync() {
    for (const [file, { lines }] of this.take()) {
      try {
        mkdirSync(dirname(file), { recursive: true });
        appendFileSync(file, compressSync[this.codec]!(Buffer.from(`${lines.join('\n')}\n`)));
      } catch {
        // Exiting; nowhere left to report it.
      }
    }
  }

  async close() {
    for (const timer of this.timers) clearInterval(timer);
    this.heartbeat();
    await this.flush();
  }
}

/** NDJSON needs one line per record; a body that isn't valid JSON is kept as text rather than lost. */
function reserialise(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return JSON.stringify(raw);
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// One recorder per process: dev reloads and Next's separate instrumentation graph re-run this module.
const holder = globalThis as unknown as { takipRecorder?: Recorder | null };

/**
 * The process recorder, or null while TAKIP_ARCHIVE_DIR is unset (the default in development).
 * Checked again on every call until it is set: Next reloads .env into a running dev server.
 */
export function recorder(): Recorder | null {
  if (!holder.takipRecorder) {
    // OSIRIS_* are the pre-rename names; a deployed .env may still use them.
    const dir = process.env.TAKIP_ARCHIVE_DIR || process.env.OSIRIS_ARCHIVE_DIR;
    if (!dir) return null;
    const minFreeGb = Number(process.env.TAKIP_ARCHIVE_MIN_FREE_GB || process.env.OSIRIS_ARCHIVE_MIN_FREE_GB);
    const rec = new Recorder({ dir, minFreeBytes: Number.isFinite(minFreeGb) && minFreeGb >= 0 ? minFreeGb * GB : undefined }).start();
    holder.takipRecorder = rec;
    process.once('exit', () => rec.flushSync());
    console.log(`[recorder] archiving raw feeds to ${dir} (${rec.codec})`);
  }
  return holder.takipRecorder;
}

export const record = (src: string, meta: Meta, raw: string | null, kind?: 'json' | 'text') =>
  recorder()?.record(src, meta, raw, kind);

export const recordValue = (src: string, meta: Meta, value: unknown) => recorder()?.recordValue(src, meta, value);
