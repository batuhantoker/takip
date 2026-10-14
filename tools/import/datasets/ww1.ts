import { join } from 'node:path';
import { GeoPrec, type EventEntityRow } from '@takip/db';
import { type Ctx, importDataset, RAW, sourceId } from '../context';
import { readCsv } from '../csv';
import { type Stated, ymd } from '../dates';
import { anchor, EventBatch, validLonLat } from '../events';
import { normName } from '../names';
import { Resolver } from '../resolver';
import { enwikiTitle } from '../wiki';

const DIR = join(RAW, 'World War 1 Battles');
const FILE = join(DIR, 'WW1_Data.csv');
const AS_OF = '2025-03-19';
/** WAC's canonical World War I. */
const WWI = 'CNF-0001';

type Fix = { start?: string; end?: string; country?: string; note: string };

/** stage.manual_fix until that table exists. `country` anchors rows whose text names no place or party we know. */
const FIXES: Record<string, Fix> = {
  'https://en.wikipedia.org/wiki/Second_Battle_of_the_Aisne': { start: '4/16/1917', end: '5/9/1917', note: 'year 2024 → 1917 (source typo)' },
  'https://en.wikipedia.org/wiki/Battle_of_Albert_(1918)': { country: 'FRA', note: 'no location or belligerents in source; Albert, France' },
  'https://en.wikipedia.org/wiki/Battle_of_Struma': { country: 'GRC', note: 'no location or belligerents in source; Struma valley, Greek Macedonia' },
  'https://en.wikipedia.org/wiki/Battle_of_Segale': { country: 'ETH', note: 'location names no country; north of Addis Ababa' },
  'https://en.wikipedia.org/wiki/Dagestan_Campaign_(1918)#Battle_of_Tarkin_heights': { country: 'RUS', note: 'no belligerents in source; Dagestan, Russia' },
};

/**
 * Names the seed lacks or resolves to the wrong era, as aliases.csv rows (name, polity key, from, to); they belong in the seed.
 * Colonies and dominions map to the polity holding the territory today, until the seed has them.
 */
const ALIASES: [name: string, key: string, from?: string, to?: string][] = [
  ['German Empire', 'DEU'],
  ['Bavaria', 'DEU', '1871-01-18'],
  ['Kingdom of Bavaria', 'DEU', '1871-01-18'],
  ['Prussia', 'DEU', '1871-01-18'],
  ['British Empire', 'GBR'],
  ['United Kingdom of Great Britain and Ireland', 'GBR'],
  ['British India', 'IND'],
  ['British Raj', 'IND'],
  ['French Republic', 'FRA'],
  ['Kingdom of Italy', 'ITA'],
  ['Kingdom of Romania', 'ROU'],
  ['Kingdom of Greece', 'GRC'],
  ['Kingdom of Serbia', 'SRB'],
  ['Tsardom of Bulgaria', 'BGR'],
  ['Austro-Hungarian Empire', 'hist:AUH'],
  ['Russia', 'hist:RUE', undefined, '1917-11-07'],
  ['Russian Republic', 'hist:RUE'],
  ['Russian Provisional Government', 'hist:RUE'],
  ['Soviet Russia', 'RUS'],
  ['Ukrainian State', 'UKR'],
  ['Russian SFSR', 'RUS'],
  ['Congress Poland', 'POL'],
  ['Qajar Iran', 'IRN'],
  ['Qajar State', 'IRN'],
  ['Siam', 'THA'],
  ['Hejaz', 'SAU'],
  ['Nejd and Hasa', 'SAU'],
  ['Emirate of Nejd and Hasa', 'SAU'],
  ['Jabal Shammar', 'SAU'],
  ['Sultanate of Lahij', 'YEM'],
  ['Lahej Sultanate', 'YEM'],
  ['Haushabi Sultanate', 'YEM'],
  ['Aden Protectorate', 'YEM'],
  ['Newfoundland', 'CAN'],
  ['German East Africa', 'TZA'],
  ['German South West Africa', 'NAM'],
  ['German Southwest Africa', 'NAM'],
  ['German Kamerun', 'CMR'],
  ['Togoland', 'TGO'],
  ['German New Guinea', 'PNG'],
  ['Nyasaland', 'MWI'],
  ['British Nigeria', 'NGA'],
  ['Gold Coast', 'GHA'],
  ['French Dahomey', 'BEN'],
  ['Rhodesia', 'ZWE', undefined, '1965-11-11'],
  ['Southern Rhodesia', 'ZWE', undefined, '1965-11-11'],
  ['Portuguese East Africa', 'MOZ'],
  ['Portuguese Mozambique', 'MOZ'],
  ['Portuguese Angola', 'AGO'],
];

