import { execFileSync } from 'node:child_process';

/*
 * Just enough of an .xlsx reader for the workbooks importers read: sheets by name, cell values, and each cell's font
 * colour, which some publishers use as data (SIPRI's blue estimates). The parts come out through `unzip -p`.
 */

/** A cell's text as stored: numbers as written ("4.4E-2"), shared strings resolved. */
export type Cell = { v: string; num: boolean; colour: string | null };
/** Cells by 1-based column number. */
export type Row = { r: number; cells: Map<number, Cell> };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function unescapeXml(s: string) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e]);
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => unescapeXml(m[1])).join('');

export function sharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')));
}

/** Each cell format's font colour, by style index (`s`): "indexed:12", "rgb:FFFF0000", "theme:1", or null. */
export function fontColours(xml: string): (string | null)[] {
  const fonts = [...(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/.exec(xml)?.[1] ?? '').matchAll(/<font\/>|<font>([\s\S]*?)<\/font>/g)].map(m => {
    const tag = /<color\s([^>]*?)\/?>/.exec(m[1] ?? '')?.[1];
    if (!tag) return null;
    for (const kind of ['rgb', 'indexed', 'theme']) {
      const v = attr(tag, kind);
      if (v !== null) return `${kind}:${v}`;
    }
    return null;
  });
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? '';
  return [...xfs.matchAll(/<xf\s([^>]*?)\/?>/g)].map(m => fonts[Number(attr(m[1], 'fontId') ?? 0)] ?? null);
}

/** "AB12" → 28. */
export function columnOf(ref: string) {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)?.[0] ?? '') n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

export function* sheetRows(xml: string, strings: readonly string[], colours: readonly (string | null)[]): Generator<Row> {
  for (const row of xml.matchAll(/<row\s([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells = new Map<number, Cell>();
    for (const c of (row[2] ?? '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = attr(c[1], 't');
      const body = c[2] ?? '';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let v: string;
      if (type === 's') v = raw === undefined ? '' : (strings[Number(raw)] ?? '');
      else if (type === 'inlineStr') v = texts(body);
      else v = raw === undefined ? '' : unescapeXml(raw);
      if (v === '') continue;
      const style = attr(c[1], 's');
      cells.set(columnOf(attr(c[1], 'r') ?? ''), { v, num: (type === null || type === 'n') && raw !== undefined, colour: style === null ? null : (colours[Number(style)] ?? null) });
    }
    yield { r: Number(attr(row[1], 'r')), cells };
  }
}

/** Sheet name → its part, from workbook.xml and its relationships. */
export function sheetParts(workbook: string, rels: string): Map<string, string> {
  const targets = new Map([...rels.matchAll(/<Relationship\s([^>]*?)\/?>/g)].map(m => [attr(m[1], 'Id'), attr(m[1], 'Target')]));
  const out = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const target = targets.get(attr(m[1], 'r:id'));
    const name = attr(m[1], 'name');
    if (target && name) out.set(unescapeXml(name), target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  return out;
}

export function openXlsx(path: string) {
  const part = (entry: string) => execFileSync('unzip', ['-p', path, entry], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
  const sheets = sheetParts(part('xl/workbook.xml'), part('xl/_rels/workbook.xml.rels'));
  const strings = sharedStrings(part('xl/sharedStrings.xml'));
  const colours = fontColours(part('xl/styles.xml'));
  return {
    names: [...sheets.keys()],
    /** When the workbook was last saved (docProps/core.xml), ISO 8601. */
    modified(): string | null {
      try {
        return /<dcterms:modified\b[^>]*>([^<]+)</.exec(part('docProps/core.xml'))?.[1] ?? null;
      } catch {
        return null;
      }
    },
    rows(name: string): Row[] {
      const entry = sheets.get(name);
      if (!entry) throw new Error(`${path}: no sheet "${name}"`);
      return [...sheetRows(part(entry), strings, colours)];
    },
  };
}
