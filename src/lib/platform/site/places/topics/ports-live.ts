import type { NearCount } from '@/lib/feeds/maritime/ships-near';
import { ownApi } from '../../live/own-api';

/** /api/maritime?near=…'s reply. */
export interface NearReply { near?: NearCount; timestamp?: string }

/** The ships the maritime layer has around a port right now. */
export interface ShipsNow {
  port: string;
  km: number;
  total: number;
  /** Moving at UNDERWAY_KNOTS or more, as the map's "underway only" filter counts them. */
  underway: number;
  /** [ship class, count], most first; ships whose static report hasn't arrived are 'other'. */
  types: [string, number][];
  at: number;
}

/** Null when the layer has no ships there: far more often a gap in AIS reception than an empty harbour. */
export function shipsNear(json: NearReply | null, port: string): ShipsNow | null {
  const near = json?.near;
  if (!near?.total) return null;
  const at = json?.timestamp ? Date.parse(json.timestamp) : NaN;
  return {
    port, km: near.km, total: near.total, underway: near.underway,
    types: Object.entries(near.types).sort((a, b) => b[1] - a[1]),
    at: Number.isFinite(at) ? at : Date.now(),
  };
}

export async function shipsNow(port: { name: string; at: [number, number]; km: number }): Promise<ShipsNow | null> {
  const [lng, lat] = port.at.map(v => Math.round(v * 1e4) / 1e4);
  return shipsNear(await ownApi<NearReply>(`/api/maritime?near=${lat},${lng}&km=${port.km}`, 30), port.name);
}
