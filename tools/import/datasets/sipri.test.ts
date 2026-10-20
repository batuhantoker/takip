import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PointFlag } from '@takip/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Ctx, openContext } from '../context';
import { sipriWorkbookUrl } from '../fetch-military';
import { KEY_SCHEME, Resolver } from '../resolver';
import { LICENCES, seed, SOURCES } from '../seed';
import type { Cell, Row } from '../xlsx';
import { datedKey, footnotes, metricFor, noteMarks, readCell, readTable, SIPRI_METRICS, subjectOf, versionOf, ZERO_IS_MISSING } from './sipri';

const cell = (v: string, num = false, colour: string | null = null): Cell => ({ v, num, colour });
const row = (r: number, cells: [number, Cell][]): Row => ({ r, cells: new Map(cells) });
const metric = (code: string) => SIPRI_METRICS.find(m => m.code === code)!;

// Cells of SIPRI-Milex-data-1949-2025_v1.2.xlsx, colours as its fonts give them.
describe('sipri cells', () => {
  it('reads "..." and "xxx" as no value, whatever their colour', () => {
    expect(readCell(cell('...', false, 'indexed:8'), 1e6)).toEqual({ none: 'unavailable' });
    expect(readCell(cell('...', false, 'indexed:12'), 1e6)).toEqual({ none: 'unavailable' });
    expect(readCell(cell('…'), 1e6)).toEqual({ none: 'unavailable' });
    expect(readCell(cell('. .'), 100)).toEqual({ none: 'unavailable' });
    expect(readCell(cell('xxx', false, 'indexed:8'), 1e6)).toEqual({ none: 'not independent' });
    expect(readCell(cell('n/a'), 1)).toEqual({ bad: 'n/a' });
  });

  it('flags blue figures as estimates and red ones as highly uncertain', () => {
    expect(readCell(cell('293.39803759652335', true), 1e6)).toEqual({ v: 293_398_037.59652335, flags: 0, uncertain: false });
    expect(readCell(cell('41.695829601149626', true, 'indexed:12'), 1e6)).toMatchObject({ flags: PointFlag.estimated, uncertain: false });
    expect(readCell(cell('12094.810557680297', true, 'indexed:10'), 1e6)).toMatchObject({ flags: PointFlag.footnoted, uncertain: true });
    expect(readCell(cell('1262.7001773330683', true, 'rgb:FFFF0000'), 1e6)).toMatchObject({ uncertain: true });
  });

  it('stores shares as percentages and keeps real zeros', () => {
    const share = readCell(cell('4.4270323212536732E-2', true, 'indexed:12'), metric('sipri:milex_gdp').scale);
    expect('v' in share && share.v).toBeCloseTo(4.4270323212536732, 12);
    expect(readCell(cell('0', true), 1e6)).toEqual({ v: 0, flags: 0, uncertain: false });
    expect([...ZERO_IS_MISSING]).toEqual(['Yugoslavia']);
  });
});

