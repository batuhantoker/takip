import type { Db } from '@takip/db';

/* Events TAKIP already has, by the Wikidata item and Wikipedia article they carry, to link a bullet to instead of adding it. */

export type Known = {
  id: number;
  canonical: number;
  source: number;
  kind: string;
  tLo: number;
  tHi: number;
  lon: number | null;
  lat: number | null;
  geoPrec: number;
  title: string | null;
};

/** "fr:Titre" → [fr, Titre]; an English title as is. */
export function splitRef(ref: string): [lang: string, title: string] {
  const m = ref.match(/^([a-z]{2,3}(?:-[a-z]+)?):(.+)$/);
  return m ? [m[1], m[2]] : ['en', ref];
}

export class KnownEvents {
  readonly byQid = new Map<number, Known[]>();
  readonly byWiki = new Map<string, Known[]>();

  /** Every live event with an article or item, leaving out `skipSources` (the run's own, whose rows are being rewritten). */
  constructor(db: Db, skipSources: readonly number[] = []) {
    const rows = db.prepare(`
      SELECT e.event_id AS id, coalesce(e.canonical_id, e.event_id) AS canonical, e.source_id AS source, k.code AS kind, e.t_lo AS tLo, e.t_hi AS tHi,
             e.lon, e.lat, e.geo_prec AS geoPrec, e.title, json_extract(e.attrs, '$.wiki') AS wiki, json_extract(e.attrs, '$.ids.wikidata') AS qid
      FROM ev_event e JOIN ev_kind k USING (kind_id)
      WHERE e.retracted_at IS NULL AND (json_extract(e.attrs, '$.wiki') IS NOT NULL OR json_extract(e.attrs, '$.ids.wikidata') IS NOT NULL)
    `).all() as (Known & { wiki: string | null; qid: string | null })[];
    const skip = new Set(skipSources);
    for (const { wiki, qid, ...k } of rows) {
      // A heritage site's danger listing or a territorial claim or change carries the site's or the land's article.
      if (skip.has(k.source) || /^(?:status|claim|change)\./.test(k.kind)) continue;
      const q = qid?.match(/^Q(\d+)$/);
      if (q) push(this.byQid, Number(q[1]), k);
      if (typeof wiki === 'string' && wiki) {
        const [lang, title] = splitRef(wiki);
        push(this.byWiki, `${lang}:${title}`, k);
      }
    }
  }

  /** Events that carry this item or this article. */
  find(qid: number | null, lang: string, title: string): Known[] {
    const out = new Map<number, Known>();
    for (const k of (qid !== null ? this.byQid.get(qid) : undefined) ?? []) out.set(k.id, k);
    for (const k of this.byWiki.get(`${lang}:${title}`) ?? []) out.set(k.id, k);
    return [...out.values()];
  }
}

function push<K>(m: Map<K, Known[]>, k: K, v: Known) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}
