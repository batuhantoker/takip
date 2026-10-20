import { join } from 'node:path';
import { type Ctx, REPO } from '../context';
import { readCsv } from '../csv';
import { isoDate } from '../dates';
import { validLonLat } from '../events';
import { KEY_SCHEME } from '../resolver';

/**
 * Seats of government by polity key, for events a source places only by country (cline.ts, pax.ts). Rows are
 * GeoNames national capitals (cities15000 PPLC, CC BY 4.0), with hand rows where the government sits elsewhere
 * (La Paz, Cotonou, Abidjan) or moved since 1945; `from` is inclusive, `to` exclusive, blank is open. `official`
 * rows are capitals in name only, never placed at: other sources place events there.
 */
export const CAPITALS = join(REPO, 'tools/import/datasets/capitals.csv');

export type Capital = { city: string; lon: number; lat: number; lo: number; hi: number };

const bound = (s: string, open: number) => (s.trim() ? isoDate(s)!.t : open);

export function parseCapitals(rows: Record<string, string>[]) {
  const seats = new Map<string, Capital[]>();
  const official = new Map<string, Capital[]>();
  for (const r of rows) {
    const lon = Number(r.lon);
    const lat = Number(r.lat);
    if (!validLonLat(lon, lat)) throw new Error(`capitals.csv: ${r.key} ${r.city} has no valid lon/lat`);
    for (const d of [r.from, r.to]) if (d.trim() && !isoDate(d)) throw new Error(`capitals.csv: ${r.key} has a bad date ${d}`);
    const into = r.official === '1' ? official : seats;
    const list = into.get(r.key) ?? [];
    list.push({ city: r.city, lon, lat, lo: bound(r.from, -Infinity), hi: bound(r.to, Infinity) });
    into.set(r.key, list);
  }
  for (const [key, list] of seats) {
    list.sort((a, b) => a.lo - b.lo);
    for (let i = 1; i < list.length; i++) if (list[i].lo < list[i - 1].hi) throw new Error(`capitals.csv: ${key} rows overlap`);
  }
  return { seats, official };
}

export type CapitalTable = ReturnType<typeof parseCapitals>;

export const capitalIn = (table: CapitalTable, key: string, t: number) => table.seats.get(key)?.find(c => c.lo <= t && t < c.hi);

/** A polity entity's capital at a time, through its TAKIP key. */
export class Capitals {
  private keys = new Map<number, string | null>();

  private constructor(private readonly ctx: Ctx, readonly table: CapitalTable) {}

  static async read(ctx: Ctx) {
    return new Capitals(ctx, parseCapitals(await readCsv(CAPITALS)));
  }

  key(entityId: number) {
    if (!this.keys.has(entityId)) {
      const key = this.ctx.catalog.prepare(`
        SELECT i.value FROM core_entity_identifier i JOIN core_id_scheme s USING (scheme_id) WHERE s.code = ? AND i.entity_id = ?
      `).pluck().get(KEY_SCHEME, entityId) as string | undefined;
      this.keys.set(entityId, key ?? null);
    }
    return this.keys.get(entityId) ?? null;
  }

  at(entityId: number | undefined, t: number) {
    const key = entityId === undefined ? null : this.key(entityId);
    return key ? capitalIn(this.table, key, t) : undefined;
  }

  /** Every capital the polity has had, official ones too: another source may have placed the same event at any. */
  all(entityId: number | undefined) {
    const key = entityId === undefined ? null : this.key(entityId);
    return key ? [...(this.table.seats.get(key) ?? []), ...(this.table.official.get(key) ?? [])] : [];
  }
}

/** How a capital placement reads in the popup: "Placed at the capital at the time (Lagos)." */
export const capitalPlacedAt = (c: Capital) => `capital at the time (${c.city})`;
