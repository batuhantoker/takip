/**
 * TAKIP — JPL Horizons API: request builder and table parsers.
 *
 * Horizons answers JSON whose `result` is the classic text ephemeris; with
 * CSV_FORMAT the table between $$SOE and $$EOE is comma-separated. No key is
 * needed. https://ssd-api.jpl.nasa.gov/doc/horizons.html
 */

export const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

export type Vec3 = [number, number, number];

export interface StateRow {
  jd: number;
  /** km, in whatever frame and centre the request asked for. */
  pos: Vec3;
  /** km/s */
  vel: Vec3;
}

/** Horizons wants every value single-quoted. */
export function horizonsUrl(params: Record<string, string>): string {
  const q = Object.entries({ format: 'json', ...params }).map(([k, v]) => `${k}=${encodeURIComponent(k === 'format' ? v : `'${v}'`)}`);
  return `${HORIZONS_API}?${q.join('&')}`;
}

/**
 * A regular run of epochs, Julian dates. A grid rather than a TLIST: JPL's
 * gateway answers 502 to Node's fetch once a TLIST URL passes ~1.5k characters.
 */
export interface Grid { start: number; stop: number; stepMinutes: number }

export function gridParams(g: Grid): Record<string, string> {
  return { START_TIME: `JD${g.start.toFixed(6)}`, STOP_TIME: `JD${g.stop.toFixed(6)}`, STEP_SIZE: `${g.stepMinutes}m` };
}

/** Heliocentric (or any-centred) state vectors over a grid of epochs. */
export function vectorParams(command: string, grid: Grid, center = '500@10'): Record<string, string> {
  return {
    COMMAND: command,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS',
    CENTER: center,
    REF_PLANE: 'ECLIPTIC',
    VEC_TABLE: '2',
    OUT_UNITS: 'KM-S',
    CSV_FORMAT: 'YES',
    ...gridParams(grid),
  };
}

function tableLines(result: string): string[] {
  const start = result.indexOf('$$SOE');
  const end = result.indexOf('$$EOE');
  if (start < 0 || end < start) return [];
  return result.slice(start + 5, end).split('\n').map(l => l.trim()).filter(Boolean);
}

export function parseVectors(result: string): StateRow[] {
  const rows: StateRow[] = [];
  for (const line of tableLines(result)) {
    const f = line.split(',').map(s => s.trim());
    // JDTDB, calendar, X, Y, Z, VX, VY, VZ
    const n = [0, 2, 3, 4, 5, 6, 7].map(i => Number(f[i]));
    if (n.some(v => !Number.isFinite(v))) continue;
    rows.push({ jd: n[0], pos: [n[1], n[2], n[3]], vel: [n[4], n[5], n[6]] });
  }
  return rows;
}

/** Observer-table rows keyed by the CSV header's column names. */
export function parseObserver(result: string): Record<string, string>[] {
  const start = result.indexOf('$$SOE');
  if (start < 0) return [];
  const before = result.slice(0, start).split('\n').map(l => l.trim()).filter(l => l && !/^\*+$/.test(l));
  const header = (before[before.length - 1] ?? '').split(',').map(s => s.trim());
  return tableLines(result).map(line => {
    const f = line.split(',').map(s => s.trim());
    const row: Record<string, string> = {};
    header.forEach((h, i) => { if (h) row[h] = f[i] ?? ''; });
    return row;
  });
}

/** Whether an observer table counts longitude east or west, from its "Target pole/equ" line. */
export function longitudeSense(result: string): 'east' | 'west' | null {
  const m = /Target pole\/equ.*\{(East|West)-longitude positive\}/i.exec(result);
  return m ? (m[1].toLowerCase() as 'east' | 'west') : null;
}

export interface CoverageGap {
  /** 'before': the ephemeris starts at `boundary`; 'after': it ends there. */
  kind: 'before' | 'after';
  boundary: Date;
}

const MONTHS: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

/** Reads Horizons' "No ephemeris for target … prior to/after A.D. 2026-APR-02 01:58:32" error. */
export function coverageGap(message: string): CoverageGap | null {
  const m = /No ephemeris for target .*?(prior to|after) A\.D\. (\d{4})-([A-Z]{3})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?/i.exec(message);
  if (!m) return null;
  const month = MONTHS[m[3].toUpperCase()];
  if (month === undefined) return null;
  const boundary = new Date(Date.UTC(+m[2], month, +m[4], +(m[5] ?? 0), +(m[6] ?? 0), +(m[7] ?? 0)));
  return { kind: m[1].toLowerCase() === 'after' ? 'after' : 'before', boundary };
}

export interface MajorBody {
  id: number;
  name: string;
  designation: string;
  aliases: string;
}

/** The `COMMAND='MB'` listing, split on the dashed rule under its header. */
export function parseMajorBodies(result: string): MajorBody[] {
  const lines = result.split('\n');
  const ruleAt = lines.findIndex(l => /^\s*-{3,}\s+-{3,}/.test(l));
  if (ruleAt < 0) return [];
  const spans: [number, number][] = [];
  const re = /-+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lines[ruleAt]))) spans.push([m.index, m.index + m[0].length]);
  if (spans.length < 4) return [];
  // Long names run into the next column, so each field runs to the next one's start.
  const cut = (line: string, i: number) => line.slice(i === 0 ? 0 : spans[i][0], i + 1 < spans.length ? spans[i + 1][0] : undefined).trim();
  const out: MajorBody[] = [];
  for (const line of lines.slice(ruleAt + 1)) {
    if (!line.trim() || /Number of matches/.test(line)) continue;
    const id = Number(cut(line, 0));
    if (!Number.isInteger(id)) continue;
    out.push({ id, name: cut(line, 1), designation: cut(line, 2), aliases: cut(line, 3) });
  }
  return out;
}

export const JD_UNIX_EPOCH = 2440587.5;

export function jdFromMs(ms: number): number {
  return ms / 86_400_000 + JD_UNIX_EPOCH;
}

export function msFromJd(jd: number): number {
  return (jd - JD_UNIX_EPOCH) * 86_400_000;
}
