import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { readCsv } from '../csv';
import { isoDate } from '../dates';
import { EventBatch, resolveCanonical } from '../events';
import { PAX_FILE } from '../fetch-politics';
import { Resolver } from '../resolver';
import { Capitals, CAPITALS, capitalPlacedAt } from './capitals';

const FILE = join(RAW_MORE, 'pax', PAX_FILE);
const VERSION = '10';
const AS_OF = '2026-07-20';
const DAY = 86_400_000;

/** Codebook v10 labels. Only these few of the 279 columns are kept: the terms bar re-using the database wholesale. */
const STAGE: Record<string, string> = {
  Pre: 'pre-negotiation', SubPar: 'framework, partial', SubComp: 'framework, comprehensive', Imp: 'implementation or renegotiation',
  Cea: 'ceasefire', Ren: 'renewal', Oth: 'other',
};
const LEVEL: Record<string, string> = { Inter: 'interstate', InterIntra: 'interstate and intrastate', Intra: 'intrastate', IntraLocal: 'local' };

const MAX_TITLE = 200;

/** One agreement's name: the English part when the source appends a translation ("…ProcessSpanish: Acuerdo…"). */
export function agreementTitle(s: string) {
  const english = s.split(/(?<=\S)(?:Spanish|French|Arabic|Russian|Portuguese):\s/)[0].replace(/\s+/g, ' ').trim();
  return english.length <= MAX_TITLE ? english : `${english.slice(0, MAX_TITLE).replace(/\s+\S*$/, '')}…`;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Words every agreement's name shares; what is left names the place or parties ("Bangsamoro", "Chittagong", "Jordan"). */
const STOP = new Set(`
  agreement agreements accord accords acuerdo acuerdos treaty treaties traite tratado peace paix protocol protocole protocolo
  declaration declaracion convention convenio pact pacto statement joint communique memorandum understanding government governments
  gobierno gouvernement republic republica republique between entre national nacional nationale federal federation democratic
  democratica democratique people peoples popular state states united nations security council resolution general framework
  comprehensive final political politico politique settlement conflict cessation hostilities ceasefire cease fire implementation
  principles relations cooperation friendship concerning regarding respect establishment establishing about with from that this
  their other parties party signed sides side front frente movement movimiento mouvement liberation army armed forces force union
  kingdom islamic transitional interim provisional process proceso processus talks conference meeting session round first second
  third plan document terms annex additional amendment agreed minutes letter exchange notes permanent lasting firm stable durable
  sustainable reconciliation dialogue dialogo commission committee comision group grupo representatives representative president
  presidente minister ministers delegation delegations mutual reciprocal border territory region regional area zone humanitarian
  assistance support related towards toward under within without against into upon also part parts ending establish modalities
  arrangement arrangements measures verification timetable calendar para sobre como pour avec dans sous concluded deed
`.split(/\s+/).filter(Boolean));

export const distinctive = (title: string) => new Set(fold(title).split(/[^\p{L}]+/u).filter(w => w.length >= 4 && !STOP.has(w)));
const words = (title: string) => fold(title).split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ');

export type PaxAgreement = { id: string; t: number; title: string };
export type WikidataTreaty = { id: number; title: string; t: number; prec: Prec };

/**
 * Pairs a day-dated Wikidata treaty with the agreement signed within a day of it whose name shares the most
 * distinctive words, or that it names in full ("Comprehensive Peace Agreement"); a tie is left unlinked.
 */
export function matchTreaties(pax: PaxAgreement[], wd: WikidataTreaty[]) {
  const pairs: [paxId: string, wdId: number][] = [];
  let ambiguous = 0;
  const byDay = new Map<number, PaxAgreement[]>();
  for (const p of pax) {
    const day = Math.floor(p.t / DAY);
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  for (const w of wd) {
    if (w.prec < Prec.day) continue;
    const day = Math.floor(w.t / DAY);
    const near = [day - 1, day, day + 1].flatMap(d => byDay.get(d) ?? []);
    const mine = distinctive(w.title);
    const full = words(w.title);
    const scored = near.map(p => {
      const theirs = words(p.title);
      const whole = theirs === full || (full.split(' ').length >= 3 && ` ${theirs} `.includes(` ${full} `));
      return { p, score: whole ? 100 : [...distinctive(p.title)].filter(x => mine.has(x)).length };
    }).filter(s => s.score > 0);
    const top = Math.max(0, ...scored.map(s => s.score));
    const best = scored.filter(s => s.score === top);
    if (best.length === 1) pairs.push([best[0].p.id, w.id]);
    else if (best.length > 1) ambiguous++;
  }
  return { pairs, ambiguous };
}

/*
 * PA-X Peace Agreements Database v10, University of Edinburgh (CC BY-NC-SA 4.0 and PA-X terms of use; seed/index.ts).
 * No agreement has a place: each sits at the middle of the UCDP conflict it addresses, as ucdp-brd placed it, else
 * at the first country's capital.
 */
export async function importPax(ctx: Ctx) {
  await importDataset(ctx, { source: 'pax', version: VERSION, asOf: AS_OF, files: [FILE, CAPITALS], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const capitals = await Capitals.read(ctx);
    const ucdp = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = 'ucdp-brd'`).pluck().get() as number | undefined;
    const conflict = ctx.history.prepare(`
      SELECT coalesce(canonical_id, event_id) AS id, title, lon, lat FROM ev_event
      WHERE source_id = ? AND source_record_id = ? AND retracted_at IS NULL AND lon IS NOT NULL
    `);
    if (ucdp === undefined) rep.extra.ucdp = 'ucdp-brd is not loaded: every agreement went to a capital; re-run pax after it';
    const batch = new EventBatch(ctx, ds);
    const related: [paxId: string, eventId: number][] = [];
    const agreements: PaxAgreement[] = [];
    for (const row of await readCsv(FILE)) {
      rep.rows++;
      const at = isoDate(row.Dat);
      if (!at || at.prec !== Prec.day) {
        rep.reject('no full date', `${row.AgtId} ${row.Dat}`);
        continue;
      }
      const ucdpId = /^\d+$/.test(row.UcdpCon.trim()) ? row.UcdpCon.trim() : null;
      const c = ucdp !== undefined && ucdpId ? (conflict.get(ucdp, ucdpId) as { id: number; title: string; lon: number; lat: number } | undefined) : undefined;
      const capital = c ? undefined : capitals.at(r.resolve('iso3', row.Loc1ISO.trim(), at.t), at.t);
      if (!c && !capital) {
        rep.reject(row.Loc1ISO.trim() ? 'no conflict point or capital' : 'no conflict point or country', `${row.AgtId} ${row.Con}`);
        continue;
      }
      if (!c) rep.sentinel(ucdpId ? 'UCDP conflict not in ucdp-brd → capital' : 'no UCDP conflict → capital');
      const title = agreementTitle(row.Agt);
      batch.add({
        kind: 'politics.peace_agreement',
        sourceRecordId: row.AgtId,
        title,
        tStart: at.t,
        tStartPrec: Prec.day,
        lon: c ? c.lon : capital!.lon,
        lat: c ? c.lat : capital!.lat,
        geoPrec: c ? GeoPrec.area : GeoPrec.country,
        attrs: {
          process: row.PPName.trim() || null,
          stage: STAGE[row.Stage] ?? row.Stage,
          level: LEVEL[row.Agtp] ?? row.Agtp,
          status: row.Status.trim() || null,
          conflict: row.Con.trim() || null,
          placed_at: c ? `middle of the conflict it addresses (${c.title}, UCDP)` : capitalPlacedAt(capital!),
          ids: { pax: row.AgtId, ucdp: ucdpId, cow_war: /^\d+$/.test(row.CowWar.trim()) ? row.CowWar.trim() : null },
          url: `https://www.peaceagreements.org/view/${row.AgtId}/`,
        },
      });
      if (c) related.push([row.AgtId, c.id]);
      agreements.push({ id: row.AgtId, t: at.t, title });
    }
    const publish = batch.finish();
    rep.extra.links = link(ctx, ds.sourceId, related, agreements, rep);
    return publish;
  });
}

