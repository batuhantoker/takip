import { describe, expect, it } from 'vitest';
import { parseNoaaScales, SCALES_URL } from './scales';

// Verbatim from noaa-scales.json, 2026-10-12.
const RAW = {"0": {"DateStamp": "2026-10-12", "TimeStamp": "19:53:00", "R": {"Scale": "0", "Text": "none", "MinorProb": null, "MajorProb": null}, "S": {"Scale": "0", "Text": "none", "Prob": null}, "G": {"Scale": "0", "Text": "none"}}, "1": {"DateStamp": "2026-10-12", "TimeStamp": "19:53:00", "R": {"Scale": null, "Text": null, "MinorProb": "45", "MajorProb": "10"}, "S": {"Scale": null, "Text": null, "Prob": "5"}, "G": {"Scale": "0", "Text": "none"}}, "2": {"DateStamp": "2026-10-13", "TimeStamp": "00:00:00", "R": {"Scale": null, "Text": null, "MinorProb": "40", "MajorProb": "5"}, "S": {"Scale": null, "Text": null, "Prob": "1"}, "G": {"Scale": "1", "Text": "minor"}}, "3": {"DateStamp": "2026-10-14", "TimeStamp": "00:00:00", "R": {"Scale": null, "Text": null, "MinorProb": "35", "MajorProb": "5"}, "S": {"Scale": null, "Text": null, "Prob": "1"}, "G": {"Scale": "0", "Text": "none"}}, "-1": {"DateStamp": "2026-10-11", "TimeStamp": "19:53:00", "R": {"Scale": "0", "Text": "none", "MinorProb": null, "MajorProb": null}, "S": {"Scale": "0", "Text": "none", "Prob": null}, "G": {"Scale": "0", "Text": "none"}}};

describe('parseNoaaScales', () => {
  it('reads the latest scales and the three-day forecast', () => {
    expect(parseNoaaScales(RAW)).toEqual({
      observedAt: '2026-10-12T19:53:00Z',
      current: { R: 0, S: 0, G: 0 },
      forecast: [
        { date: '2026-10-12', G: 0, radioMinorPct: 45, radioMajorPct: 10, radiationPct: 5 },
        { date: '2026-10-13', G: 1, radioMinorPct: 40, radioMajorPct: 5, radiationPct: 1 },
        { date: '2026-10-14', G: 0, radioMinorPct: 35, radioMajorPct: 5, radiationPct: 1 },
      ],
    });
  });

  it('keeps a missing scale unknown rather than zero', () => {
    const raw = { ...RAW, '0': { ...RAW['0'], G: { Scale: null, Text: null } } };
    expect(parseNoaaScales(raw).current.G).toBeNull();
  });

  it('throws without a current entry', () => {
    expect(() => parseNoaaScales([])).toThrow();
    expect(() => parseNoaaScales(null)).toThrow();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live scales', async () => {
  const res = await fetch(SCALES_URL, { signal: AbortSignal.timeout(15_000) });
  const scales = parseNoaaScales(await res.json());
  expect(scales.current.G).not.toBeNull();
  expect(scales.forecast).toHaveLength(3);
});
