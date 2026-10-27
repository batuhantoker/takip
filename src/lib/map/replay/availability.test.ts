import { describe, expect, it } from 'vitest';
import { frameSpans, gapsWithin, missingAt, rangesFor, trackSpans, unionSpans } from './availability';
import type { Manifest } from './session';

const span = (from: number, to: number) => ({ from, to });

describe('replay availability', () => {
  it('reads recorded spans in ms, an open one never ending, and the whole lookback from an older api', () => {
    const manifest = { limits: { earliest: 5 }, recorded: { aircraft: [[10, 20], [30, null]], vessel: [] } } as unknown as Manifest;
    expect(trackSpans(manifest, 'aircraft')).toEqual([span(10_000, 20_000), span(30_000, Number.POSITIVE_INFINITY)]);
    expect(trackSpans(manifest, 'vessel')).toEqual([]);
    expect(trackSpans({ limits: { earliest: 5 } } as Manifest, 'vessel')).toEqual([span(5_000, Number.POSITIVE_INFINITY)]);
  });

  it('offers the ranges shorter than the data, then one spanning it if any fits', () => {
    const HOUR = 3_600_000;
    const day = { id: 'day', ms: 24 * HOUR }, month = { id: 'month', ms: 720 * HOUR }, all = { id: 'all', ms: Number.POSITIVE_INFINITY };
    const ranges = [day, month, all];
    const now = 1_000 * HOUR;
    expect(rangesFor(ranges, undefined, now)).toEqual({ shorter: [day, month], whole: all });
    // The anonymous lookback, floored to the hour: a day and a bit is still "Last 24 hours".
    expect(rangesFor(ranges, now - 25 * HOUR, now)).toEqual({ shorter: [], whole: day });
    expect(rangesFor(ranges, now - 20 * HOUR, now)).toEqual({ shorter: [], whole: null });
    // A week (the free plan): 30 days would overshoot it.
    expect(rangesFor(ranges, now - 168 * HOUR, now)).toEqual({ shorter: [day], whole: null });
    expect(rangesFor(ranges, now - 10_000 * HOUR, now)).toEqual({ shorter: [day, month], whole: null });
  });

  it('merges overlapping and touching spans across layers', () => {
    expect(unionSpans([[span(0, 10), span(30, 40)], [span(5, 20), span(40, 50)], [span(60, 60)]])).toEqual([span(0, 20), span(30, 50)]);
  });

  it('turns frames into the spans they stand for, a missing frame leaving a gap', () => {
    expect(frameSpans([0, 10, 20, 40], 10)).toEqual([span(0, 30), span(40, 50)]);
  });

  it('finds the gaps within a window, at both ends too', () => {
    const spans = [span(10, 20), span(30, 40)];
    expect(gapsWithin(spans, 0, 50)).toEqual([span(0, 10), span(20, 30), span(40, 50)]);
    expect(gapsWithin(spans, 15, 35)).toEqual([span(20, 30)]);
    expect(gapsWithin([], 0, 50)).toEqual([span(0, 50)]);
  });

  it('names the layers with nothing at a moment', () => {
    const layers = [{ label: 'Flights', spans: [span(0, 100)] }, { label: 'Radar', spans: [span(80, 120)] }];
    expect(missingAt(layers, 50)).toEqual(['Radar']);
    expect(missingAt(layers, 90)).toEqual([]);
    expect(missingAt(layers, 110)).toEqual(['Flights']);
  });
});
