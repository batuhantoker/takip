import { createHash } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dataLayout,
  type Db,
  openWriter,
  SqliteDocStore,
  SqliteEventStore,
  SqliteSeriesStore,
} from '@takip/db';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const RAW = join(REPO, 'docs/data/raw-2026-10-12-new');
/** Keyless downloads written by fetch.ts. */
export const RAW_MORE = join(REPO, 'docs/data/raw-2026-10-12-more');

/** catalog.db is shared with the ingest worker: keep each transaction to about this many rows (§4.2). */
export const CATALOG_BATCH = 2000;

export type Ctx = {
  catalog: Db;
  history: Db;
  events: SqliteEventStore;
  series: SqliteSeriesStore;
  docs: SqliteDocStore;
  layout: ReturnType<typeof dataLayout>;
  force: boolean;
  log: (msg: string) => void;
  close(): void;
};

export function openContext(opts: { dataDir?: string; force?: boolean; quiet?: boolean } = {}): Ctx {
  const layout = dataLayout(opts.dataDir ?? process.env.TAKIP_DATA_DIR ?? process.env.OSIRIS_DATA_DIR ?? join(REPO, 'data'));
  const catalog = openWriter(layout.catalog, 'catalog');
  const history = openWriter(layout.history, 'history');
  return {
    catalog,
    history,
    events: new SqliteEventStore(history),
    series: new SqliteSeriesStore(history),
    docs: new SqliteDocStore(history),
    layout,
    force: !!opts.force,
    log: opts.quiet ? () => {} : (msg: string) => console.log(msg),
    close() {
      history.close();
      catalog.close();
    },
  };
}

/** Runs `fn` over `items` in catalog-sized transactions. */
export function batched<T>(db: Db, items: T[], fn: (item: T) => void, size = CATALOG_BATCH) {
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    db.transaction(() => slice.forEach(fn))();
  }
}

export function sourceId(ctx: Ctx, code: string): number {
  const id = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = ?`).pluck().get(code) as number | undefined;
  if (id === undefined) throw new Error(`unknown source ${code}; run \`import seed\` first`);
  return id;
}

async function sha256(path: string) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest('hex');
}

export type DatasetSpec = {
  source: string;
  version: string;
  /** When the dataset was current, ISO date. */
  asOf: string;
  files: string[];
  /** Duplicates of imported files (dataset-import-map.md §1): hashed so a changed download gets noticed. */
  skipped?: { file: string; duplicateOf?: string; reason?: string }[];
  importerVersion: string;
};

export type Gap = { tLo: number; tHi: number; kind: 'missing' | 'partial' | 'preliminary'; note: string };

export type Report = {
  rows: number;
  rejects: { reason: string; n: number; sample: string[] }[];
  unresolved: { key: string; n: number }[];
  sentinels: Record<string, number>;
  [k: string]: unknown;
};

/** Counts rejects, unresolved values and mapped sentinels for meta_dataset.report (§7.5 step 6). */
export class Reporter {
  rows = 0;
  private rejects = new Map<string, { n: number; sample: string[] }>();
  private unresolved = new Map<string, number>();
  private sentinels = new Map<string, number>();
  extra: Record<string, unknown> = {};

  reject(reason: string, sample: string) {
    const r = this.rejects.get(reason) ?? { n: 0, sample: [] };
    r.n++;
    if (r.sample.length < 5) r.sample.push(sample);
    this.rejects.set(reason, r);
  }
  miss(key: string) {
    this.unresolved.set(key, (this.unresolved.get(key) ?? 0) + 1);
  }
  sentinel(what: string) {
    this.sentinels.set(what, (this.sentinels.get(what) ?? 0) + 1);
  }
  toJSON(): Report {
    return {
      rows: this.rows,
      rejects: [...this.rejects].map(([reason, r]) => ({ reason, ...r })),
      unresolved: [...this.unresolved].sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, n })),
      sentinels: Object.fromEntries(this.sentinels),
      ...this.extra,
    };
  }
}

export type Dataset = { datasetId: number; sourceId: number; skip: boolean; report: Reporter };

