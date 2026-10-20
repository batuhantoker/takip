import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';

/* A streaming reader for MediaWiki's mysqldump files: column names from CREATE TABLE, rows from INSERT tuples. */

export type SqlValue = string | number | null;

const ESCAPES: Record<string, string> = { '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a' };

type Parsed = { values: SqlValue[]; end: number } | null;

/** One "(…)" tuple from `s[i] === '('`, or null when the buffer ends inside it. */
function tuple(s: string, i: number): Parsed {
  const values: SqlValue[] = [];
  let j = i + 1;
  const n = s.length;
  for (;;) {
    if (j >= n) return null;
    if (s.charCodeAt(j) === 39) {
      let out = '';
      let seg = j + 1;
      let k = seg;
      for (;;) {
        if (k >= n) return null;
        const c = s.charCodeAt(k);
        if (c === 92) {
          if (k + 1 >= n) return null;
          const e = s[k + 1];
          out += s.slice(seg, k) + (ESCAPES[e] ?? e);
          k += 2;
          seg = k;
        } else if (c === 39) {
          if (s.charCodeAt(k + 1) === 39) {
            out += s.slice(seg, k + 1);
            k += 2;
            seg = k;
            continue;
          }
          if (k + 1 >= n) return null;
          out += s.slice(seg, k);
          j = k + 1;
          break;
        } else k++;
      }
      values.push(out);
    } else {
      let k = j;
      while (k < n && s.charCodeAt(k) !== 44 && s.charCodeAt(k) !== 41) k++;
      if (k >= n) return null;
      const token = s.slice(j, k).trim();
      const num = Number(token);
      values.push(token === 'NULL' ? null : token !== '' && Number.isFinite(num) ? num : token);
      j = k;
    }
    const c = s.charCodeAt(j);
    if (c === 44) j++;
    else if (c === 41) return { values, end: j + 1 };
    else return null;
  }
}

/** Feed decoded text in any chunking; complete rows come back from each push. */
export class SqlDumpParser {
  columns: string[] = [];
  private carry = '';
  private inInsert = false;
  private inCreate = false;

  push(chunk: string): SqlValue[][] {
    const s = this.carry + chunk;
    const rows: SqlValue[][] = [];
    let i = 0;
    const n = s.length;
    for (;;) {
      if (this.inInsert) {
        while (i < n) {
          const c = s.charCodeAt(i);
          if (c === 44 || c === 32 || c === 10 || c === 13 || c === 9) i++;
          else break;
        }
        if (i >= n) break;
        if (s.charCodeAt(i) === 59) {
          this.inInsert = false;
          i++;
          continue;
        }
        if (s.charCodeAt(i) !== 40) throw new Error(`unexpected ${JSON.stringify(s.slice(i, i + 40))}`);
        const t = tuple(s, i);
        if (!t) break;
        rows.push(t.values);
        i = t.end;
        continue;
      }
      if (s.startsWith('INSERT INTO', i)) {
        const v = s.indexOf('VALUES', i);
        if (v < 0) break;
        this.inInsert = true;
        i = v + 6;
        continue;
      }
      const nl = s.indexOf('\n', i);
      if (nl < 0) break;
      const line = s.slice(i, nl);
      i = nl + 1;
      if (line.startsWith('CREATE TABLE')) {
        this.inCreate = true;
        this.columns = [];
      } else if (this.inCreate) {
        const col = line.match(/^\s*`([^`]+)`/);
        if (col) this.columns.push(col[1]);
        else if (/^\s*\)/.test(line) || /^\s*(PRIMARY|UNIQUE|KEY)/.test(line)) this.inCreate = !/^\s*\)/.test(line);
      }
    }
    this.carry = s.slice(i);
    return rows;
  }
}

/** Rows of a gzipped dump as objects keyed by column name, keeping only `pick`. */
export async function* sqlDumpRows(path: string, pick: readonly string[]): AsyncGenerator<Record<string, SqlValue>> {
  const parser = new SqlDumpParser();
  const stream = createReadStream(path, { highWaterMark: 1 << 20 }).pipe(createGunzip());
  stream.setEncoding('utf8');
  let idx: number[] | null = null;
  for await (const chunk of stream as AsyncIterable<string>) {
    for (const row of parser.push(chunk)) {
      if (!idx) {
        idx = pick.map(p => parser.columns.indexOf(p));
        const missing = pick.filter((_, k) => idx![k] < 0);
        if (missing.length) throw new Error(`${path}: no column ${missing.join(', ')}`);
      }
      const out: Record<string, SqlValue> = {};
      for (let k = 0; k < pick.length; k++) out[pick[k]] = row[idx[k]];
      yield out;
    }
  }
}

/** Lines of a file through an external decompressor (bzip2 has no Node built-in). */
export async function* commandLines(cmd: string, args: string[]): AsyncGenerator<string> {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });
  child.stdout.setEncoding('utf8');
  let carry = '';
  for await (const chunk of child.stdout as AsyncIterable<string>) {
    const parts = (carry + chunk).split('\n');
    carry = parts.pop() ?? '';
    yield* parts;
  }
  if (carry) yield carry;
  const code = await new Promise<number | null>(r => (child.exitCode !== null ? r(child.exitCode) : child.on('close', r)));
  if (code) throw new Error(`${cmd} ${args.join(' ')} exited ${code}`);
}
