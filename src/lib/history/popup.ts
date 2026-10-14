import { Prec } from '@takip/core/time';
import { htmlEsc, pop, type PopRow, urlSafe } from '@/lib/map/popups/kit';
import { type ArticleSummary, articleRef, articleUrl, languageName, wikiRef } from './wiki';

/* Popups for the curated history layer (replay mode): wars, battles, claims, attacks, heritage. */

/** One calm categorical colour per family, from the design tokens; the History panel's toggles read these too. */
export const HISTORY_FAMILIES: Record<string, { color: string; label: string; magnitude?: string }> = {
  conflict: { color: '#E5534B', label: 'Conflict', magnitude: 'Deaths' },
  terror: { color: '#D98A4E', label: 'Attack', magnitude: 'Killed' },
  territorial: { color: '#9B8AFB', label: 'Territory' },
  heritage: { color: '#5B9CF5', label: 'Heritage' },
  hazard: { color: '#D8C26A', label: 'Natural hazards', magnitude: 'Magnitude' },
  politics: { color: '#D99AB4', label: 'Treaties and coups' },
  nuclear: { color: '#A9C46A', label: 'Nuclear explosions', magnitude: 'Yield (kt)' },
  disaster: { color: '#5BAE9A', label: 'Disasters', magnitude: 'Places hit' },
};
export const HISTORY_FALLBACK_COLOR = '#7F8B96';

const KINDS: Record<string, string> = {
  war: 'War',
  'war.interstate': 'Interstate war',
  'war.civil': 'Civil war',
  'war.world': 'World war',
  'war.independence': 'War of independence',
  'conflict.armed': 'Armed conflict',
  battle: 'Battle',
  'claim.territorial': 'Territorial claim',
  'change.territorial': 'Territorial change',
  'attack.terror': 'Terrorist attack',
  'status.in_danger': 'World Heritage in danger',
  'hazard.quake': 'Earthquake',
  'battle.siege': 'Siege',
  'hazard.tsunami': 'Tsunami',
  'hazard.volcano': 'Volcanic eruption',
  'politics.treaty': 'Treaty',
  'politics.coup': 'Coup',
  'nuclear.test': 'Nuclear test',
  'nuclear.combat': 'Nuclear attack',
  'disaster.flood': 'Flood',
  'disaster.storm': 'Storm',
  'disaster.temperature': 'Extreme temperature',
  'disaster.drought': 'Drought',
  'disaster.quake': 'Earthquake',
  'disaster.landslide': 'Landslide',
  'disaster.mass_movement': 'Landslide (dry)',
  'disaster.volcano': 'Volcanic activity',
};

const PLACEMENT: Record<number, string> = {
  3: 'Placed at the area, not an exact site.',
  4: 'Placed approximately by the source.',
  5: 'Placed at the country: the source names no closer place.',
};

/** An importer that placed the event itself says how in attrs.placed_at; a disaster's magnitude counts the places it hit. */
function placement(p: HistoryFeature, magnitude: number | null | undefined, d?: HistoryDetail | null) {
  if (typeof d?.attrs.placed_at === 'string') return `Placed at the ${d.attrs.placed_at}.`;
  return p.family === 'disaster' && (magnitude ?? 1) > 1 ? 'Placed at the middle of the places it hit.' : PLACEMENT[p.geoPrec];
}

/** Feature properties as the history route sends them; times are epoch seconds. */
export type HistoryFeature = {
  id: number;
  kind: string;
  family: string;
  title?: string | null;
  t0: number;
  t1: number;
  prec: number;
  ongoing: number;
  geoPrec: number;
  magnitude?: number | null;
};

export type HistoryDetail = HistoryFeature & {
  tStart: number;
  tEnd: number | null;
  endPrec: number | null;
  lon?: number | null;
  lat?: number | null;
  attrs: Record<string, unknown>;
  relations?: { rel: string; otherId: number; direction: 'in' | 'out'; confidence: number }[];
  source?: { code: string; name: string; attribution: string | null };
};

/** What the popup learns after the click; each part stays undefined until its request lands. */
export type HistoryExtras = {
  /** Details of the linked events shown (shownIds); null when they failed to load. */
  related?: HistoryDetail[] | null;
  wiki?: ArticleSummary | null;
  /** The summary is shown in full. */
  expanded?: boolean;
};

export const RELATED_SHOWN = 8;

