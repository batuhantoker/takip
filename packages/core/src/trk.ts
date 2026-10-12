import { type Lod, TrkFlag } from './tracks';

/*
 * TRK1: one track segment, columnar varint-delta (replay-database.md §8.3).
 * TRKC: a chunk response, the stored TRK1 blobs concatenated with a small record header each.
 * Little-endian throughout; varints are arithmetic so ids above 2^31 survive.
 */

export type TrackPoint = {
  /** Epoch seconds; stored to the whole second. */
  t: number;
  lon: number;
  lat: number;
  /** Metres. */
  alt?: number;
  /** Knots. */
  speed?: number;
  /** Degrees. */
  heading?: number;
  /** Do not interpolate into this point from the previous one. */
  gap?: boolean;
};

export type DecodedTrack = {
  n: number;
  flags: number;
  t: Float64Array;
  lon: Float64Array;
  lat: Float64Array;
  alt?: Float32Array;
  speed?: Float32Array;
  heading?: Float32Array;
  gaps?: Uint8Array;
};

class Writer {
  private buf = new Uint8Array(256);
  len = 0;

  private room(n: number) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  u8(v: number) {
    this.room(1);
    this.buf[this.len++] = v;
  }

  uvarint(v: number) {
    if (!(v >= 0) || !Number.isSafeInteger(v)) throw new RangeError(`uvarint out of range: ${v}`);
    this.room(8);
    while (v >= 128) {
      this.buf[this.len++] = (v % 128) | 128;
      v = Math.floor(v / 128);
    }
    this.buf[this.len++] = v;
  }

  svarint(v: number) {
    this.uvarint(v >= 0 ? v * 2 : -v * 2 - 1);
  }

  f64(v: number) {
    this.room(8);
    new DataView(this.buf.buffer).setFloat64(this.len, v, true);
    this.len += 8;
  }

  bytes(b: Uint8Array) {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  done() {
    return this.buf.slice(0, this.len);
  }
}

class Reader {
  pos = 0;
  private readonly view: DataView;

  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  u8() {
    if (this.pos >= this.buf.length) throw new RangeError('read past end');
    return this.buf[this.pos++];
  }

  uvarint() {
    let v = 0;
    let scale = 1;
    for (;;) {
      const b = this.u8();
      v += (b & 127) * scale;
      if (b < 128) return v;
      scale *= 128;
    }
  }

  svarint() {
    const z = this.uvarint();
    return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
  }

