import type { RawEnvelope } from '@takip/archive/envelope';
import type { TrackClassName } from '@takip/core/tracks';

/*
 * What connectors turn archive envelopes into (replay-database.md §7.2). The track and tle shapes
 * are built; event, series, catalog and document arrive with their stores.
 */

export type TrackFix = {
  shape: 'track';
  cls: TrackClassName;
  scheme: 'mmsi' | 'icao24';
  key: string;
  /** Observed time, epoch ms; receive time when `tIsReceive`. */
  t: number;
  lon: number;
  lat: number;
  /** Metres. */
  alt?: number;
  /** Knots. */
  speed?: number;
  /** Degrees. */
  heading?: number;
  tIsReceive?: boolean;
  /** Callsign for aircraft, ship name for vessels. */
  label?: string;
  /** Category name (core/aircraft, core/vessel), when this fix says something about it. */
  category?: string;
};

/** Slow-changing facts about a track that arrive without a position (AIS static data). */
export type TrackState = {
  shape: 'state';
  cls: TrackClassName;
  scheme: 'mmsi' | 'icao24';
  key: string;
  t: number;
  name?: string;
  category?: string;
  destination?: string;
};

export type TleObservation = { shape: 'tle'; norad: number; epoch: number; line1: string; line2: string; name: string | null };

export type Observation = TrackFix | TrackState | TleObservation;

export interface Connector {
  /** meta_source.code, and the archive directory. */
  source: string;
  /** Pure: tested against recorded envelopes, and run again on every rebuild. */
  map(env: RawEnvelope): Iterable<Observation>;
}
