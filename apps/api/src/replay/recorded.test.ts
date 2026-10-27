import type { CoverageRow } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { recordedSpans } from './recorded';

const H = 3_600_000;
const row = (source: string, tLo: number, tHi: number | null, status: CoverageRow['status'] = 'ok'): CoverageRow => ({ source, tLo: tLo * H, tHi: tHi === null ? null : tHi * H, status });

describe('recordedSpans', () => {
  it('merges each class across its sources, so one quiet source is not a gap', () => {
    const rows = [row('opensky', 0, 3), row('adsbfi', 2, 5, 'degraded'), row('adsblol', 7, 8), row('aisstream', 0, 8)];
    expect(recordedSpans(rows, 0)).toEqual({
      aircraft: [[0, 5 * 3600], [7 * 3600, 8 * 3600]],
      vessel: [[0, 8 * 3600]],
    });
  });

  it('leaves out outages and sources that record no tracks', () => {
    const rows = [row('opensky', 0, 2, 'down'), row('adsbfi', 2, 3, 'not_recording'), row('usgs', 0, 3), row('cctv', 0, 3)];
    expect(recordedSpans(rows, 0)).toEqual({ aircraft: [], vessel: [] });
  });

  it('starts at the lookback, keeps the current hour to its end and an open span open', () => {
    expect(recordedSpans([row('aisstream', 0, 4), row('opensky', 3, null)], 2 * H)).toEqual({
      vessel: [[2 * 3600, 4 * 3600]],
      aircraft: [[3 * 3600, null]],
    });
  });
});