/** The Wikipedia article the importer stored for this event, if it found one: an English title, or "fr:Titre". */
export const articleTitle = (attrs: Record<string, unknown> | undefined): string | null =>
  typeof attrs?.wiki === 'string' && attrs.wiki.trim() ? attrs.wiki : null;

const isWikipedia = (url: string) => /^https:\/\/en\.(m\.)?wikipedia\.org\/wiki\//.test(url);

/** Linked events by how: the wars a battle is part of, what a war includes, and GTD's related attacks (either way). */
export function linkedIds(d: HistoryDetail) {
  const ids = (rel: string, direction?: 'in' | 'out') =>
    [...new Set((d.relations ?? []).filter(r => r.rel === rel && (!direction || r.direction === direction)).map(r => r.otherId))];
  return { partOf: ids('part_of', 'out'), parts: ids('part_of', 'in'), related: ids('related') };
}

/** The linked events whose details the popup loads: the first RELATED_SHOWN of each kind. */
export function shownIds(d: HistoryDetail): number[] {
  const g = linkedIds(d);
  return [...new Set([g.partOf, g.parts, g.related].flatMap(ids => ids.slice(0, RELATED_SHOWN)))];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A time at its precision: "1910s", "1916", "Jul 1916", "1 Jul 1916"; years before 1 are BCE. */
export function formatAt(s: number, prec: number): string {
  const d = new Date(s * 1000);
  const y = d.getUTCFullYear();
  const year = y > 0 ? String(y) : `${1 - y} BCE`;
  if (prec === Prec.century) return y > 0 ? `${Math.floor((y - 1) / 100) + 1}th century` : year;
  if (prec === Prec.decade) return y > 0 ? `${Math.floor(y / 10) * 10}s` : year;
  if (prec <= Prec.year) return year;
  if (prec === Prec.month) return `${MONTHS[d.getUTCMonth()]} ${year}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${year}`;
}

/** GTD eventids are YYYYMMDD and a number within the day; a 00 month or day means the source did not know it. */
export function gtdIdDay(id: string): string | null {
  const m = id.trim().match(/^(\d{4})(\d{2})(\d{2})\d{4}$/);
  if (!m) return null;
  const [y, mo, d] = [m[1], Number(m[2]), Number(m[3])];
  if (!mo || mo > 12) return y;
  return d ? `${d} ${MONTHS[mo - 1]} ${y}` : `${MONTHS[mo - 1]} ${y}`;
}

/** "4 attacks on 11 Sep 2001", from GTD's own list of related eventids. */
export function gtdRelatedLine(related: unknown): string | null {
  if (typeof related !== 'string') return null;
  const ids = related.split(',').map(t => t.trim()).filter(t => /^\d{12}$/.test(t)).sort();
  if (ids.length < 2) return null;
  const days = [...new Set(ids.map(gtdIdDay).filter((d): d is string => !!d))];
  const span = days.length === 1 ? `on ${days[0]}` : `from ${days[0]} to ${days[days.length - 1]}`;
  return `${ids.length} attacks ${span}`;
}

function when(p: HistoryFeature, d?: HistoryDetail | null): string {
  const start = formatAt(d?.tStart ?? p.t0, p.prec);
  if (p.ongoing) return `since ${start}`;
  if (!d || d.tEnd === null) return start;
  const end = formatAt(d.tEnd, d.endPrec ?? p.prec);
  return end === start ? start : `${start} – ${end}`;
}

const SKIP = new Set(['url', 'wiki', 'place', 'placed_at', 'net', 'ids', 'status', 'sig', 't_raw', 'crit', 'dyads', 'eventid', 'alt_names', 'phase', 'specificity', 'vicinity', 'doubtterr', 'multiple', 'added_by_compiler']);

/** The attrs a reader can use: scalars and lists of strings, plus belligerents as "a vs b". */
function facts(attrs: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (SKIP.has(k) || v === null || v === '' || v === false) continue;
    let text: string | null = null;
    if (typeof v === 'string' || typeof v === 'number' || v === true) text = v === true ? 'yes' : String(v);
    else if (Array.isArray(v) && v.every(x => typeof x === 'string')) text = v.join(', ');
    else if (k === 'belligerents' && typeof v === 'object') {
      const b = v as { left?: string[]; right?: string[] };
      text = `${(b.left ?? []).join(', ')} vs ${(b.right ?? []).join(', ')}`;
    }
    if (!text) continue;
    const label = k.replace(/_/g, ' ');
    out.push([label.charAt(0).toUpperCase() + label.slice(1), text.length > 160 ? `${text.slice(0, 157)}…` : text]);
    if (out.length === 6) break;
  }
  return out;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() && v !== 'Unknown' ? v.trim() : null);
