import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { archiveRange, indexArchive, type QuakeArchive, type QuakeIndex } from '@/lib/feeds/hazards/quake-archive';
import type { Bbox } from '@/lib/map/embed/spec';
import { DATA_RECHECK_MS, SITE_DATA } from '@/lib/platform/site/places/gazetteer';
import type { Quake } from '../catalog';

const FILE = join(SITE_DATA, 'earthquakes.json');

let held: { ix: QuakeIndex | null; mtime: number; checked: number } | null = null;

/** The archive, read again when the hazards builder rewrites it; null when there is none. */
function archive(): QuakeIndex | null {
  const now = Date.now();
  if (held && now - held.checked < DATA_RECHECK_MS) return held.ix;
  const mtime = existsSync(FILE) ? statSync(FILE).mtimeMs : 0;
  if (!held || held.mtime !== mtime) {
    held = { ix: mtime ? indexArchive(JSON.parse(readFileSync(FILE, 'utf8')) as QuakeArchive) : null, mtime, checked: now };
  }
  held.checked = now;
  return held.ix;
}

/** The window from data/site/earthquakes.json, as the range route's payload has it; null when it isn't all there. */
export function archivedRange(from: number, to: number, minMag: number, bbox: Bbox | undefined, limit: number) {
  const ix = archive();
  const got = ix && archiveRange(ix, from, to, minMag, bbox, limit);
  if (!got) return null;
  const earthquakes = got.rows.map(([id, time, lng, lat, depth, magnitude, place, network]): Quake => ({
    id, lat, lng, depth, magnitude, place: place || 'Unknown location', time,
    url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`, source: 'USGS', network: network || undefined,
  }));
  return { earthquakes, total: got.total };
}
