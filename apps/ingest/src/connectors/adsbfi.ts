import type { RawEnvelope } from '@takip/archive/envelope';
import { aircraftCategory } from '@takip/core/aircraft';
import type { Connector } from '../observation';

const FT_TO_M = 0.3048;

/** The readsb / ADSBexchange v2 aircraft object that adsb.fi serves. */
type Aircraft = {
  hex?: string;
  flight?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  dbFlags?: number;
  /** Seconds since the position was received. */
  seen_pos?: number;
  seen?: number;
};

/** adsb.fi and adsb.lol both serve readsb's v2 shape, so one mapper reads either. */
const readsb = (source: string): Connector => ({
  source,
  *map(env: RawEnvelope) {
    const body = env.body as { ac?: Aircraft[]; now?: number } | null;
    // `now` is the feed's own clock in ms; positions are `seen_pos` seconds older than it.
    const now = typeof body?.now === 'number' ? body.now : env.at;
    for (const ac of body?.ac ?? []) {
      // '~' marks a non-ICAO (TIS-B) address, which is not stable enough to be an identity.
      if (!ac.hex || ac.hex.startsWith('~') || typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue;
      const alt = ac.alt_baro === 'ground' ? 0 : typeof ac.alt_baro === 'number' ? ac.alt_baro * FT_TO_M : ac.alt_geom !== undefined ? ac.alt_geom * FT_TO_M : undefined;
      const callsign = ac.flight?.trim() || undefined;
      yield {
        shape: 'track',
        cls: 'aircraft',
        scheme: 'icao24',
        key: ac.hex.toLowerCase(),
        t: now - (ac.seen_pos ?? ac.seen ?? 0) * 1000,
        lon: ac.lon,
        lat: ac.lat,
        alt,
        speed: ac.gs,
        heading: ac.track,
        label: callsign,
        category: aircraftCategory({ t: ac.t, flight: callsign, hex: ac.hex, dbFlags: ac.dbFlags, altMeters: alt ?? 0, speedKnots: ac.gs ?? null }),
      };
    }
  },
});

export const adsbfi = readsb('adsbfi');
export const adsblol = readsb('adsblol');