/** related to each agreement's conflict, and same_as to the Wikidata treaty it repeats (Wikidata's stays canonical). */
function link(ctx: Ctx, paxSource: number, related: [string, number][], agreements: PaxAgreement[], rep: Reporter) {
  ctx.events.clearRelations(paxSource);
  const wdSource = ctx.catalog.prepare(`SELECT source_id FROM meta_source WHERE code = 'wikidata-politics'`).pluck().get() as number | undefined;
  const wd = wdSource === undefined ? [] : (ctx.history.prepare(`
    SELECT e.event_id AS id, e.title, e.t_start AS t, e.t_start_prec AS prec FROM ev_event e JOIN ev_kind k USING (kind_id)
    WHERE e.source_id = ? AND k.code = 'politics.treaty' AND e.retracted_at IS NULL AND e.t_start >= ?
  `).all(wdSource, Date.UTC(1989, 11, 30)) as WikidataTreaty[]);
  const { pairs, ambiguous } = matchTreaties(agreements, wd);
  ctx.history.transaction(() => {
    for (const [paxId, conflictId] of related) ctx.events.relate(ctx.events.eventId(paxSource, paxId)!, 'related', conflictId, 1, paxSource);
    for (const [paxId, wdId] of pairs) ctx.events.relate(ctx.events.eventId(paxSource, paxId)!, 'same_as', wdId, 1, paxSource);
  })();
  for (const [paxId, wdId] of pairs.slice(0, 5)) rep.sentinel(`same_as sample: ${paxId} → ${wd.find(w => w.id === wdId)?.title}`);
  const canonical = resolveCanonical(ctx);
  ctx.events.rebuildTimeline(['politics']);
  return { related: related.length, wikidata_treaties: wd.length, same_as: pairs.length, ambiguous, canonical_updated: canonical, ...(wdSource === undefined && { wikidata: 'not loaded' }) };
}