const day = (s: string | undefined) => (s ? Date.parse(`${s}T00:00:00Z`) : undefined);

/** Drops Wikipedia's [1], [a], [note 1] and [citation needed] markers. */
const unmark = (s: string | undefined) => (s ?? '').replace(/\[[^\]]*\]/g, '');

const lines = (s: string | undefined) => unmark(s).split('\n').map(l => l.trim()).filter(Boolean);
const clean = (s: string | undefined) => lines(s).join('\n') || null;

/** {{coord}} renders a decimal pair ("49.18444°N 4.54417°E") after the DMS one; DMS is the fallback. */
export function parseCoords(s: string): { lon: number; lat: number } | null {
  const d = s.match(/(\d+(?:\.\d+)?)°\s*([NS])\s+(\d+(?:\.\d+)?)°\s*([EW])/);
  if (d) return { lat: Number(d[1]) * (d[2] === 'S' ? -1 : 1), lon: Number(d[3]) * (d[4] === 'W' ? -1 : 1) };
  const m = s.match(/(\d+)°(?:(\d+)′)?(?:(\d+(?:\.\d+)?)″)?\s*([NS])\s+(\d+)°(?:(\d+)′)?(?:(\d+(?:\.\d+)?)″)?\s*([EW])/);
  if (!m) return null;
  const dms = (deg: string, min: string | undefined, sec: string | undefined, hemi: string) =>
    (Number(deg) + Number(min ?? 0) / 60 + Number(sec ?? 0) / 3600) * (hemi === 'S' || hemi === 'W' ? -1 : 1);
  return { lat: dms(m[1], m[2], m[3], m[4]), lon: dms(m[5], m[6], m[7], m[8]) };
}