describe('sipri sheets', () => {
  it('finds the notes and year columns from the header, past a blank column or a reporting year', () => {
    const constant = [
      row(4, [[1, cell('"..." = data unavailable. "xxx" = country did not exist or was not independent during all or part of the year in question.')]]),
      row(6, [[1, cell('Country')], [3, cell('Notes')], [4, cell('1949', true)], [80, cell('2025', true)]]),
      row(10, [[1, cell('Algeria')], [3, cell('§4')], [4, cell('xxx')]]),
    ];
    expect(readTable(constant)).toMatchObject({ header: 6, notes: 3, years: new Map([[4, 1949], [80, 2025]]) });
    expect(readTable(constant)!.rows.map(r => r.r)).toEqual([10]);
    const govt = [row(8, [[1, cell('Country')], [2, cell('Notes')], [3, cell('Reporting year')], [4, cell('1988', true)]])];
    expect(readTable(govt)).toMatchObject({ notes: 2, years: new Map([[4, 1988]]) });
    expect(readTable([row(1, [[1, cell('Footnotes and special notes')]])])).toBeNull();
  });

  it('splits a notes cell into special notes and a numbered footnote', () => {
    expect(noteMarks('‡§¶16')).toEqual({ marks: ['‡', '§', '¶', '16'], rest: '' });
    expect(noteMarks('72')).toEqual({ marks: ['72'], rest: '' });
    expect(noteMarks('')).toEqual({ marks: [], rest: '' });
    expect(noteMarks('...')).toEqual({ marks: [], rest: '...' });
  });

  it('reads the Footnotes sheet by symbol and number', () => {
    const notes = footnotes([
      row(4, [[1, cell('The following special notes are used in each worksheet')]]),
      row(5, [[1, cell('†')], [2, cell('Figures for these countries do not include military pensions.')]]),
      row(15, [[1, cell('4', true)], [3, cell('Algeria: The figures for Algeria are budget figures from 2004.')]]),
    ]);
    expect([...notes]).toEqual([['†', 'Figures for these countries do not include military pensions.'], ['4', 'Algeria: The figures for Algeria are budget figures from 2004.']]);
  });

  it('names the constant-dollar base year from the sheet', () => {
    const constant = metric('sipri:milex_const_usd');
    expect(metricFor(constant, 'Constant (2024) US$')).toMatchObject({ name: 'Military expenditure, constant 2024 US$ (SIPRI)', unit: 'US$', attrs: { base_year: 2024 } });
    expect(metricFor(constant, 'Constant (2025) US$')?.attrs).toEqual({ base_year: 2025 });
    expect(metricFor(constant, 'Current US$')).toBeNull();
    expect(metricFor(metric('sipri:milex_gov'), 'Share of Govt. spending')).toMatchObject({ unit: '% of government spending', topic: 'Public Sector: Defense & arms trade' });
    expect(versionOf('/x/SIPRI-Milex-data-1949-2025_v1.2.xlsx')).toBe('1949–2025 v1.2');
    expect(sipriWorkbookUrl('<a href="//www.sipri.org/sites/default/files/SIPRI-Milex-data-1949-2025_v1.2.xlsx">Download</a>'))
      .toBe('https://www.sipri.org/sites/default/files/SIPRI-Milex-data-1949-2025_v1.2.xlsx');
  });

  it('is seeded under SIPRI’s terms with its credit line', () => {
    expect(SOURCES.find(s => s.code === 'sipri-milex')?.licence).toBe('sipri-terms');
    expect(LICENCES.find(l => l.code === 'sipri-terms')).toMatchObject({ commercial: 0, attribution: expect.stringContaining('https://doi.org/10.55163/CQGC9685') });
  });
});

describe('sipri countries', () => {
  let dir: string;
  let ctx: Ctx;
  let key: (country: string, year: number) => string | undefined;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sipri-'));
    ctx = openContext({ dataDir: dir, quiet: true });
    await seed(ctx);
    const r = new Resolver(ctx);
    const keyOf = ctx.catalog.prepare(`SELECT value FROM core_entity_identifier WHERE entity_id = ? AND scheme_id = ?`).pluck();
    key = (country, year) => {
      const id = subjectOf(r, country, year);
      return id === undefined ? undefined : (keyOf.get(id, r.schemeId(KEY_SCHEME)) as string);
    };
  });
  afterAll(() => {
    ctx.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('gives West Germany and Serbia and Montenegro their own years', () => {
    expect([datedKey('Germany', 1990), datedKey('Germany', 1991), datedKey('Serbia', 2005), datedKey('Serbia', 2006)]).toEqual(['hist:BRD', undefined, 'hist:SCG', undefined]);
    expect([key('Germany', 1980), key('Germany', 2000), key('Serbia', 2000), key('Serbia', 2010)]).toEqual(['hist:BRD', 'DEU', 'hist:SCG', 'SRB']);
  });

  it('resolves SIPRI’s spellings, historical states included', () => {
    expect(['Congo, DR', 'Congo, Republic', 'Türkiye', 'Viet Nam', 'Korea, North', 'Kyrgyz Republic', 'Timor Leste', 'Kosovo'].map(n => key(n, 2020)))
      .toEqual(['COD', 'COG', 'TUR', 'VNM', 'PRK', 'KGZ', 'TLS', 'KOS']);
    expect([key('USSR', 1990), key('Russia', 1995), key('Czechoslovakia', 1990), key('German Democratic Republic', 1980), key('Yemen, North', 1980), key('Yugoslavia', 1980)])
      .toEqual(['hist:SUN', 'RUS', 'hist:CSK', 'hist:DDR', 'hist:YAR', 'hist:YUG']);
  });

  it('never paints the EU’s own spending on a group', () => {
    expect(key('European Union', 2023)).toBeUndefined();
  });
});
