/**
 * Checking a query before it touches any data, so a typo reads as a refusal the model can fix, never
 * as a confident zero or a silently widened answer. After God's Eye View's analyst engine
 * (src/data/analystEngine.js, MIT).
 */
import type { FindLayer } from '../catalog';
import { fieldNames, fieldOf, unitFactor, type FieldType } from './fields';

export type Op = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains';

export interface Filter { field: string; op: Op; value: number | string | boolean; type: FieldType }

export type RefusalCode =
  | 'UNKNOWN_LAYER' | 'UNKNOWN_FIELD' | 'BAD_OPERATOR' | 'BAD_VALUE' | 'BAD_UNIT' | 'BAD_SORT'
  | 'NO_PLACE' | 'NO_REGION' | 'NO_EARLIER_RESULT' | 'NOT_READY' | 'UNAVAILABLE';

export interface Refusal { code: RefusalCode; error: string; allowed?: string[] }

const OPS: Record<FieldType, Op[]> = {
  number: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'],
  time: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'],
  text: ['eq', 'neq', 'contains'],
  flag: ['eq', 'neq'],
};
const SYMBOLS: Record<string, Op> = { '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte', '=': 'eq', '==': 'eq', '!=': 'neq', '<>': 'neq', '~': 'contains', has: 'contains', includes: 'contains' };
const WORDS: Record<FieldType, string> = { number: 'a number, optionally with a unit ("10000 ft")', time: 'an ISO time', text: 'text', flag: 'true or false' };

const refuse = (code: RefusalCode, error: string, allowed?: string[]): { refusal: Refusal } => ({ refusal: { code, error, ...(allowed ? { allowed } : {}) } });

/** "altitude(ft)" → the field and its written unit. */
function splitUnit(name: string): { field: string; unit: string | null } {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(name);
  return m ? { field: m[1].trim(), unit: m[2].trim() || null } : { field: name.trim(), unit: null };
}

/** A value in its field's type and unit, or undefined when it is not one. "35000 ft" and "FL350" read as numbers with units. */
function typed(type: FieldType, v: unknown, unit: string | null, fieldUnit: string | undefined): { value?: number | string | boolean; badUnit?: string } {
  if (type === 'number') {
    let n: number | null = typeof v === 'number' && Number.isFinite(v) ? v : null;
    let u = unit;
    if (n === null && typeof v === 'string') {
      const fl = /^\s*FL\s*(\d{2,3})\s*$/i.exec(v);
      const m = fl ? null : /^\s*([-+]?\d+(?:\.\d+)?)\s*([a-z°/]+)?\s*$/i.exec(v.replace(/,/g, ''));
      if (fl) { n = Number(fl[1]); u = 'fl'; } else if (m) { n = Number(m[1]); u = m[2] ?? u; }
    }
    if (n === null) return {};
    if (!u) return { value: n };
    const f = unitFactor(u, fieldUnit);
    return f === null ? { badUnit: u } : { value: n * f };
  }
  if (type === 'flag') {
    if (typeof v === 'boolean') return { value: v };
    if (v === 'true' || v === 'yes') return { value: true };
    if (v === 'false' || v === 'no') return { value: false };
    return {};
  }
  if (type === 'time') {
    const ms = typeof v === 'number' ? v : Date.parse(String(v ?? ''));
    return Number.isFinite(ms) ? { value: ms } : {};
  }
  if (typeof v === 'string' && v.trim()) return { value: v.trim() };
  if (typeof v === 'number' && Number.isFinite(v)) return { value: String(v) };
  return {};
}

/** The model's `where` list, checked against the queried layers' fields. */
export function readFilters(layers: FindLayer[], where: unknown): { filters: Filter[] } | { refusal: Refusal } {
  const list = Array.isArray(where) ? where : where && typeof where === 'object' ? [where] : [];
  const filters: Filter[] = [];
  for (const raw of list.slice(0, 12)) {
    const w = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const { field, unit } = splitUnit(String(w.field ?? ''));
    const spec = fieldOf(layers, field);
    if (!spec) return refuse('UNKNOWN_FIELD', `No field "${field}" on ${layers.join(', ')}.`, fieldNames(layers));
    const opText = String(w.op ?? 'eq').trim().toLowerCase();
    const op = (SYMBOLS[opText] ?? opText) as Op;
    if (!OPS[spec.type].includes(op)) return refuse('BAD_OPERATOR', `"${opText}" does not apply to ${field} (${spec.type}).`, OPS[spec.type]);
    const got = typed(spec.type, w.value, unit, spec.unit);
    if (got.badUnit) return refuse('BAD_UNIT', spec.unit ? `${field} is in ${spec.unit}; "${got.badUnit}" does not convert to it.` : `${field} has no unit; drop "${got.badUnit}".`);
    if (got.value === undefined) return refuse('BAD_VALUE', `${field} takes ${WORDS[spec.type]}.`);
    filters.push({ field, op, value: got.value, type: spec.type });
  }
  return { filters };
}

/** How results are ordered: a named order, or any field. */
export function readSort(layers: FindLayer[], sort: unknown): { sortBy?: string } | { refusal: Refusal } {
  if (sort === undefined || sort === null || sort === '') return {};
  const s = String(sort).trim().toLowerCase();
  if (['nearest', 'newest', 'largest', 'oldest', 'smallest'].includes(s)) return { sortBy: s };
  const { field } = splitUnit(s);
  if (fieldOf(layers, field)) return { sortBy: field };
  return refuse('BAD_SORT', `Cannot sort by "${s}".`, ['nearest', 'newest', 'largest', ...fieldNames(layers)]);
}

export function passes(value: unknown, f: Filter): boolean {
  if (value === null || value === undefined || value === '') return false;
  switch (f.type) {
    case 'flag': return (Boolean(value) === f.value) === (f.op === 'eq');
    case 'text': {
      const a = String(value).toLowerCase(), b = String(f.value).toLowerCase();
      return f.op === 'contains' ? a.includes(b) : (a === b) === (f.op === 'eq');
    }
    default: {
      const a = Number(value), b = Number(f.value);
      if (!Number.isFinite(a)) return false;
      switch (f.op) {
        case 'gt': return a > b;
        case 'gte': return a >= b;
        case 'lt': return a < b;
        case 'lte': return a <= b;
        case 'eq': return a === b;
        case 'neq': return a !== b;
        default: return false;
      }
    }
  }
}