/** casualties_dict_* and strength_dict_* are Python dict reprs of number lists: {'killed': [360.0], ...}. */
export function pyDict(s: string | undefined): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const m of (s ?? '').matchAll(/(['"])(.*?)\1\s*:\s*\[([^\]]*)\]/g))
    out[m[2]] = m[3].split(',').filter(v => v.trim() !== '').map(Number).filter(Number.isFinite);
  return out;
}

/** "Oct-14", "June, 1915", "June 1915 (…)": the _clean column turned these into day 1. */
export const monthOnly = (raw: string | undefined) => /^\p{L}+(?:-\d{2}|,?\s+\d{4})\b/u.test((raw ?? '').trim());

function mdy(clean: string, raw: string | undefined): Stated | null {
  const m = clean.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return monthOnly(raw) ? ymd(Number(m[3]), Number(m[1])) : ymd(Number(m[3]), Number(m[1]), Number(m[2]));
}

type Lookup = (name: string, t: number) => number | undefined;

/** Finds known names in text that runs several together ("German Empire Austria-Hungary"), longest span first. */
export function scanNames(text: string, t: number, lookup: Lookup) {
  const ids: number[] = [];
  const misses: string[] = [];
  for (const seg of text.split(/[,;()/\n]|\s{2,}/)) {
    const words = seg.trim().split(/\s+/).filter(Boolean);
    let rest: string[] = [];
    const flush = () => {
      const m = rest.join(' ').replace(/^(?:and|of|the)\s+|\s+(?:and|of|the)$/gi, '').trim();
      if (/\p{L}{2}/u.test(m)) misses.push(m);
      rest = [];
    };
    for (let i = 0; i < words.length; ) {
      let hit = 0;
      if (/^\p{Lu}/u.test(words[i]))
        for (let n = Math.min(8, words.length - i); n > 0 && !hit; n--) {
          const id = lookup(words.slice(i, i + n).join(' '), t);
          if (id === undefined) continue;
          flush();
          ids.push(id);
          hit = n;
        }
      if (hit) i += hit;
      else rest.push(words[i++]);
    }
    flush();
  }
  return { ids, misses };
}

/** Belligerent lines minus "Central Powers:"-style labels and (notes); names after "Supported by:" are supporters. */
export function belligerents(field: string | undefined) {
  const out: { text: string; supporter: boolean }[] = [];
  let supporter = false;
  const marked = unmark(field)
    .replace(/(?:Supported by|Supporters|Alleged)\s*:/g, '\n\u0001')
    .replace(/(?:Until|From) \d+ \p{L}+\s*:/gu, '\n')
    // Flag icons were dropped without a separator: "BrazilOther Allied navies".
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1\n$2');
  for (let line of marked.split('\n')) {
    if (line.startsWith('\u0001')) {
      supporter = true;
      line = line.slice(1);
    }
    const text = line.replace(/^[^:]*:/, '').replace(/\([^)]*\)/g, ' ').trim();
    if (text) out.push({ text, supporter });
  }
  return out;
}

export async function importWw1(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'ww1-wiki',
      version: AS_OF,
      asOf: AS_OF,
      files: [FILE],
      skipped: [{ file: join(DIR, 'WW1_DataEncoded.csv'), duplicateOf: FILE }],
      importerVersion: '3',
    },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;

      const keyId = (key: string) => {
        const id = r.key(key);
        if (id === undefined) throw new Error(`ww1: polity key ${key} is not in the seed`);
        return id;
      };
      const aliases = new Map<string, { id: number; lo: number; hi: number }[]>();
      for (const [name, key, from, to] of ALIASES) {
        const list = aliases.get(normName(name)) ?? [];
        list.push({ id: keyId(key), lo: day(from) ?? -Infinity, hi: day(to) ?? Infinity });
        aliases.set(normName(name), list);
      }
      const lookup: Lookup = (name, t) => aliases.get(normName(name))?.find(a => a.lo <= t && t < a.hi)?.id ?? r.byName(name, t, { politiesOnly: true });
      // "present-day X" names today's polity, not the one at the battle.
      const now = day(AS_OF)!;

      /** The first polity a place text names, preferring its "present-day …" part. */
      const placePolity = (place: string, t: number) => {
        const modern = place.match(/(?:present[- ]day|modern[- ]day|modern|today(?: in)?|now(?: in)?)\s+([^;)]*)/i);
        return (modern && scanNames(modern[1], now, lookup).ids[0]) || scanNames(place, t, lookup).ids[0];
      };

      const rows = await readCsv(FILE);
      const batch = new EventBatch(ctx, ds);
      const geo = { exact: 0, place: 0, belligerents: 0, fix: 0, none: 0 };
      const fixes: { url: string; note: string }[] = [];
      for (const b of rows) {
        rep.rows++;
        const url = b.URL.trim();
        const fix = FIXES[url];
        if (fix) fixes.push({ url, note: fix.note });
        const start = mdy(fix?.start ?? b.StartDate_clean, b.StartDate);
        if (!start) {
          rep.reject('bad StartDate_clean', `${url} ${b.StartDate_clean}`);
          continue;
        }
        const end = mdy(fix?.end ?? b.EndDate_clean, b.EndDate);
        const tRaw: Record<string, string> = {};
        if (fix?.start) tRaw.start = b.StartDate_clean;
        else if (monthOnly(b.StartDate)) tRaw.start = b.StartDate.trim();
        if (fix?.end) tRaw.end = b.EndDate_clean;
        else if (monthOnly(b.EndDate)) tRaw.end = b.EndDate.trim();
        if (monthOnly(b.StartDate) || monthOnly(b.EndDate)) rep.sentinel('month-only raw date → month precision');

        const entities: EventEntityRow[] = [];
        const seen = new Set<string>();
        for (const [field, role, side] of [[b.Belligerents_Left, 'side_a', 1], [b.Belligerents_Right, 'side_b', 2]] as const) {
          for (const line of belligerents(field)) {
            const { ids, misses } = scanNames(line.text, start.t, lookup);
            for (const m of misses) rep.miss(`belligerent:${m}`);
            const as = line.supporter ? 'supporter' : role;
            for (const id of ids) {
              const k = `${id}|${as}|${side}`;
              if (seen.has(k)) continue;
              seen.add(k);
              entities.push({ entityId: id, role: as, side });
            }
          }
        }

        const place = clean(b.Location.split(/\d+(?:\.\d+)?°/)[0]);
        const coords = parseCoords(b.Location);
        let at: { lon: number | null; lat: number | null; geoPrec: GeoPrec };
        const known = fix?.country ? keyId(fix.country) : place ? placePolity(place, start.t) : undefined;
        if (coords && validLonLat(coords.lon, coords.lat)) {
          at = { ...coords, geoPrec: GeoPrec.exact };
          geo.exact++;
        } else if (r.point(known)) {
          at = { ...r.point(known)!, geoPrec: GeoPrec.country };
          if (fix?.country) geo.fix++;
          else geo.place++;
        } else {
          at = anchor(r, null, null, GeoPrec.exact, entities.filter(e => e.role !== 'supporter').map(e => e.entityId));
          if (at.lon !== null) {
            at.geoPrec = GeoPrec.approximate;
            geo.belligerents++;
          } else geo.none++;
        }

        batch.add({
          kind: 'battle',
          sourceRecordId: url,
          title: clean(b.BattleName),
          tStart: start.t,
          tStartPrec: start.prec,
          tEnd: end?.t ?? null,
          tEndPrec: end?.prec ?? null,
          ...at,
          attrs: {
            location: place,
            outcome: clean(b.Outcome),
            belligerents: { left: lines(b.Belligerents_Left), right: lines(b.Belligerents_Right) },
            strength: { left: clean(b.Strength_Left), right: clean(b.Strength_Right) },
            casualties_text: { left: clean(b['Casualties and losses_Left']), right: clean(b['Casualties and losses_Right']) },
            casualties: { left: pyDict(b.casualties_dict_left), right: pyDict(b.casualties_dict_right) },
            strength_counts: { left: pyDict(b.strength_dict_left), right: pyDict(b.strength_dict_right) },
            ...(fix ? { fix: fix.note } : {}),
            ...(Object.keys(tRaw).length ? { t_raw: tRaw } : {}),
            ...(at.geoPrec === GeoPrec.approximate ? { placed_at: 'midpoint of the belligerents’ countries: the source gives no place' } : {}),
            wiki: enwikiTitle(url),
          },
          entities,
        });
      }
      const publish = batch.finish();

      const wwi = ctx.events.eventId(sourceId(ctx, 'wac1914'), WWI);
      if (wwi === undefined) rep.extra.part_of = `wac1914 ${WWI} not loaded; part_of links skipped (import wac1914 first)`;
      ctx.history.transaction(() => {
        for (const b of rows) {
          const url = b.URL.trim();
          const eventId = ctx.events.eventId(ds.sourceId, url);
          if (eventId === undefined) continue;
          const doc = ctx.docs.upsertDocument({
            kind: 'citation',
            sourceId: ds.sourceId,
            datasetId: ds.datasetId,
            sourceRecordId: url,
            url,
            title: clean(b.BattleName),
            lang: 'en',
            attrs: { publisher: 'Wikipedia' },
          });
          ctx.docs.link(doc, 'event', eventId, 'source_of');
          if (wwi !== undefined) ctx.events.relate(eventId, 'part_of', wwi, 1, ds.sourceId);
        }
      })();

      const titles = new Map<string, number>();
      for (const b of rows) titles.set(b.BattleName, (titles.get(b.BattleName) ?? 0) + 1);
      rep.extra.geo = geo;
      rep.extra.fixes = fixes;
      // Redirect URLs of one article; kept as separate events because the key is the URL.
      rep.extra.duplicate_titles = [...titles].filter(([, n]) => n > 1).map(([title, n]) => ({ title, n }));
      return publish;
    },
  );
}
