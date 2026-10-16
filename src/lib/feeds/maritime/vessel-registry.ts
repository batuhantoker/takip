import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * The AIS ship-type code of every vessel heard from lately, kept apart from the live position cache.
 *
 * Type only arrives in static reports, which aisstream relays about every 20 minutes per ship
 * (a quarter of ships send none in a given hour), while the live map forgets a ship 10 minutes after
 * its last position. Without this, half the ships on the map have no class.
 */

/** MMSIs get reassigned when a ship changes flag or owner. */
const TTL_MS = 30 * 24 * 60 * 60_000;
const MAX_VESSELS = 200_000;
const FILE_VERSION = 1;

export class VesselRegistry {
  // Insertion order tracks recency, so eviction drops the vessel heard from longest ago.
  private readonly codes = new Map<number, { code: number; at: number }>();
  dirty = false;

  get size() {
    return this.codes.size;
  }

  code(mmsi: number): number | undefined {
    return this.codes.get(mmsi)?.code;
  }

  remember(mmsi: number, code: number, at: number): void {
    const known = this.codes.get(mmsi);
    if (known && known.at > at) return;
    this.codes.delete(mmsi);
    this.codes.set(mmsi, { code, at });
    this.dirty = true;
    if (this.codes.size > MAX_VESSELS) {
      const oldest = this.codes.keys().next().value;
      if (oldest !== undefined) this.codes.delete(oldest);
    }
  }

  /** Rows as saved: [mmsi, code, at], oldest first. */
  rows(now: number): [number, number, number][] {
    const rows: [number, number, number][] = [];
    for (const [mmsi, { code, at }] of this.codes) if (now - at < TTL_MS) rows.push([mmsi, code, at]);
    return rows;
  }

  load(rows: [number, number, number][], now: number): void {
    for (const [mmsi, code, at] of [...rows].sort((a, b) => a[2] - b[2])) {
      if (now - at < TTL_MS) this.remember(mmsi, code, at);
    }
  }
}

/** Null when saving is switched off (TAKIP_AIS_REGISTRY=off). */
export const registryPath = (): string | null => {
  const path = process.env.TAKIP_AIS_REGISTRY;
  if (path === 'off') return null;
  return path || join(process.cwd(), '.cache', 'ais-vessels.json');
};

export async function readRegistry(path: string): Promise<[number, number, number][]> {
  try {
    const file = JSON.parse(await readFile(path, 'utf8'));
    return file?.version === FILE_VERSION && Array.isArray(file.vessels) ? file.vessels : [];
  } catch {
    return [];
  }
}

/** Via a temporary file and rename, so a crash mid-write never leaves a file the next boot can't parse. */
export async function writeRegistry(path: string, registry: VesselRegistry, now = Date.now()): Promise<void> {
  const rows = registry.rows(now);
  registry.dirty = false;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify({ version: FILE_VERSION, savedAt: now, vessels: rows }));
  await rename(temporary, path);
}
