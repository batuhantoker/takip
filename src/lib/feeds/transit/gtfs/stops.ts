import { scanCsv, type Zipped } from './shapes';

/** stop_id → [lng, lat, name]. */
export type StopPlaces = Map<string, [number, number, string]>;

const round = (v: number) => Math.round(v * 1e5) / 1e5;

/** A trip's stops in running order. Feeds keep a trip's rows together, so the scan stops once past them. */
export async function tripStopIds(stopTimes: Zipped, tripId: string): Promise<string[]> {
  const rows: { seq: number; stop: string }[] = [];
  await scanCsv(stopTimes, cell => {
    if (cell('trip_id') !== tripId) return rows.length > 0;
    const stop = cell('stop_id');
    if (stop) rows.push({ seq: Number(cell('stop_sequence')), stop });
    return false;
  }, { has: tripId, missed: () => rows.length > 0 });
  return rows.sort((a, b) => a.seq - b.seq).map(r => r.stop);
}

export async function stopPlaces(stops: Zipped): Promise<StopPlaces> {
  const out: StopPlaces = new Map();
  await scanCsv(stops, cell => {
    const id = cell('stop_id'), lat = cell('stop_lat'), lng = cell('stop_lon');
    // Generic nodes and boarding areas may come without a position.
    if (id && lat && lng && Number.isFinite(+lat) && Number.isFinite(+lng)) out.set(id, [round(+lng), round(+lat), cell('stop_name')]);
  });
  return out;
}
