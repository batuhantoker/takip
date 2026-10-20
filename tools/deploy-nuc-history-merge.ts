// Runs on the NUC, from ~/takip with takip-web, -api and -ingest stopped (tools/deploy-nuc-history.sh does all this):
//   npx tsx <stage>/deploy-nuc-history-merge.ts <stage>
// Turns <stage>/history.mac.db into the NUC's next history.db: it adds the events the NUC's own ingest recorded since
// (and its newer revisions of them), and adds the Mac's new licences, sources and datasets to the NUC's catalog.db with
// the Mac's ids, which the copied events point at. The NUC's tracks, coverage and source switches stay as they are.
import Database from 'better-sqlite3';
import { openWriter, SqliteEventStore } from '@takip/db';

/** Sources apps/ingest writes into history.db (jobs/ingest-events.ts). */
const LIVE = ['usgs'];

const stage = process.argv[2] ?? '.cache/deploy-data';
const DIR = 'data/db';

const columns = (db: Database.Database, table: string) =>
  db.prepare(`SELECT name FROM pragma_table_info(?)`).pluck().all(table) as string[];
const fail = (msg: string): never => {
  console.error(`merge: ${msg}; nothing swapped.`);
  process.exit(1);
};

// Every source the copied events use has to mean the same here, or keep its id free to be added.
const c = new Database(`${DIR}/catalog.db`);
c.exec(`ATTACH '${stage}/catalog.mac.db' AS mac`);
const h = new Database(`${stage}/history.mac.db`);
const used = new Set(h.prepare(`SELECT DISTINCT source_id FROM ev_event`).pluck().all() as number[]);
for (const [id, code, here, elsewhere] of c.prepare(`
  SELECT m.source_id, m.code, n.code, (SELECT o.source_id FROM main.meta_source o WHERE o.code = m.code)
  FROM mac.meta_source m LEFT JOIN main.meta_source n ON n.source_id = m.source_id
`).raw().all() as [number, string, string | null, number | null][]) {
  if (!used.has(id)) continue;
  if (here !== null && here !== code) fail(`source ${id} is ${code} on the Mac but ${here} here`);
  if (here === null && elsewhere !== null) fail(`${code} is source ${id} on the Mac but ${elsewhere} here`);
}
const clash = c.prepare(`SELECT m.code FROM mac.meta_licence m JOIN main.meta_licence n ON n.licence_id = m.licence_id AND n.code <> m.code`).pluck().all();
if (clash.length) fail(`licence ids differ for ${clash.join(', ')}`);

const copy = (table: string, where: string) => {
  const cols = columns(c, table).join(', ');
  return c.prepare(`INSERT OR IGNORE INTO main.${table} (${cols}) SELECT ${cols} FROM mac.${table} WHERE ${where}`).run().changes;
};
/** Ids naming the same source on both machines; others (a geo layer imported here first) keep the NUC's rows. */
const SAME_SOURCE = `source_id IN (SELECT m.source_id FROM mac.meta_source m JOIN main.meta_source n ON n.source_id = m.source_id AND n.code = m.code)`;
// In this order: a policy needs its licence, a source its licence, a dataset its source.
const merged = c.transaction(() => ({
  licences: copy('meta_licence', `code NOT IN (SELECT code FROM main.meta_licence)`),
  policies: copy('meta_access_policy', '1'),
  sources: copy('meta_source', `code NOT IN (SELECT code FROM main.meta_source)`),
  datasets: copy('meta_dataset', SAME_SOURCE),
  statuses: c.prepare(`
    UPDATE main.meta_dataset AS n SET status = m.status FROM mac.meta_dataset m
    WHERE m.dataset_id = n.dataset_id AND m.source_id = n.source_id AND m.version = n.version AND n.status <> m.status
  `).run().changes,
  // Past both machines' versions, so caches keyed on them refetch.
  layers: c.prepare(`
    INSERT INTO main.meta_layer_version (layer, version, changed_at) SELECT layer, version + 1, ? FROM mac.meta_layer_version WHERE 1
    ON CONFLICT (layer) DO UPDATE SET version = max(meta_layer_version.version, excluded.version) + 1, changed_at = excluded.changed_at
  `).run(Date.now()).changes,
}))();
const nucCode = new Map(c.prepare(`SELECT source_id, code FROM main.meta_source`).raw().all() as [number, string][]);
c.exec('DETACH mac');
c.close();
console.log(`catalog: ${JSON.stringify(merged)}`);

h.exec(`ATTACH '${DIR}/history.db' AS old`);
const data = columns(h, 'ev_event').filter(col => !['event_id', 'kind_id', 'canonical_id', 'parent_id'].includes(col));
const revisable = data.filter(col => !['source_id', 'dataset_id', 'source_record_id', 'ingested_at'].includes(col));
const live = LIVE.map(code => [...nucCode].find(([, c2]) => c2 === code)?.[0]).filter((id): id is number => id !== undefined);
const result = h.transaction(() => live.map(id => {
  const added = h.prepare(`
    INSERT INTO main.ev_event (kind_id, ${data.join(', ')})
    SELECT nk.kind_id, ${data.map(col => `o.${col}`).join(', ')}
    FROM old.ev_event o JOIN old.ev_kind ok ON ok.kind_id = o.kind_id JOIN main.ev_kind nk ON nk.code = ok.code
    WHERE o.source_id = ? AND NOT EXISTS (SELECT 1 FROM main.ev_event m WHERE m.source_id = o.source_id AND m.source_record_id = o.source_record_id)
  `).run(id).changes;
  h.prepare(`UPDATE main.ev_event SET canonical_id = event_id WHERE source_id = ? AND canonical_id IS NULL`).run(id);
  const revised = h.prepare(`
    UPDATE main.ev_event AS m SET ${revisable.map(col => `${col} = o.${col}`).join(', ')}
    FROM old.ev_event o
    WHERE m.source_id = ? AND o.source_id = m.source_id AND o.source_record_id = m.source_record_id AND o.updated_at > m.updated_at
  `).run(id).changes;
  return { source: nucCode.get(id), added, revised };
}))();
h.exec('DETACH old');
const families = h.prepare(`
  SELECT DISTINCT k.family FROM ev_event e JOIN ev_kind k USING (kind_id) WHERE e.source_id IN (SELECT value FROM json_each(?))
`).pluck().all(JSON.stringify(live)) as string[];
h.close();

const w = openWriter(`${stage}/history.mac.db`, 'history');
new SqliteEventStore(w).rebuildTimeline(families);
const check = w.pragma('quick_check', { simple: true });
w.close();
if (check !== 'ok') fail(`quick_check says ${check}`);
console.log(`history: ${JSON.stringify(result)}, quick_check ok`);
