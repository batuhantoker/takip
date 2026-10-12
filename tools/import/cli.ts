/*
 * Historical dataset importers (replay-database.md §7.5, dataset-import-map.md).
 *   npx tsx tools/import/cli.ts <seed|dataset…|all|check> [--force] [--dry-run] [--data-dir <dir>]
 * --dry-run imports into a copy of catalog.db and history.db and prints the reports, leaving data/ untouched.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataLayout, openReader } from '@takip/db';
import { check } from './check';
import { type Ctx, openContext, REPO } from './context';
import { DATASETS } from './datasets';
import { seed } from './seed';

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const dirAt = args.indexOf('--data-dir');
  const names = args.filter((a, i) => !a.startsWith('--') && i !== dirAt + 1);
  if (!names.length) {
    console.log(`usage: import <seed|all|check|${Object.keys(DATASETS).join('|')}>… [--force] [--dry-run] [--data-dir dir]`);
    process.exit(1);
  }
  let dataDir = dirAt >= 0 ? args[dirAt + 1] : (process.env.TAKIP_DATA_DIR ?? process.env.OSIRIS_DATA_DIR ?? join(REPO, 'data'));
  let scratch: string | undefined;
  if (flag('--dry-run')) {
    scratch = mkdtempSync(join(tmpdir(), 'takip-import-'));
    const from = dataLayout(dataDir);
    const to = dataLayout(scratch);
    mkdirSync(to.dbDir, { recursive: true });
    for (const [src, dst] of [[from.catalog, to.catalog], [from.history, to.history]]) {
      const db = openReader(src);
      db?.prepare('VACUUM INTO ?').run(dst);
      db?.close();
    }
    dataDir = scratch;
  }

  const ctx: Ctx = openContext({ dataDir, force: flag('--force') });
  const started = Date.now();
  try {
    const run = names.includes('all') ? ['seed', ...Object.keys(DATASETS), 'check'] : names;
    for (const name of run) {
      const t0 = Date.now();
      if (name === 'seed') await seed(ctx);
      else if (name === 'check') {
        if (check(ctx).length) process.exitCode = 1;
      }
      else if (DATASETS[name]) await DATASETS[name](ctx);
      else throw new Error(`unknown dataset ${name}`);
      ctx.log(`${name}: done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
    if (scratch) {
      const reports = ctx.catalog.prepare(`
        SELECT s.code, d.report FROM meta_dataset d JOIN meta_source s USING (source_id) WHERE d.imported_at >= ? ORDER BY d.dataset_id
      `).all(started) as { code: string; report: string | null }[];
      for (const r of reports) console.log(r.code, r.report);
    }
  } finally {
    ctx.close();
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
