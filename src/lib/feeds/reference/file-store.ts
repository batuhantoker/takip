import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { intersectsAny, type Box } from './bbox';
import { tierAt, type ReferenceDataset } from './catalog';
import { clipLineFeature } from './clip';
import { metresPerPixel, simplifyLineFeature } from './simplify';

const MIN_SIMPLIFY_M = 20;

export interface ReferenceQuery {
  boxes: readonly Box[];
  zoom: number;
  limit: number;
}

export interface ReferenceResult {
  /** Each feature as the GeoJSON text stored on disk, ready to splice into a response. */
  features: string[];
  /** How many features matched before `limit` cut the list. */
  matched: number;
}

export interface DatasetStat {
  /** Changes whenever the dataset does; used as the ETag. */
  version: string;
  bytes: number;
  updated: string;
}

/** What the API needs from storage. A PostGIS store can implement the same two calls. */
export interface ReferenceStore {
  /** Null when the dataset is not installed. */
  stat(id: string): Promise<DatasetStat | null>;
  query(dataset: ReferenceDataset, q: ReferenceQuery): Promise<ReferenceResult>;
}

export function referenceDir(): string {
  return process.env.REFERENCE_DATA_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'reference');
}

interface FeatureIndex {
  count: number;
  /** west, south, east, north per feature. */
  bboxes: Float64Array;
  offsets: Float64Array;
  lengths: Uint32Array;
  /** Values of the properties the dataset's tiers filter on, one per feature. */
  columns: Map<string, unknown[]>;
}

// Keyed by file path; holds only bboxes and offsets, so even the 165 MB highway file costs ~35 MB.
const indexes = new Map<string, { version: string; index: Promise<FeatureIndex> }>();

function geometryBbox(coords: unknown): [number, number, number, number] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c: unknown[]) => {
    if (typeof c[0] === 'number') {
      const x = c[0], y = c[1] as number;
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
      return;
    }
    for (const sub of c) if (Array.isArray(sub)) walk(sub);
  };
  if (Array.isArray(coords)) walk(coords);
  return w <= e ? [w, s, e, n] : null;
}

// Files are written by tools/slim-geodata.py: a header line, one feature per line (comma-terminated
// except the last), then a closing line. Byte offsets assume "\n" line endings, which it writes.
async function buildIndex(file: string, props: readonly string[]): Promise<FeatureIndex> {
  const bboxes: number[] = [];
  const offsets: number[] = [];
  const lengths: number[] = [];
  const columns = new Map(props.map(p => [p, [] as unknown[]]));
  let offset = 0;
  for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    const bytes = Buffer.byteLength(line);
    if (line.startsWith('{"type":"Feature"')) {
      const trailingComma = line.endsWith(',');
      const feature = JSON.parse(trailingComma ? line.slice(0, -1) : line);
      const bbox = geometryBbox(feature.geometry?.coordinates);
      if (bbox) {
        bboxes.push(...bbox);
        offsets.push(offset);
        lengths.push(trailingComma ? bytes - 1 : bytes);
        for (const [p, column] of columns) column.push(feature.properties?.[p] ?? null);
      }
    }
    offset += bytes + 1;
  }
  return {
    count: offsets.length,
    bboxes: Float64Array.from(bboxes),
    offsets: Float64Array.from(offsets),
    lengths: Uint32Array.from(lengths),
    columns,
  };
}

function indexFor(file: string, version: string, dataset: ReferenceDataset): Promise<FeatureIndex> {
  const cached = indexes.get(file);
  if (cached?.version === version) return cached.index;
  const props = [...new Set((dataset.tiers ?? []).map(t => t.property))];
  const index = buildIndex(file, props);
  indexes.set(file, { version, index });
  index.catch(() => { if (indexes.get(file)?.index === index) indexes.delete(file); });
  return index;
}

const MAX_GAP = 64 * 1024;
const MAX_SPAN = 4 * 1024 * 1024;

/** Reads the hit lines, merging neighbours into one read so a dense view is a few syscalls. */
async function readFeatures(file: string, index: FeatureIndex, hits: number[]): Promise<string[]> {
  if (!hits.length) return [];
  const out: string[] = [];
  const fh = await open(file, 'r');
  try {
    let i = 0;
    while (i < hits.length) {
      const start = index.offsets[hits[i]];
      let end = start + index.lengths[hits[i]];
      let j = i;
      while (j + 1 < hits.length) {
        const next = hits[j + 1];
        const nextEnd = index.offsets[next] + index.lengths[next];
        if (index.offsets[next] - end > MAX_GAP || nextEnd - start > MAX_SPAN) break;
        j++;
        end = nextEnd;
      }
      const buf = Buffer.allocUnsafe(end - start);
      await fh.read(buf, 0, buf.length, start);
      for (let k = i; k <= j; k++) {
        const from = index.offsets[hits[k]] - start;
        out.push(buf.toString('utf8', from, from + index.lengths[hits[k]]));
      }
      i = j + 1;
    }
  } finally {
    await fh.close();
  }
  return out;
}

export function createFileStore(dir: string = referenceDir()): ReferenceStore {
  const fileFor = (id: string) => path.join(dir, `${id}.geojson`);
  const statOf = async (id: string): Promise<DatasetStat | null> => {
    try {
      const s = await stat(fileFor(id));
      return { version: `${s.size.toString(36)}-${Math.floor(s.mtimeMs).toString(36)}`, bytes: s.size, updated: s.mtime.toISOString() };
    } catch {
      return null;
    }
  };
  return {
    stat: statOf,
    async query(dataset, q) {
      const info = await statOf(dataset.id);
      if (!info) throw new Error(`${dataset.id} is not installed`);
      const file = fileFor(dataset.id);
      const index = await indexFor(file, info.version, dataset);
      const tier = tierAt(dataset, q.zoom);
      const allowed = tier ? new Set<unknown>(tier.values) : null;
      const column = tier ? index.columns.get(tier.property) : undefined;
      const hits: number[] = [];
      let matched = 0;
      for (let i = 0; i < index.count; i++) {
        if (allowed && !allowed.has(column?.[i])) continue;
        if (!intersectsAny(index.bboxes, i, q.boxes)) continue;
        matched++;
        if (hits.length < q.limit) hits.push(i);
      }
      const features = await readFeatures(file, index, hits);
      // Lines are stored at ~10 m detail; far out, a pixel covers hundreds of metres, so thin them to about one pixel.
      const tolerance = dataset.geometry === 'line' && metresPerPixel(q.zoom) > MIN_SIMPLIFY_M ? metresPerPixel(q.zoom) : 0;
      if (!dataset.clip && !tolerance) return { features, matched };
      const shaped: string[] = [];
      for (const text of features) {
        const feature = JSON.parse(text);
        if (dataset.clip && !clipLineFeature(feature, q.boxes)) continue;
        if (tolerance) simplifyLineFeature(feature, tolerance);
        shaped.push(JSON.stringify(feature));
      }
      return { features: shaped, matched: matched - (features.length - shaped.length) };
    },
  };
}
