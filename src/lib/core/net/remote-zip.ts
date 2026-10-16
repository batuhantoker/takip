// Files out of a remote zip, with HTTP range requests where the server allows them:
// a 250 MB national GTFS gives up its routes.txt for a few hundred kilobytes.
import { inflateRawSync } from 'node:zlib';
import { TAKIP_USER_AGENT } from './user-agent';

const TAIL = 65_557; // end-of-central-directory record plus the longest comment
const MAX_FULL = 40 * 1024 * 1024;

export interface ZipFile {
  name: string;
  method: number;
  size: number;
  /** Uncompressed. */
  length: number;
  offset: number;
}

async function get(url: string, range?: [number, number] | number, signal?: AbortSignal) {
  const headers: Record<string, string> = { 'User-Agent': TAKIP_USER_AGENT };
  if (typeof range === 'number') headers.Range = `bytes=-${range}`;
  else if (range) headers.Range = `bytes=${range[0]}-${range[1] - 1}`;
  const res = await fetch(url, { headers, signal, redirect: 'follow', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status !== 206 && Number(res.headers.get('content-length')) > MAX_FULL) throw new Error('no ranges and too large to download');
  const body = Buffer.from(await res.arrayBuffer());
  const total = Number(res.headers.get('content-range')?.split('/')[1]);
  return { body, partial: res.status === 206, total: Number.isFinite(total) ? total : body.length };
}

/** The zip's directory, and a reader for any file in it. */
export async function openZip(url: string, signal?: AbortSignal) {
  const tail = await get(url, TAIL, signal);
  // Without range support the whole file came back; read everything from it.
  const whole = tail.partial ? null : tail.body;
  const at = (start: number, end: number) => (whole ? Promise.resolve(whole.subarray(start, end)) : get(url, [start, end], signal).then(r => r.body));

  const buf = tail.body;
  const tailStart = tail.total - buf.length;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const cdSize = buf.readUInt32LE(eocd + 12), cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff) throw new Error('zip64 is not supported');

  const cd = cdOffset >= tailStart ? buf.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize) : await at(cdOffset, cdOffset + cdSize);
  const files: ZipFile[] = [];
  for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50;) {
    const nameLen = cd.readUInt16LE(p + 28), extraLen = cd.readUInt16LE(p + 30), commentLen = cd.readUInt16LE(p + 32);
    files.push({
      name: cd.subarray(p + 46, p + 46 + nameLen).toString('utf8'),
      method: cd.readUInt16LE(p + 10), size: cd.readUInt32LE(p + 20), length: cd.readUInt32LE(p + 24), offset: cd.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }

  /** The first file named `name`, at the root or in a folder (feeds sometimes nest everything). */
  const find = (name: string) => files.find(f => f.name === name || f.name.endsWith(`/${name}`)) ?? null;

  /** The file's bytes as stored, still compressed. */
  async function raw(file: ZipFile): Promise<Buffer> {
    // The local header's own name and extra lengths can differ from the directory's.
    const head = await at(file.offset, file.offset + 30);
    const start = file.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
    return at(start, start + file.size);
  }

  async function read(file: ZipFile): Promise<Buffer> {
    const data = await raw(file);
    if (file.method === 0) return data;
    if (file.method === 8) return inflateRawSync(data);
    throw new Error(`compression method ${file.method}`);
  }

  return { files, find, raw, read };
}

/** One file's contents, or null when the zip has none by that name. */
export async function zipEntry(url: string, name: string, signal?: AbortSignal): Promise<Buffer | null> {
  const zip = await openZip(url, signal);
  const file = zip.find(name);
  return file ? zip.read(file) : null;
}