/** Register (§7.5 step 1): hash the files; an unchanged, active dataset is skipped unless --force. */
export async function beginDataset(ctx: Ctx, spec: DatasetSpec): Promise<Dataset> {
  const src = sourceId(ctx, spec.source);
  const files = [];
  for (const f of spec.files) files.push({ path: relative(RAW, f), sha256: await sha256(f), bytes: statSync(f).size });
  for (const s of spec.skipped ?? [])
    files.push({ path: relative(RAW, s.file), sha256: await sha256(s.file), bytes: statSync(s.file).size, skipped: s.duplicateOf ? 'duplicate_of' : (s.reason ?? 'skipped'), duplicateOf: s.duplicateOf && basename(s.duplicateOf) });
  const filesJson = JSON.stringify(files);
  const active = ctx.catalog.prepare(`SELECT dataset_id, files, importer_version FROM meta_dataset WHERE source_id = ? AND status = 'active'`).get(src) as
    | { dataset_id: number; files: string; importer_version: string }
    | undefined;
  const report = new Reporter();
  if (active && active.files === filesJson && active.importer_version === spec.importerVersion && !ctx.force)
    return { datasetId: active.dataset_id, sourceId: src, skip: true, report };
  const licence = ctx.catalog.prepare(`SELECT licence_id FROM meta_source WHERE source_id = ?`).pluck().get(src) as number;
  const asOf = Date.parse(spec.asOf);
  const datasetId = ctx.catalog.prepare(`
    INSERT INTO meta_dataset (source_id, version, as_of, files, licence_id, importer_version, status, imported_at)
    VALUES (?, ?, ?, ?, ?, ?, 'loading', ?)
    ON CONFLICT (source_id, version) DO UPDATE SET as_of = excluded.as_of, files = excluded.files, licence_id = excluded.licence_id,
      importer_version = excluded.importer_version, status = 'loading', imported_at = excluded.imported_at, report = NULL
    RETURNING dataset_id
  `).pluck().get(src, spec.version, asOf, filesJson, licence, spec.importerVersion, Date.now()) as number;
  return { datasetId, sourceId: src, skip: false, report };
}

/** Publish (§7.5 step 5): gaps, active/superseded, layer versions, report. */
export function finishDataset(ctx: Ctx, ds: Dataset, opts: { tLo?: number | null; tHi?: number | null; gaps?: Gap[]; layers?: string[] }) {
  const now = Date.now();
  ctx.catalog.transaction(() => {
    ctx.catalog.prepare(`UPDATE meta_dataset SET status = 'superseded' WHERE source_id = ? AND status = 'active' AND dataset_id <> ?`).run(ds.sourceId, ds.datasetId);
    ctx.catalog.prepare(`UPDATE meta_dataset SET status = 'active', t_lo = ?, t_hi = ?, report = ? WHERE dataset_id = ?`)
      .run(opts.tLo ?? null, opts.tHi ?? null, JSON.stringify(ds.report.toJSON()), ds.datasetId);
    ctx.catalog.prepare(`DELETE FROM meta_dataset_gap WHERE dataset_id = ?`).run(ds.datasetId);
    const gap = ctx.catalog.prepare(`INSERT INTO meta_dataset_gap (dataset_id, t_lo, t_hi, kind, note) VALUES (?, ?, ?, ?, ?)`);
    for (const g of opts.gaps ?? []) gap.run(ds.datasetId, g.tLo, g.tHi, g.kind, g.note);
    const bump = ctx.catalog.prepare(`
      INSERT INTO meta_layer_version (layer, version, changed_at) VALUES (?, 1, ?)
      ON CONFLICT (layer) DO UPDATE SET version = version + 1, changed_at = excluded.changed_at
    `);
    for (const l of opts.layers ?? []) bump.run(l, now);
  })();
}

export function failDataset(ctx: Ctx, ds: Dataset, err: unknown) {
  ctx.catalog.prepare(`UPDATE meta_dataset SET status = 'failed', report = ? WHERE dataset_id = ?`)
    .run(JSON.stringify({ ...ds.report.toJSON(), error: String(err instanceof Error ? err.stack : err) }), ds.datasetId);
}

export type Publish = { tLo?: number | null; tHi?: number | null; gaps?: Gap[]; layers?: string[] };

/** One dataset that writes several shapes (events and series) publishes their union. */
export function mergePublish(...parts: Publish[]): Publish {
  const lo = parts.map(p => p.tLo).filter((t): t is number => t != null);
  const hi = parts.map(p => p.tHi).filter((t): t is number => t != null);
  return {
    tLo: lo.length ? Math.min(...lo) : null,
    tHi: hi.length ? Math.max(...hi) : null,
    gaps: parts.flatMap(p => p.gaps ?? []),
    layers: [...new Set(parts.flatMap(p => p.layers ?? []))],
  };
}

/** Register, run the transform, then publish, or mark the dataset failed and rethrow. */
export async function importDataset(ctx: Ctx, spec: DatasetSpec, body: (ds: Dataset) => Promise<Publish>) {
  const ds = await beginDataset(ctx, spec);
  if (ds.skip) {
    ctx.log(`${spec.source}: unchanged since the last import, skipped (--force to redo)`);
    return;
  }
  try {
    const publish = await body(ds);
    finishDataset(ctx, ds, publish);
    const rep = ds.report.toJSON();
    const unresolved = rep.unresolved.reduce((s, u) => s + u.n, 0);
    const rejects = rep.rejects.reduce((s, x) => s + x.n, 0);
    ctx.log(`${spec.source}: ${rep.rows} rows, ${rejects} rejected, ${unresolved} unresolved values (${rep.unresolved.length} distinct)`);
  } catch (e) {
    failDataset(ctx, ds, e);
    throw e;
  }
}
