import type { RawEnvelope } from '@takip/archive/envelope';
import { shipCategory } from '@takip/core/vessel';
import type { Connector, Observation } from '../observation';

type Frame = {
  MessageType?: string;
  MetaData?: { MMSI?: number; ShipName?: string; latitude?: number; longitude?: number; time_utc?: string };
  Message?: {
    PositionReport?: { Latitude: number; Longitude: number; Sog: number; Cog: number; TrueHeading: number };
    ShipStaticData?: { Name?: string; Destination?: string; Type?: number };
  };
};

// AIS encodes "position not available" as lat 91 / lng 181.
const valid = (lat: unknown, lon: unknown): lat is number =>
  typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** aisstream's "2026-10-12 13:04:05.123456789 +0000 UTC": when aisstream received it, the closest thing to observed time. */
export function parseAisTime(s: string | undefined): number | undefined {
  const m = s?.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d{1,3})?\d* \+0000/);
  if (!m) return undefined;
  const t = Date.parse(`${m[1]}T${m[2]}${m[3] ?? ''}Z`);
  return Number.isNaN(t) ? undefined : t;
}

const clean = (s: string | undefined) => s?.replace(/@+$/, '').trim() || undefined;

export const aisstream: Connector = {
  source: 'aisstream',
  *map(env: RawEnvelope): Iterable<Observation> {
    const frame = env.body as Frame | null;
    const mmsi = frame?.MetaData?.MMSI;
    if (!mmsi) return;
    const key = String(mmsi);
    const t = parseAisTime(frame.MetaData?.time_utc) ?? env.at;
    const name = clean(frame.MetaData?.ShipName);

    if (frame.MessageType === 'PositionReport') {
      const r = frame.Message?.PositionReport;
      if (!r || !valid(r.Latitude, r.Longitude)) return;
      yield {
        shape: 'track',
        cls: 'vessel',
        scheme: 'mmsi',
        key,
        t,
        lon: r.Longitude,
        lat: r.Latitude,
        // 102.3 kn = speed not available.
        speed: r.Sog >= 102.3 ? undefined : r.Sog,
        // 511 = no heading sensor; fall back to course over ground (360 = not available).
        heading: r.TrueHeading !== 511 ? r.TrueHeading : r.Cog < 360 ? r.Cog : undefined,
        tIsReceive: true,
        label: name,
      };
    } else if (frame.MessageType === 'ShipStaticData') {
      const info = frame.Message?.ShipStaticData;
      yield {
        shape: 'state',
        cls: 'vessel',
        scheme: 'mmsi',
        key,
        t,
        name: clean(info?.Name) ?? name,
        category: shipCategory(info?.Type),
        destination: clean(info?.Destination),
      };
    }
  },
};
