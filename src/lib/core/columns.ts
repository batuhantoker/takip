/**
 * Rows of flat objects as columns, for big JSON lists whose fields repeat (aircraft, ships): one array per
 * key, and a key whose values are few (a category, a type, "N/A") as a short dictionary plus indexes. gzip
 * then sees long runs of like values instead of the same keys and words in every row. fromColumns gives the
 * rows back with the same keys and values; only the order of keys within a row may differ.
 */

type Primitive = string | number | boolean | null;

export interface Column {
  /** The values of the rows that have this key, or indexes into `dict`. */
  v: Primitive[];
  dict?: Primitive[];
  /** Which rows have this key, when not all of them do. */
  at?: number[];
}

export interface Columns {
  format: 'columns';
  n: number;
  keys: string[];
  cols: Column[];
}

/** Few enough distinct values, as a share of the column, for a dictionary to pay. */
const DICT_SHARE = 0.25;

const isPrimitive = (v: unknown): v is Primitive => v === null || ['string', 'number', 'boolean'].includes(typeof v);

export function toColumns(rows: readonly Record<string, unknown>[]): Columns {
  const keys: string[] = [];
  const index = new Map<string, number>();
  const raw: { v: Primitive[]; at: number[] }[] = [];
  rows.forEach((row, i) => {
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined) continue;
      if (!isPrimitive(value)) throw new Error(`toColumns: ${key} is not a primitive`);
      let k = index.get(key);
      if (k === undefined) { k = keys.push(key) - 1; index.set(key, k); raw.push({ v: [], at: [] }); }
      raw[k].v.push(value);
      raw[k].at.push(i);
    }
  });
  const cols = raw.map(({ v, at }): Column => {
    const column: Column = { v };
    if (at.length < rows.length) column.at = at;
    const distinct = new Map<string, number>();
    const dict: Primitive[] = [];
    if (v.every(x => typeof x !== 'number')) {
      for (const x of v) {
        const id = JSON.stringify(x);
        if (!distinct.has(id)) { distinct.set(id, dict.length); dict.push(x); }
        if (dict.length > Math.max(8, v.length * DICT_SHARE)) break;
      }
      if (dict.length <= Math.max(8, v.length * DICT_SHARE)) {
        column.dict = dict;
        column.v = v.map(x => distinct.get(JSON.stringify(x))!);
      }
    }
    return column;
  });
  return { format: 'columns', n: rows.length, keys, cols };
}

export function isColumns(v: unknown): v is Columns {
  const c = v as Columns | null;
  return !!c && c.format === 'columns' && Number.isInteger(c.n) && Array.isArray(c.keys) && Array.isArray(c.cols)
    && c.keys.length === c.cols.length && c.cols.every(col => Array.isArray(col?.v) && (!col.at || col.at.length === col.v.length));
}

export function fromColumns<T = Record<string, unknown>>(c: Columns): T[] {
  const rows: Record<string, unknown>[] = Array.from({ length: c.n }, () => ({}));
  c.keys.forEach((key, k) => {
    const { v, dict, at } = c.cols[k];
    for (let j = 0; j < v.length; j++) {
      const row = rows[at ? at[j] : j];
      if (row) row[key] = dict ? dict[v[j] as number] : v[j];
    }
  });
  return rows as T[];
}