const count = (n: number) => Math.round(n).toLocaleString('en-US');

/** GTD's success: the attack took place (the bomb went off, the plane was taken), whatever it was meant to achieve. */
const GTD_OUTCOME: Record<number, string> = { 1: 'Carried out', 0: 'Failed or foiled' };

/** A GTD row in words; its coded columns read as raw numbers otherwise. */
function attackRows(a: Record<string, unknown>): PopRow[] {
  const list = <T>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].join(', ');
  const where = [text(a.city), text(a.provstate), text(a.region)].filter((x, i, xs): x is string => !!x && xs.indexOf(x) === i);
  const attack = list<string>(a.attack);
  const claimed = a.claimed === 1 ? ['Yes', ...list<string>(a.claimmode).map(m => m.toLowerCase())].join(', ') : a.claimed === 0 ? 'No' : null;
  return [
    { label: 'Wounded', value: typeof a.nwound === 'number' ? count(a.nwound) : null, mono: true },
    { label: 'Where', value: where.join(', ') },
    { label: 'Attack', value: attack.length > 1 ? attack.join(', ') : null },
    { label: 'Target', value: uniq(list<{ type?: string }>(a.targets).map(t => text(t.type))) },
    // GTD spells some types out: "Vehicle (not to include vehicle-borne explosives, …)".
    { label: 'Weapon', value: uniq(list<{ type?: string }>(a.weapons).map(w => text(w.type)?.replace(/\s*\(.*\)$/, '') ?? null)) },
    { label: 'Outcome', value: typeof a.success === 'number' ? GTD_OUTCOME[a.success] : null },
    { label: 'Suicide attack', value: a.suicide === 1 ? 'Yes' : null },
    { label: 'Claimed', value: claimed },
  ];
}

const TEASER = 220;

/** GTD summaries open with the date ("09/11/2001: "), which When already shows. */
function summaryHtml(summary: string, expanded: boolean): string {
  const s = summary.replace(/^[\d/]+:\s*/, '');
  const para = (t: string) => `<p class="tk-pop-text">${htmlEsc(t)}</p>`;
  if (s.length <= TEASER + 40) return para(s);
  if (expanded) return `${para(s)}<button type="button" class="tk-pop-more" data-history-more>Show less</button>`;
  const cut = s.slice(0, TEASER).replace(/\s+\S*$/, '');
  return `${para(`${cut}…`)}<button type="button" class="tk-pop-more" data-history-more>Read more</button>`;
}

/** The article in its other Wikipedias, by language name; picking one reloads the summary in it. */
function languageSelect(w: ArticleSummary): string {
  if (!w.languages?.length) return '';
  const options = [{ ref: w.ref, lang: w.lang }, ...w.languages.map(l => ({ ref: wikiRef(l.lang, l.title), lang: l.lang }))]
    .map(o => ({ ...o, name: languageName(o.lang) }))
    // Small wikis the browser has no name for ("arz") go last.
    .sort((a, b) => Number(a.name === a.lang) - Number(b.name === b.lang) || a.name.localeCompare(b.name));
  const list = options.map(o => `<option value="${htmlEsc(o.ref)}"${o.lang === w.lang ? ' selected' : ''}>${htmlEsc(o.name)}</option>`).join('');
  return `<span class="tk-pop-lang"><select data-history-lang aria-label="Article language">${list}</select></span>`;
}

function wikiHtml(w: ArticleSummary): string {
  const img = w.image ? `<img class="tk-pop-media tk-pop-photo" src="${urlSafe(w.image.src)}" alt="" />` : '';
  return `${img}<div class="tk-pop-wiki">
    <div class="tk-pop-item-title">${htmlEsc(w.title)}</div>
    ${w.description ? `<div class="tk-pop-list-meta">${htmlEsc(w.description)}</div>` : ''}
    ${languageSelect(w)}
  </div>`;
}

function eventRow(r: HistoryDetail): string {
  const fam = HISTORY_FAMILIES[r.family];
  const mag = typeof r.magnitude === 'number' && fam?.magnitude
    ? fam.magnitude === 'Killed' ? `${count(r.magnitude)} killed` : `${fam.magnitude} ${r.family === 'hazard' ? r.magnitude.toFixed(1) : count(r.magnitude)}`
    : null;
  const meta = [formatAt(r.tStart, r.prec), mag].filter(Boolean).join(' · ');
  return `<button type="button" class="tk-pop-route tk-pop-related" data-history-event="${r.id}">
    <span class="tk-pop-route-name">${htmlEsc(r.title ?? KINDS[r.kind] ?? r.kind)}</span>
    <span class="tk-pop-list-meta">${htmlEsc(meta)}</span>
  </button>`;
}

