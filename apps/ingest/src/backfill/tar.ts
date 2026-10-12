/*
 * Regular files from a tar stream (ustar, GNU and pax names), read as it downloads: adsb.lol's
 * history is one tar split into parts, and a day is several GB that never needs to touch the disk.
 */

class ByteQueue {
  private chunks: Uint8Array[] = [];
  private head = 0;
  private size = 0;
  private done = false;

  constructor(private readonly source: AsyncIterator<Uint8Array>) {}

  private async fill(n: number) {
    while (this.size < n && !this.done) {
      const next = await this.source.next();
      if (next.done) this.done = true;
      else if (next.value.length) {
        this.chunks.push(next.value);
        this.size += next.value.length;
      }
    }
    return this.size >= n;
  }

  /** Exactly n bytes, or null at the end of the stream. */
  async read(n: number, keep = true): Promise<Uint8Array | null> {
    if (!(await this.fill(n))) return null;
    const out = keep ? new Uint8Array(n) : undefined;
    let done = 0;
    while (done < n) {
      const chunk = this.chunks[0];
      const take = Math.min(chunk.length - this.head, n - done);
      out?.set(chunk.subarray(this.head, this.head + take), done);
      done += take;
      this.head += take;
      if (this.head === chunk.length) {
        this.chunks.shift();
        this.head = 0;
      }
    }
    this.size -= n;
    return out ?? new Uint8Array(0);
  }
}

const decoder = new TextDecoder();
const cstring = (b: Uint8Array) => decoder.decode(b.subarray(0, b.indexOf(0) === -1 ? b.length : b.indexOf(0)));

/** Octal, or GNU base-256 for sizes past 8 GB. */
function size(field: Uint8Array) {
  if (field[0] & 0x80) {
    let n = 0;
    for (let i = 1; i < field.length; i++) n = n * 256 + field[i];
    return n;
  }
  return parseInt(cstring(field).trim() || '0', 8);
}

export async function* tarEntries(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<{ name: string; data: Uint8Array }> {
  const q = new ByteQueue(chunks[Symbol.asyncIterator]());
  let nextName: string | undefined;
  for (;;) {
    const header = await q.read(512);
    // A complete archive ends with zero blocks; running out before them means the download was cut.
    if (!header) throw new Error('tar stream ended without its end marker');
    if (header.every(b => b === 0)) return;
    const length = size(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 48);
    const ustar = cstring(header.subarray(257, 263)) === 'ustar';
    const prefix = ustar ? cstring(header.subarray(345, 500)) : '';
    const name = nextName ?? (prefix ? `${prefix}/` : '') + cstring(header.subarray(0, 100));
    const data = await q.read(length);
    if (!data) throw new Error(`tar stream ended inside ${name}`);
    if (length % 512 && !(await q.read(512 - (length % 512), false))) throw new Error(`tar stream ended inside ${name}`);
    nextName = undefined;
    if (type === 'L') {
      nextName = cstring(data);
    } else if (type === 'x') {
      // A pax record set: "<len> path=<name>\n" overrides the next entry's name.
      const path = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(decoder.decode(data))?.[1];
      if (path) nextName = path;
    } else if (type === '0' || type === '7') {
      yield { name, data };
    }
  }
}
