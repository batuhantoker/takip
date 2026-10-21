import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { Zipped } from './shapes';
import { stopPlaces, tripStopIds } from './stops';

const zipped = (text: string): Zipped => ({ data: deflateRawSync(Buffer.from(text)), method: 8 });

const STOP_TIMES = [
  'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
  'T-1,08:00:00,08:00:00,A,1',
  'T-1,08:04:00,08:04:00,C,3',
  'T-1,08:02:00,08:02:00,B,2',
  'T-10,09:00:00,09:00:00,C,1',
  'T-10,09:05:00,09:05:00,A,2',
  'T-2,10:00:00,10:00:00,B,1',
].join('\n');

describe('gtfs stops', () => {
  it("reads a trip's stops in sequence order, not another trip whose id contains it", async () => {
    expect(await tripStopIds(zipped(STOP_TIMES), 'T-1')).toEqual(['A', 'B', 'C']);
    expect(await tripStopIds(zipped(STOP_TIMES), 'T-10')).toEqual(['C', 'A']);
    expect(await tripStopIds(zipped(STOP_TIMES), 'T-9')).toEqual([]);
  });

  it('stops scanning once past the trip, through a file larger than one inflate chunk', async () => {
    const rows = Array.from({ length: 40_000 }, (_, i) => `R${Math.floor(i / 4)},,,S${i % 4},${i % 4}`);
    // A stray row far down is never reached.
    const big = zipped(['trip_id,arrival_time,departure_time,stop_id,stop_sequence', ...rows, 'R3,,,S9,9'].join('\n'));
    expect(await tripStopIds(big, 'R3')).toEqual(['S0', 'S1', 'S2', 'S3']);
  });

  it('places stops by id, leaving out those without a position', async () => {
    const stops = zipped('stop_id,stop_name,stop_lat,stop_lon,location_type\nA,"Main St, north",42.3601234,-71.0589876,0\nN,,,,3\n');
    expect([...(await stopPlaces(stops))]).toEqual([['A', [-71.05899, 42.36012, 'Main St, north']]]);
  });
});
