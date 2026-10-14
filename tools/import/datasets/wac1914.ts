import { join } from 'node:path';
import { GeoPrec, type EventEntityRow } from '@takip/db';
import { type Ctx, importDataset, RAW } from '../context';
import { num, readCsv, text } from '../csv';
import { isoDate } from '../dates';
import { anchor, EventBatch } from '../events';
import { normName } from '../names';
import { Resolver } from '../resolver';
import { readWikiTable, wikiTablePath } from '../wiki';

const DIR = join(RAW, 'Global Wars & Armed Conflicts, 1914–2026');
const f = (name: string) => join(DIR, name);
const AS_OF = '2026-07-07';

/** The 33 free-text conflict_type values, by their leading words. */
export function wacKind(type: string) {
  const t = type.toLowerCase();
  if (t.startsWith('global')) return 'war.world';
  if (t.startsWith('war of independence')) return 'war.independence';
  if (t.startsWith('interstate')) return 'war.interstate';
  if (t.startsWith('civil war') || t.startsWith('genocide')) return 'war.civil';
  return 'conflict.armed';
}

/** -1 means "not reported" here; the matching *_reported flag goes to attrs. */
const amount = (v: string | undefined) => {
  const n = num(v);
  return n === null || n < 0 ? null : n;
};

export async function importWac1914(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'wac1914',
      version: AS_OF,
      asOf: AS_OF,
      files: [...['conflicts.csv', 'conflict_participants.csv', 'countries_reference.csv', 'sources.csv', 'data_dictionary.csv'].map(f), wikiTablePath('wac1914')],
      importerVersion: '2',
    },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;
      const wiki = await readWikiTable('wac1914');

      const countries = await readCsv(f('countries_reference.csv'));
      ctx.catalog.transaction(() => {
        for (const c of countries) {
          const id = r.resolve('wac', c.country_id, 0) ?? r.resolve('iso3', c.country_id, 0) ?? r.byName(c.country_name, 0, { politiesOnly: true });
          if (id === undefined) rep.miss(`wac:${c.country_id} ${c.country_name}`);
          else r.remember('wac', c.country_id, id, ds.sourceId);
        }
      })();

      const participants = new Map<string, { id: string; name: string }[]>();
      for (const p of await readCsv(f('conflict_participants.csv'))) {
        const list = participants.get(p.conflict_id) ?? [];
        list.push({ id: p.country_id, name: p.country_name });
        participants.set(p.conflict_id, list);
      }

      const sources = new Map<string, number>();
      for (const s of await readCsv(f('sources.csv'))) {
        sources.set(
          s.source_id,
          ctx.docs.upsertDocument({
            kind: 'citation',
            sourceId: ds.sourceId,
            datasetId: ds.datasetId,
            sourceRecordId: s.source_id,
            url: text(s.url),
            title: text(s.title),
            attrs: { publisher: text(s.publisher), type: text(s.source_type) },
          }),
        );
      }

      const batch = new EventBatch(ctx, ds);
      const conflicts = await readCsv(f('conflicts.csv'));
      for (const c of conflicts) {
        rep.rows++;
        const start = isoDate(c.start_date);
        if (!start) {
          rep.reject('bad start_date', `${c.conflict_id} ${c.start_date}`);
          continue;
        }
        const ongoing = c.end_date === 'ONGOING';
        const end = ongoing ? null : isoDate(c.end_date);
        if (ongoing) rep.sentinel('end_date ONGOING → ongoing');

        const sideA = normName(c.side_a ?? '');
        const sideB = normName(c.side_b ?? '');
        const entities: EventEntityRow[] = [];
        for (const p of participants.get(c.conflict_id) ?? []) {
          const id = r.resolve('wac', p.id, start.t) ?? r.resolve('iso3', p.id, start.t);
          if (id === undefined) {
            rep.miss(`wac:${p.id}`);
            continue;
          }
          const n = normName(p.name);
          const role = n && sideA.includes(n) ? 'side_a' : n && sideB.includes(n) ? 'side_b' : 'participant';
          entities.push({ entityId: id, role, side: role === 'side_a' ? 1 : role === 'side_b' ? 2 : 0 });
        }

        const at = anchor(r, num(c.longitude), num(c.latitude), GeoPrec.approximate, entities.map(e => e.entityId));
        const magnitude = amount(c.total_casualties_estimate);
        if (num(c.total_casualties_estimate) === -1) rep.sentinel('total_casualties_estimate -1 → null');
        batch.add({
          kind: wacKind(c.conflict_type),
          sourceRecordId: c.conflict_id,
          title: text(c.conflict_name),
          tStart: start.t,
          tStartPrec: start.prec,
          tEnd: end?.t ?? null,
          tEndPrec: end?.prec ?? null,
          ongoing,
          ...at,
          magnitude,
          confidence: c.data_confidence === 'High' ? 1 : c.data_confidence === 'Medium' ? 0.8 : 0.6,
          attrs: {
            alt_names: c.alternative_names && c.alternative_names !== 'None documented' ? c.alternative_names.split('|') : [],
            type: text(c.conflict_type),
            status: text(c.status),
            region: text(c.region),
            cities: c.cities ? c.cities.split('|').map(s => s.trim()) : [],
            side_a: text(c.side_a),
            side_b: text(c.side_b),
            alliances: c.military_alliances_raw ? c.military_alliances_raw.split('|') : [],
            cause: text(c.cause_of_conflict),
            outcome: text(c.outcome),
            casualties: {
              military: [amount(c.military_casualties_low), amount(c.military_casualties_high)],
              civilian: [amount(c.civilian_casualties_low), amount(c.civilian_casualties_high)],
              total: [amount(c.total_casualties_low), amount(c.total_casualties_high)],
              basis: text(c.casualty_estimate_basis),
            },
            refugees: amount(c.refugees),
            refugees_reported: c.refugees_reported === 'True',
            idps: amount(c.internally_displaced_persons),
            idps_reported: c.idps_reported === 'True',
            economic_damage_usd: [amount(c.economic_damage_usd_low), amount(c.economic_damage_usd_high)],
            economic_damage_reported: c.economic_damage_reported === 'True',
            economic_damage_note: text(c.economic_damage_note),
            peace_agreement: text(c.peace_agreement),
            ceasefire: c.ceasefire_date_reported === 'True' ? text(c.ceasefire_date) : null,
            duration_provisional: c.duration_is_provisional === 'True',
            last_verified: text(c.last_verified_date),
            ...(ongoing ? { t_raw: { end: c.end_date } } : {}),
            wiki: wiki.get(c.conflict_id) ?? null,
          },
          entities,
        });
      }
      const publish = batch.finish();

      ctx.history.transaction(() => {
        for (const c of conflicts) {
          const eventId = ctx.events.eventId(ds.sourceId, c.conflict_id);
          if (eventId === undefined) continue;
          for (const s of (c.source_ids ?? '').split('|')) {
            const doc = sources.get(s.trim());
            if (doc !== undefined) ctx.docs.link(doc, 'event', eventId, 'source_of');
          }
        }
      })();

      rep.extra.dictionary = await readCsv(f('data_dictionary.csv'));
      return publish;
    },
  );
}
