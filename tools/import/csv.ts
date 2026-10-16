import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';

const COMMA = 0x2c;
const QUOTE = 0x22;
const CR = 0x0d;
const LF = 0x0a;

const utf8 = new TextDecoder('utf-8', { fatal: true });
const cp1252 = new TextDecoder('windows-1252');

/** Per field, because several raw files mix encodings row by row (§7.5 step 2). */
export function decodeField(bytes: Uint8Array): string {
  let s: string;
  try {
    s = utf8.decode(bytes);
  } catch {
    s = cp1252.decode(bytes);
  }
  return s.replace(/ /g, ' ');
}

/** Streams RFC 4180 rows: quoted fields may hold commas, quotes and newlines. A `.gz` path is gunzipped on the way. */
export async function* csvRows(path: string): AsyncGenerator<string[]> {
  let field = new Uint8Array(256);
  let len = 0;
  let row: string[] = [];
  let quoted = false;
  let quoteSeen = false;
  let first = true;

  const push = (b: number) => {
    if (len === field.length) {
      const next = new Uint8Array(field.length * 2);
      next.set(field);
      field = next;
    }
    field[len++] = b;
  };
  const endField = () => {
    row.push(decodeField(field.subarray(0, len)));
    len = 0;
    quoteSeen = false;
  };

  const input = path.endsWith('.gz') ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
  for await (const chunk of input as AsyncIterable<Buffer>) {
    let i = 0;
    if (first) {
      first = false;
      if (chunk[0] === 0xef && chunk[1] === 0xbb && chunk[2] === 0xbf) i = 3;
    }
    for (; i < chunk.length; i++) {
      const b = chunk[i];
      if (quoted) {
        if (b === QUOTE) {
          quoted = false;
          quoteSeen = true;
        } else push(b);
      } else if (b === QUOTE) {
        // A doubled quote inside a quoted field closes then reopens it.
        if (quoteSeen) push(QUOTE);
        quoted = true;
      } else if (b === COMMA) endField();
      else if (b === LF) {
        endField();
        if (!(row.length === 1 && row[0] === '')) yield row;
        row = [];
      } else if (b !== CR) push(b);
    }
  }
  if (len > 0 || row.length > 0) {
    endField();
    if (!(row.length === 1 && row[0] === '')) yield row;
  }
}

/** Rows keyed by header. A row that repeats the header is yielded as `{ __header__: '1' }` so callers can split blocks. */
export async function* csvRecords(path: string): AsyncGenerator<Record<string, string>> {
  let header: string[] | undefined;
  for await (const row of csvRows(path)) {
    if (!header) {
      header = row.map(h => h.trim());
      continue;
    }
    if (row.length === header.length && row.every((v, i) => v.trim() === header![i])) {
      yield { __header__: '1' };
      continue;
    }
    const rec: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) rec[header[i]] = row[i] ?? '';
    yield rec;
  }
}

export async function readCsv(path: string) {
  const out: Record<string, string>[] = [];
  for await (const r of csvRecords(path)) if (!r.__header__) out.push(r);
  return out;
}

/** Blank, NA and the dataset sentinels all mean "no value". */
export function num(v: string | undefined, sentinels: readonly string[] = []): number | null {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === '' || s === 'NA' || s === '.' || s === 'None' || s === 'nan' || sentinels.includes(s)) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export const text = (v: string | undefined) => {
  const s = v?.replace(/\[\d+\]/g, '').trim();
  return s && s !== 'NA' && s !== 'None' && s !== 'nan' ? s : null;
};
