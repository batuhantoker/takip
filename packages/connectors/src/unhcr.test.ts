import { describe, expect, it } from 'vitest';
import { buildDisplacement, displacementFor } from './unhcr';

// Verbatim rows from the UNHCR population API, 2025 (unused fields trimmed).
const COUNTRIES = [
  { iso: 'SDN', iso2: 'SD' },
  { iso: 'TUR', iso2: 'TR' },
  { iso: 'BES', iso2: null },
];
const ORIGIN = [
  { year: 2025, coo_iso: 'SDN', coa_iso: '-', refugees: 2820737, asylum_seekers: 940297, idps: 9139309 },
  { year: 2025, coo_iso: 'TUR', coa_iso: '-', refugees: 149405, asylum_seekers: 117576, idps: '0' },
  { year: 2025, coo_iso: 'BES', coa_iso: '-', refugees: '0', asylum_seekers: 5, idps: '0' },
];
const ASYLUM = [
  { year: 2025, coo_iso: '-', coa_iso: 'TUR', refugees: 2390414, asylum_seekers: 102497, idps: '0' },
];

describe('buildDisplacement', () => {
  const table = buildDisplacement(COUNTRIES, ORIGIN, ASYLUM, 2025);

  it('joins origin and asylum figures per country', () => {
    expect(table.find(d => d.iso2 === 'TR')).toEqual({
      iso2: 'TR', year: 2025,
      refugees_from: 149405, asylum_seekers_from: 117576, idps: 0,
      refugees_hosted: 2390414, asylum_seekers_hosted: 102497,
      source: 'UNHCR', url: 'https://www.unhcr.org/refugee-statistics/',
    });
    expect(table.find(d => d.iso2 === 'SD')).toMatchObject({ refugees_from: 2820737, idps: 9139309, refugees_hosted: 0 });
  });

  it('skips rows it cannot place on an ISO-2 country', () => {
    expect(table.map(d => d.iso2).sort()).toEqual(['SD', 'TR']);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads live figures for Sudan', async () => {
  const sd = await displacementFor('sd');
  expect(sd?.idps).toBeGreaterThan(1_000_000);
  expect(sd?.year).toBeGreaterThanOrEqual(2024);
}, 60_000);
