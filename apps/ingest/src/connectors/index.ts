import type { Connector } from '../observation';
import { adsbfi, adsblol } from './adsbfi';
import { adsblolHistory } from './adsblol-history';
import { aisstream } from './aisstream';
import { celestrak } from './celestrak';
import { opensky } from './opensky';

export const CONNECTORS: Record<string, Connector> = { aisstream, opensky, adsbfi, adsblol, 'adsblol-history': adsblolHistory, celestrak };

/** Sources recording now: the worker seals every hour from their first recorded day on. */
export const LIVE_TRACK_SOURCES = ['aisstream', 'opensky', 'adsblol', 'adsbfi'] as const;

/** Archive sources whose fixes become tracks; order is the merge order when two report the same second. */
export const TRACK_SOURCES = [...LIVE_TRACK_SOURCES, 'adsblol-history'] as const;