/** One kind of linked event as rows by date, or a line while they load; `line` stands in when none load. */
function linkedSection(label: string, ids: number[], x: HistoryExtras, line: string | null = null): string {
  if (!ids.length && !line) return '';
  const head = `<div class="tk-pop-label">${label}${ids.length > 1 ? ` · ${count(ids.length)}` : ''}</div>`;
  const rows = (x.related ?? []).filter(r => ids.includes(r.id));
  if (!rows.length) {
    const status = ids.length && x.related === undefined ? 'Loading…' : line;
    return status ? `${head}<div class="tk-pop-note">${htmlEsc(status)}</div>` : '';
  }
  const list = rows.sort((a, b) => a.tStart - b.tStart || a.id - b.id).map(eventRow).join('');
  const more = ids.length - rows.length;
  return `${head}<div class="tk-pop-related-list">${list}</div>${more > 0 ? `<div class="tk-pop-note">and ${count(more)} more</div>` : ''}`;
}

function linkedHtml(p: HistoryFeature, d: HistoryDetail, x: HistoryExtras): string {
  const g = linkedIds(d);
  return linkedSection('Part of', g.partOf, x)
    + linkedSection('Includes', g.parts, x)
    + linkedSection(`Related ${p.family === 'terror' ? 'attacks' : 'events'}`, g.related, x, gtdRelatedLine(d.attrs.related));
}

export function historyPopupHtml(p: HistoryFeature, d?: HistoryDetail | null, x: HistoryExtras = {}): string {
  const family = HISTORY_FAMILIES[p.family];
  const attack = p.kind === 'attack.terror';
  const rows: PopRow[] = [
    { label: 'When', value: when(p, d) },
    { label: 'Kind', value: KINDS[p.kind] ?? p.kind },
  ];
  // Map features drop null properties, so a missing magnitude arrives as undefined.
  const magnitude = d?.magnitude ?? p.magnitude;
  if (typeof magnitude === 'number' && family?.magnitude) {
    rows.push({ label: family.magnitude, value: p.family === 'hazard' ? magnitude.toFixed(1) : count(magnitude), mono: true });
  }
  if (d) rows.push(...(attack ? attackRows(d.attrs) : facts(d.attrs).map(([label, value]) => ({ label, value }))));
  const summary = (attack ? text(d?.attrs.summary) : null) ?? (x.wiki?.extract.trim() || null);
  // Facts first: the picture and summary would push the death toll below the popup's fold.
  const story = [x.wiki ? wikiHtml(x.wiki) : '', summary ? summaryHtml(summary, !!x.expanded) : ''].join('');
  const url = typeof d?.attrs.url === 'string' && /^https?:\/\//.test(d.attrs.url) ? d.attrs.url : null;
  const stored = articleTitle(d?.attrs);
  // The stored title links at once; the summary, when it lands, carries the canonical URL.
  const article = x.wiki?.url ?? (stored ? articleUrl(stored) : url && isWikipedia(url) ? url : null);
  const lang = x.wiki?.lang ?? (stored ? articleRef(stored).lang : 'en');
  const wikipedia = lang === 'en' ? 'Wikipedia' : `${languageName(lang)} Wikipedia`;
  const link = url && !isWikipedia(url) ? url : null;
  const source = d?.source ? (d.source.attribution ?? d.source.name) : d === undefined ? 'Loading details…' : null;
  return pop({
    kicker: family?.label ?? 'Event',
    dot: family?.color ?? HISTORY_FALLBACK_COLOR,
    title: p.title ?? KINDS[p.kind] ?? p.kind,
    rows,
    foot: `${story ? `<div class="tk-pop-body">${story}</div>` : ''}${d ? linkedHtml(p, d, x) : ''}` || undefined,
    note: [placement(p, magnitude, d), source, x.wiki ? `· From ${wikipedia}, CC BY-SA` : null].filter(Boolean).join(' ') || undefined,
    links: [article ? { href: article, label: wikipedia } : null, link ? { href: link, label: 'Source page' } : null],
    wide: attack,
  });
}
