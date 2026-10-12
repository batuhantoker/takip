import type { RawEnvelope } from '@takip/archive/envelope';
import { aircraftCategory } from '@takip/core/aircraft';
import type { Connector, TrackFix } from '../observation';

const MS_TO_KN = 1.94384;

/*
 * /api/states/all?extended=1 state vectors (https://openskynetwork.github.io/opensky-api/rest.html):
 * [icao24, callsign, origin_country, time_position, last_contact, lon, lat, baro_altitude,
 *  on_ground, velocity, true_track, vertical_rate, sensors, geo_altitude, squawk, spi,
 *  position_source, category]
 */
type StateVector = [string, string | null, string, number | null, number, number | null, number | null, number | null,
  boolean, number | null, number | null, number | null, unknown, number | null, string | null, boolean, number, number?];

export const opensky: Connector = {
  source: 'opensky',
  *map(env: RawEnvelope) {
    const body = env.body as { states?: StateVector[] | null } | null;
    for (const s of body?.states ?? []) {
      // time_position is when the position was last updated: the observed time. Null means no position at all.
      const [icao24, rawCallsign, , timePosition, , lon, lat, baroAlt, onGround, velocity, track, , , geoAlt, , , , emitter] = s;
      if (timePosition == null || lon == null || lat == null || !icao24) continue;
      const callsign = rawCallsign?.trim() || undefined;
      const alt = onGround ? 0 : (baroAlt ?? geoAlt ?? undefined);
      const speed = velocity == null ? undefined : velocity * MS_TO_KN;
      const fix: TrackFix = {
        shape: 'track',
        cls: 'aircraft',
        scheme: 'icao24',
        key: icao24.toLowerCase(),
        t: timePosition * 1000,
        lon,
        lat,
        alt: alt ?? undefined,
        speed,
        heading: track ?? undefined,
        label: callsign,
        category: aircraftCategory({ flight: callsign, hex: icao24, category_os: emitter, altMeters: alt ?? 0, speedKnots: speed ?? null }),
      };
      yield fix;
    }
  },
};