  f64() {
    if (this.pos + 8 > this.buf.length) throw new RangeError('read past end');
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  bytes(n: number) {
    if (this.pos + n > this.buf.length) throw new RangeError('read past end');
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

const quantHeading = (h: number) => Math.round((((h % 360) + 360) % 360) * (256 / 360)) % 256;

/** Points must be in time order. Optional columns carry the last known value forward where a point lacks one. */
export function encodeTrk1(points: readonly TrackPoint[], { scale = 1e5, extraFlags = 0 } = {}): Uint8Array {
  const n = points.length;
  if (n === 0) throw new RangeError('a segment needs at least one point');
  let flags = extraFlags & TrkFlag.tIsReceive;
  if (points.some(p => p.alt !== undefined)) flags |= TrkFlag.hasAlt;
  if (points.some(p => p.speed !== undefined)) flags |= TrkFlag.hasSpeed;
  if (points.some(p => p.heading !== undefined)) flags |= TrkFlag.hasHeading;
  if (points.some(p => p.gap)) flags |= TrkFlag.hasGaps;
  if (scale === 1e4) flags |= TrkFlag.coarse;
  else if (scale !== 1e5) throw new RangeError(`unsupported scale ${scale}`);

  const w = new Writer();
  w.uvarint(n);
  w.u8(flags);
  const t0 = Math.round(points[0].t);
  w.f64(t0);
  let prevT = t0;
  for (let i = 1; i < n; i++) {
    const t = Math.round(points[i].t);
    if (t < prevT) throw new RangeError('points must be in time order');
    w.uvarint(t - prevT);
    prevT = t;
  }
  let qx = 0;
  let qy = 0;
  for (const p of points) {
    const x = Math.round(p.lon * scale);
    const y = Math.round(p.lat * scale);
    w.svarint(x - qx);
    w.svarint(y - qy);
    qx = x;
    qy = y;
  }
  if (flags & TrkFlag.hasAlt) {
    let prev = 0;
    let last = 0;
    for (const p of points) {
      if (p.alt !== undefined) last = Math.round(p.alt / 10);
      w.svarint(last - prev);
      prev = last;
    }
  }
  if (flags & TrkFlag.hasSpeed) {
    let last = 0;
    for (const p of points) {
      if (p.speed !== undefined) last = Math.max(0, Math.round(p.speed * 10));
      w.uvarint(last);
    }
  }
  if (flags & TrkFlag.hasHeading) {
    let last = 0;
    for (const p of points) {
      if (p.heading !== undefined) last = quantHeading(p.heading);
      w.u8(last);
    }
  }
  if (flags & TrkFlag.hasGaps) {
    const bits = new Uint8Array(Math.ceil(n / 8));
    points.forEach((p, i) => {
      if (p.gap) bits[i >> 3] |= 1 << (i & 7);
    });
    w.bytes(bits);
  }
  return w.done();
}

export function decodeTrk1(blob: Uint8Array): DecodedTrack {
  const r = new Reader(blob);
  const n = r.uvarint();
  const flags = r.u8();
  const scale = flags & TrkFlag.coarse ? 1e4 : 1e5;
  const t = new Float64Array(n);
  t[0] = r.f64();
  for (let i = 1; i < n; i++) t[i] = t[i - 1] + r.uvarint();
  const lon = new Float64Array(n);
  const lat = new Float64Array(n);
  let qx = 0;
  let qy = 0;
  for (let i = 0; i < n; i++) {
    qx += r.svarint();
    qy += r.svarint();
    lon[i] = qx / scale;
    lat[i] = qy / scale;
  }
  const out: DecodedTrack = { n, flags, t, lon, lat };
  if (flags & TrkFlag.hasAlt) {
    out.alt = new Float32Array(n);
    let q = 0;
    for (let i = 0; i < n; i++) out.alt[i] = (q += r.svarint()) * 10;
  }
  if (flags & TrkFlag.hasSpeed) {
    out.speed = new Float32Array(n);
    for (let i = 0; i < n; i++) out.speed[i] = r.uvarint() / 10;
  }
  if (flags & TrkFlag.hasHeading) {
    out.heading = new Float32Array(n);
    for (let i = 0; i < n; i++) out.heading[i] = r.u8() * (360 / 256);
  }
  if (flags & TrkFlag.hasGaps) out.gaps = r.bytes(Math.ceil(n / 8)).slice();
  return out;
}

/** Point count and flags without decoding the columns. */
export function trk1Header(blob: Uint8Array): { n: number; flags: number } {
  const r = new Reader(blob);
  return { n: r.uvarint(), flags: r.u8() };
}

export const isGap = (track: DecodedTrack, i: number) => Boolean(track.gaps && track.gaps[i >> 3] & (1 << (i & 7)));

export type ChunkRecord = {
  entity: number;
  /** Segments of one entity within a bucket, split at gaps and the antimeridian. */
  part: number;
  cls: number;
  category: number;
  label: string;
  blob: Uint8Array;
};

export type Chunk = { bucket: number; lod: Lod; records: ChunkRecord[] };

const MAGIC = [0x54, 0x52, 0x4b, 0x43]; // "TRKC"
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** `bucket` is epoch seconds. Clients dedupe records across tile edges on (entity, bucket, part). */
export function encodeChunk({ bucket, lod, records }: Chunk): Uint8Array {
  const w = new Writer();
  for (const b of MAGIC) w.u8(b);
  w.u8(1);
  w.f64(bucket);
  w.u8(lod);
  w.uvarint(records.length);
  for (const rec of records) {
    w.uvarint(rec.entity);
    w.uvarint(rec.part);
    w.u8(rec.cls);
    w.u8(rec.category);
    const label = encoder.encode(rec.label);
    w.uvarint(label.length);
    w.bytes(label);
    w.uvarint(rec.blob.length);
    w.bytes(rec.blob);
  }
  return w.done();
}

export function decodeChunk(buf: Uint8Array): Chunk {
  const r = new Reader(buf);
  for (const b of MAGIC) if (r.u8() !== b) throw new Error('not a TRKC chunk');
  const version = r.u8();
  if (version !== 1) throw new Error(`unsupported TRKC version ${version}`);
  const bucket = r.f64();
  const lod = r.u8() as Lod;
  const count = r.uvarint();
  const records: ChunkRecord[] = [];
  for (let i = 0; i < count; i++) {
    const entity = r.uvarint();
    const part = r.uvarint();
    const cls = r.u8();
    const category = r.u8();
    const label = decoder.decode(r.bytes(r.uvarint()));
    const blob = r.bytes(r.uvarint());
    records.push({ entity, part, cls, category, label, blob });
  }
  return { bucket, lod, records };
}
