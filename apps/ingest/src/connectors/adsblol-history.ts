import type { RawEnvelope } from '@takip/archive/envelope';
import { aircraftCategory } from '@takip/core/aircraft';
import type { HourBody } from '../backfill/adsblol-history';
import type { Connector, TrackFix } from '../observation';

const FT_TO_M = 0.3048;

/** Hour bodies written by `backfill adsblol-history`: one aircraft's thinned readsb trace. */
export const adsblolHistory: Connector = {
  source: 'adsblol-history',
  *map(env: RawEnvelope) {
    const body = env.body as HourBody | null;
    if (!body?.points || body.icao.startsWith('~')) return;
    for (const [t, lat, lon, altFt, gs, track, flight] of body.points) {
      const alt = altFt === 'ground' ? 0 : altFt === null ? undefined : altFt * FT_TO_M;
      const fix: TrackFix = {
        shape: 'track',
        cls: 'aircraft',
        scheme: 'icao24',
        key: body.icao.toLowerCase(),
        t: t * 1000,
        lon,
        lat,
        alt,
        speed: gs ?? undefined,
        heading: track ?? undefined,
        label: flight ?? undefined,
        category: aircraftCategory({ t: body.t, flight: flight ?? undefined, hex: body.icao, dbFlags: body.dbFlags, altMeters: alt ?? 0, speedKnots: gs }),
      };
      yield fix;
    }
  },
};
