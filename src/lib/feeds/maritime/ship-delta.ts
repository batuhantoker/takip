/**
 * /api/maritime sends every ship once, then only the ships heard since the browser's last reply: in a 10 s poll
 * about one in twelve has moved, so the rest would be the same 2.5 MB again. Both sides drop a ship unheard for
 * SHIP_STALE_MS, so the browser's copy matches the server's without a removal list.
 */

export const SHIP_STALE_MS = 10 * 60_000;

export interface ShipRow { mmsi: number; timestamp: number }

export interface ShipReply<S extends ShipRow = ShipRow> {
  ships?: S[];
  /** When the server's snapshot was built: the next request's `since`. */
  timestamp?: string;
  /** Only the ships heard after the request's `since`. */
  delta?: boolean;
}

/** `since` from a request, when the browser can still hold everything older; null asks for every ship. */
export function parseSince(raw: string | null, builtAt: number): number | null {
  if (raw == null || !/^\d{1,15}$/.test(raw)) return null;
  const since = Number(raw);
  return since <= builtAt && builtAt - since < SHIP_STALE_MS ? since : null;
}

export const shipsSince = <S extends ShipRow>(ships: S[], since: number) => ships.filter(s => s.timestamp > since);

/** The browser's ship list, kept from a full reply and the changes after it. */
export function createShipBook<S extends ShipRow>() {
  const ships = new Map<number, S>();
  let since: number | null = null;
  return {
    url: (path = '/api/maritime') => (since == null ? path : `${path}?since=${since}`),
    apply(reply: ShipReply<S>): S[] {
      const at = reply.timestamp ? Date.parse(reply.timestamp) : NaN;
      if (!reply.delta) ships.clear();
      for (const s of reply.ships ?? []) ships.set(s.mmsi, s);
      if (Number.isFinite(at)) {
        for (const [mmsi, s] of ships) if (at - s.timestamp > SHIP_STALE_MS) ships.delete(mmsi);
        since = at;
      } else since = null;
      return [...ships.values()];
    },
  };
}
