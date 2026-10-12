import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { afterAll, describe, expect, it } from 'vitest';
import { mergePublish } from './context';
import { readCsv, csvRows, num } from './csv';
import { isoDate, utc, ymd } from './dates';
import { wacKind } from './datasets/wac1914';
import { owidYear } from './datasets/owid';
import { normName } from './names';

const dir = mkdtempSync(join(tmpdir(), 'csv-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const file = (name: string, bytes: Buffer | string) => {
  const p = join(dir, name);
  writeFileSync(p, bytes);
  return p;
};

describe('csv', () => {
  it('handles BOMs, quoted commas, doubled quotes and newlines inside fields', async () => {
    const p = file('a.csv', '﻿name,note\r\n"Smith, J","said ""hi""\nthen left"\r\nplain,\n');
    expect(await readCsv(p)).toEqual([
      { name: 'Smith, J', note: 'said "hi"\nthen left' },
      { name: 'plain', note: '' },
    ]);
  });

  it('decodes each field as UTF-8, falling back to cp1252', async () => {
    const p = file('b.csv', Buffer.concat([Buffer.from('a,b\n'), Buffer.from('Côte,', 'utf8'), Buffer.from([0x43, 0xf4, 0x74, 0x65]), Buffer.from('\n')]));
    const rows = [];
    for await (const r of csvRows(p)) rows.push(r);
    expect(rows[1]).toEqual(['Côte', 'Côte']);
  });

  it('treats blanks, NA and sentinels as missing', () => {
    expect([num(''), num('NA'), num('.'), num('-9', ['-9']), num('1,200')]).toEqual([null, null, null, null, 1200]);
  });
});

describe('dates', () => {
  it('lowers precision instead of inventing days or months', () => {
    expect(ymd(1917, 5, 0)).toEqual({ t: Date.UTC(1917, 4, 1), prec: Prec.month });
    expect(ymd(1917, -9, -9)).toEqual({ t: Date.UTC(1917, 0, 1), prec: Prec.year });
    expect(ymd(null)).toBeNull();
    expect(isoDate('2026-07-07')).toEqual({ t: Date.UTC(2026, 6, 7), prec: Prec.day });
    expect(isoDate('ONGOING')).toBeNull();
  });

  it('handles early and BCE years', () => {
    expect(new Date(utc(50)).getUTCFullYear()).toBe(50);
    expect(owidYear('10000 BCE')).toBe(-9999);
    expect(new Date(utc(owidYear('10000 BCE')!)).getUTCFullYear()).toBe(-9999);
  });
});

describe('publish', () => {
  it('merges the publish options of several batches', () => {
    const gap = { tLo: 1, tHi: 2, kind: 'preliminary' as const, note: 'x' };
    expect(mergePublish({ tLo: 5, tHi: 9, layers: ['events:conflict'] }, { tLo: 3, tHi: null, layers: ['events:conflict', 'series:x'], gaps: [gap] })).toEqual({
      tLo: 3,
      tHi: 9,
      gaps: [gap],
      layers: ['events:conflict', 'series:x'],
    });
  });
});

describe('mapping', () => {
  it('maps WAC conflict types', () => {
    expect(wacKind('Global interstate war')).toBe('war.world');
    expect(wacKind('Interstate war (part of WWII)')).toBe('war.interstate');
    expect(wacKind('Civil war (with NATO intervention)')).toBe('war.civil');
    expect(wacKind('War of independence / insurgency')).toBe('war.independence');
    expect(wacKind('Insurgency / terrorism')).toBe('conflict.armed');
  });

  it('normalises names', () => {
    expect(normName('Côte d’Ivoire')).toBe('cote d ivoire');
    expect(normName('Antigua & Barbuda')).toBe(normName('Antigua and Barbuda'));
  });
});
