import { opensWithBreak } from '@takip/core/headline';
import { Prec } from '@takip/core/time';
import { activeIntl, activeLocale, t } from '@/lib/core/i18n/active';
import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, msg, type Vars } from '@/lib/core/i18n/translator';
import { htmlEsc, pop, type PopRow, urlSafe } from '@/lib/map/popups/kit';
import { languageName } from '@/lib/core/wikipedia/language';
import { articleRef, articleUrl } from '@/lib/core/wikipedia/refs';
import { localePath } from '@/lib/platform/site/locale-path';
import type { ArticleSummary } from './wiki';

/* Popups for the curated history layer (replay mode): wars, battles, claims, attacks, heritage. */

/** One calm categorical colour per family, from the design tokens; the History panel's toggles read these too. */
export const HISTORY_FAMILIES: Record<string, { color: string; label: string; magnitude?: string }> = {
  conflict: { color: '#E5534B', label: msg('Conflict'), magnitude: msg('Deaths') },
  terror: { color: '#D98A4E', label: msg('Attack'), magnitude: msg('Killed') },
  territorial: { color: '#9B8AFB', label: msg('Territory') },
  heritage: { color: '#5B9CF5', label: msg('Heritage') },
  hazard: { color: '#D8C26A', label: msg('Natural hazards'), magnitude: msg('Magnitude') },
  politics: { color: '#D99AB4', label: msg('Politics'), magnitude: msg('Deaths') },
  nuclear: { color: '#A9C46A', label: msg('Nuclear explosions'), magnitude: msg('Yield (kt)') },
  disaster: { color: '#5BAE9A', label: msg('Disasters'), magnitude: msg('Places hit') },
  // MAP_INK.teal, the categorical tone no other family uses.
  crime: { color: '#5FB3C4', label: msg('Crime'), magnitude: msg('Killed') },
  // MAP_INK green and amber: the last categorical tones no family uses.
  space: { color: '#46B97F', label: msg('Rocket launches') },
  missile: { color: '#E9A23B', label: msg('Missile tests') },
  // MAP_INK.slate, the last categorical tone; HISTORY_FALLBACK_COLOR shares it but no imported kind falls back.
  slavery: { color: '#7F8B96', label: msg('Slave trade'), magnitude: msg('People embarked') },
  // PLACEHOLDER colour (MAP_INK.ink2): Wikipedia year-page events of no other family; the lead picks a tone.
  events: { color: '#A4AAB2', label: msg('Events') },
};
export const HISTORY_FALLBACK_COLOR = '#7F8B96';

export const KINDS: Record<string, string> = {
  war: msg('War'),
  'war.interstate': msg('Interstate war'),
  'war.civil': msg('Civil war'),
  'war.world': msg('World war'),
  'war.independence': msg('War of independence'),
  'conflict.armed': msg('Armed conflict'),
  'conflict.rebellion': msg('Rebellion'),
  'conflict.massacre': msg('Massacre'),
  'conflict.genocide': msg('Genocide'),
  'conflict.pogrom': msg('Pogrom'),
  'conflict.expulsion': msg('Expulsion or deportation'),
  battle: msg('Battle'),
  'claim.territorial': msg('Territorial claim'),
  'change.territorial': msg('Territorial change'),
  'attack.terror': msg('Terrorist attack'),
  'status.in_danger': msg('World Heritage in danger'),
  'hazard.quake': msg('Earthquake'),
  'battle.siege': msg('Siege'),
  'hazard.tsunami': msg('Tsunami'),
  'hazard.volcano': msg('Volcanic eruption'),
  'politics.treaty': msg('Treaty'),
  'politics.coup': msg('Coup'),
  'politics.revolution': msg('Revolution'),
  'politics.assassination': msg('Assassination'),
  'nuclear.test': msg('Nuclear test'),
  'nuclear.combat': msg('Nuclear attack'),
  'disaster.flood': msg('Flood'),
  'disaster.storm': msg('Storm'),
  'disaster.temperature': msg('Extreme temperature'),
  'disaster.drought': msg('Drought'),
  'disaster.quake': msg('Earthquake'),
  'disaster.landslide': msg('Landslide'),
  'disaster.mass_movement': msg('Landslide (dry)'),
  'disaster.volcano': msg('Volcanic activity'),
  'disaster.famine': msg('Famine'),
  'disaster.epidemic': msg('Epidemic'),
  'disaster.fire': msg('Fire'),
  'disaster.wildfire': msg('Wildfire'),
  'accident.aviation': msg('Air disaster'),
  'accident.rail': msg('Rail accident'),
  'accident.road': msg('Road accident'),
  'accident.mining': msg('Mining accident'),
  'accident.explosion': msg('Explosion'),
  'accident.crowd': msg('Crowd crush'),
  'accident.industrial': msg('Industrial accident'),
  'politics.riot': msg('Riot'),
  'politics.protest': msg('Protest'),
  'politics.strike': msg('Strike'),
  'battle.operation': msg('Military operation'),
  'crime.shooting': msg('Shooting'),
  'crime.murder': msg('Murder'),
  'hazard.fireball': msg('Fireball'),
  'accident.shipwreck': msg('Shipwreck'),
  'space.launch': msg('Space launch'),
  'space.suborbital': msg('Suborbital launch'),
  'missile.test': msg('Missile test'),
  'politics.coup.attempt': msg('Failed coup'),
  'politics.coup.conspiracy': msg('Coup plot'),
  'politics.peace_agreement': msg('Peace agreement'),
  'hazard.storm': msg('Tropical cyclone'),
  'slavery.voyage': msg('Slave voyage'),
  'event.general': msg('Event'),
};

const kindName = (kind: string) => (KINDS[kind] ? t(KINDS[kind]) : kind);

const PLACEMENT: Record<number, string> = {
  3: msg('Placed at the area, not an exact site.'),
  4: msg('Placed approximately by the source.'),
  5: msg('Placed at the country: the source names no closer place.'),
};

/** An importer that placed the event itself says how in attrs.placed_at; a disaster's magnitude counts the places it hit. The event pages say it too. */
export function placementNote(t: Say, geoPrec: number, family: string, magnitude: number | null | undefined, attrs?: Record<string, unknown>) {
  if (typeof attrs?.placed_at === 'string') return t('Placed at the {place}.', { place: attrs.placed_at });
  if (family === 'disaster' && (magnitude ?? 1) > 1) return t('Placed at the middle of the places it hit.');
  return PLACEMENT[geoPrec] && t(PLACEMENT[geoPrec]);
}

const placement = (p: HistoryFeature, magnitude: number | null | undefined, d?: HistoryDetail | null) =>
  placementNote(t, p.geoPrec, p.family, magnitude, d?.attrs);

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

/** TI's history tools read these helpers too, and the model gets them in English. */
type Say = (source: string, vars?: Vars) => string;
const EN = createTranslator(DEFAULT_LOCALE, {});

const dayFormats = new Map<string, Intl.DateTimeFormat>();
/** English keeps its own month table: en-GB's short September is "Sept". */
function dayMonth(intl: string, y: number, month: number, day?: number, date?: Date): string {
  if (intl === 'en' || y <= 0) {
    const year = y > 0 ? String(y) : `${1 - y} BCE`;
    return day ? `${day} ${MONTHS[month]} ${year}` : `${MONTHS[month]} ${year}`;
  }
  const key = `${intl}|${day ? 'd' : 'm'}`;
  let f = dayFormats.get(key);
  if (!f) dayFormats.set(key, (f = new Intl.DateTimeFormat(intl, { ...(day && { day: 'numeric' }), month: 'short', year: 'numeric', timeZone: 'UTC' })));
  return f.format(date ?? Date.UTC(y, month, day ?? 1));
}

/** A time at its precision: "1910s", "1916", "Jul 1916", "1 Jul 1916"; years before 1 are BCE. */
export function formatAt(s: number, prec: number, t: Say = EN, intl = 'en'): string {
  const d = new Date(s * 1000);
  const y = d.getUTCFullYear();
  const year = y > 0 ? String(y) : t('{year} BCE', { year: String(1 - y) });
  if (prec === Prec.century) return y > 0 ? t('{n}th century', { n: String(Math.floor((y - 1) / 100) + 1) }) : year;
  if (prec === Prec.decade) return y > 0 ? t('{decade}s', { decade: String(Math.floor(y / 10) * 10) }) : year;
  if (prec <= Prec.year) return year;
  if (y <= 0) return prec === Prec.month ? `${MONTHS[d.getUTCMonth()]} ${year}` : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${year}`;
  return dayMonth(intl, y, d.getUTCMonth(), prec === Prec.month ? undefined : d.getUTCDate(), d);
}

/** GTD eventids are YYYYMMDD and a number within the day; a 00 month or day means the source did not know it. */
export function gtdIdDay(id: string, intl = 'en'): string | null {
  const m = id.trim().match(/^(\d{4})(\d{2})(\d{2})\d{4}$/);
  if (!m) return null;
  const [y, mo, d] = [m[1], Number(m[2]), Number(m[3])];
  if (!mo || mo > 12) return y;
  return dayMonth(intl, Number(y), mo - 1, d || undefined);
}

/** "4 attacks on 11 Sep 2001", from GTD's own list of related eventids. */
export function gtdRelatedLine(related: unknown): string | null {
  if (typeof related !== 'string') return null;
  const ids = related.split(',').map(id => id.trim()).filter(id => /^\d{12}$/.test(id)).sort();
  if (ids.length < 2) return null;
  const days = [...new Set(ids.map(id => gtdIdDay(id, activeIntl())).filter((d): d is string => !!d))];
  return days.length === 1
    ? t('{n, plural, one {# attack on {day}} other {# attacks on {day}}}', { n: ids.length, day: days[0] })
    : t('{n, plural, one {# attack from {from} to {to}} other {# attacks from {from} to {to}}}', { n: ids.length, from: days[0], to: days[days.length - 1] });
}

export function when(p: HistoryFeature, d?: HistoryDetail | null, t: Say = EN, intl = 'en'): string {
  const start = formatAt(d?.tStart ?? p.t0, p.prec, t, intl);
  if (p.ongoing) return t('since {date}', { date: start });
  if (!d || d.tEnd === null) return start;
  const end = formatAt(d.tEnd, d.endPrec ?? p.prec, t, intl);
  return end === start ? start : `${start} – ${end}`;
}

const SKIP = new Set(['url', 'wiki', 'place', 'placed_at', 'geo_method', 'geo_confidence', 'also', 'net', 'ids', 'status', 'sig', 't_raw', 'crit', 'dyads', 'eventid', 'alt_names', 'phase', 'specificity', 'vicinity', 'doubtterr', 'multiple', 'added_by_compiler']);

const ROW_MAX = 160;

/** The attrs a reader can use: scalars and lists of strings, plus belligerents as "a vs b". */
export function facts(attrs: Record<string, unknown>, t: Say = EN, max = ROW_MAX): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (SKIP.has(k) || v === null || v === '' || v === false) continue;
    let text: string | null = null;
    if (typeof v === 'string' || typeof v === 'number' || v === true) text = v === true ? t('yes') : String(v);
    else if (Array.isArray(v) && v.every(x => typeof x === 'string')) text = v.join(', ');
    else if (k === 'belligerents' && typeof v === 'object') {
      const b = v as { left?: string[]; right?: string[] };
      text = t('{left} vs {right}', { left: (b.left ?? []).join(', '), right: (b.right ?? []).join(', ') });
    }
    if (!text) continue;
    const label = k.replace(/_/g, ' ');
    out.push([label.charAt(0).toUpperCase() + label.slice(1), text.length > max ? `${text.slice(0, max - 3)}…` : text]);
    if (out.length === 6) break;
  }
  return out;
}

/** A year page's line in full where the title was cut from it or a row would cut it: it reads as the event's summary. */
export function longDescription(title: string | null | undefined, attrs: Record<string, unknown>): string | null {
  const d = text(attrs.description);
  const stem = title?.replace(/…$/, '');
  if (!d || !title || !stem || d === title || !d.startsWith(stem)) return null;
  return title.endsWith('…') || d.length > ROW_MAX || opensWithBreak(d.slice(stem.length)) ? d : null;
}

export const withoutDescription = (attrs: Record<string, unknown>) => Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'description'));

const text = (v: unknown) => (typeof v === 'string' && v.trim() && v !== 'Unknown' ? v.trim() : null);
const count = (n: number) => Math.round(n).toLocaleString(activeIntl());

/** GTD's success: the attack took place (the bomb went off, the plane was taken), whatever it was meant to achieve. */
const GTD_OUTCOME: Record<number, string> = { 1: msg('Carried out'), 0: msg('Failed or foiled') };

const browserT: Say = (source, vars) => t(source, vars);

/** A GTD row in words; its coded columns read as raw numbers otherwise. The event pages pass their own translator. */
export function attackRows(a: Record<string, unknown>, t: Say = browserT, intl = activeIntl()): PopRow[] {
  const count = (n: number) => Math.round(n).toLocaleString(intl);
  const list = <T>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].join(', ');
  const where = [text(a.city), text(a.provstate), text(a.region)].filter((x, i, xs): x is string => !!x && xs.indexOf(x) === i);
  const attack = list<string>(a.attack);
  const claimed = a.claimed === 1 ? [t('Yes'), ...list<string>(a.claimmode).map(m => m.toLowerCase())].join(', ') : a.claimed === 0 ? t('No') : null;
  const outcome = typeof a.success === 'number' ? GTD_OUTCOME[a.success] : undefined;
  return [
    { label: t('Wounded'), value: typeof a.nwound === 'number' ? count(a.nwound) : null, mono: true },
    { label: t('Where'), value: where.join(', ') },
    { label: t('Attack'), value: attack.length > 1 ? attack.join(', ') : null },
    { label: t('Target'), value: uniq(list<{ type?: string }>(a.targets).map(x => text(x.type))) },
    // GTD spells some types out: "Vehicle (not to include vehicle-borne explosives, …)".
    { label: t('Weapon'), value: uniq(list<{ type?: string }>(a.weapons).map(w => text(w.type)?.replace(/\s*\(.*\)$/, '') ?? null)) },
    { label: t('Outcome'), value: outcome ? t(outcome) : null },
    { label: t('Suicide attack'), value: a.suicide === 1 ? t('Yes') : null },
    { label: t('Claimed'), value: claimed },
  ];
}

const TEASER = 220;

/** GTD summaries open with the date ("09/11/2001: "), which When already shows. */
export function summaryHtml(summary: string, expanded: boolean): string {
  const s = summary.replace(/^[\d/]+:\s*/, '');
  const para = (chunk: string) => `<p class="tk-pop-text">${htmlEsc(chunk)}</p>`;
  if (s.length <= TEASER + 40) return para(s);
  if (expanded) return `${para(s)}<button type="button" class="tk-pop-more" data-history-more>${htmlEsc(t('Show less'))}</button>`;
  const cut = s.slice(0, TEASER).replace(/\s+\S*$/, '');
  return `${para(`${cut}…`)}<button type="button" class="tk-pop-more" data-history-more>${htmlEsc(t('Read more'))}</button>`;
}

function wikiHtml(w: ArticleSummary): string {
  const img = w.image ? `<img class="tk-pop-media tk-pop-photo" src="${urlSafe(w.image.src)}" alt="" />` : '';
  return `${img}<div class="tk-pop-wiki">
    <div class="tk-pop-item-title">${htmlEsc(w.title)}</div>
    ${w.description ? `<div class="tk-pop-list-meta">${htmlEsc(w.description)}</div>` : ''}
  </div>`;
}

function eventRow(r: HistoryDetail): string {
  const fam = HISTORY_FAMILIES[r.family];
  const mag = typeof r.magnitude === 'number' && fam?.magnitude
    ? fam.magnitude === 'Killed' ? t('{n} killed', { n: count(r.magnitude) }) : `${t(fam.magnitude)} ${r.family === 'hazard' ? r.magnitude.toFixed(1) : count(r.magnitude)}`
    : null;
  const meta = [formatAt(r.tStart, r.prec, t, activeIntl()), mag].filter(Boolean).join(' · ');
  return `<button type="button" class="tk-pop-route tk-pop-related" data-history-event="${r.id}">
    <span class="tk-pop-route-name">${htmlEsc(r.title ?? kindName(r.kind))}</span>
    <span class="tk-pop-list-meta">${htmlEsc(meta)}</span>
  </button>`;
}

/** One kind of linked event as rows by date, or a line while they load; `line` stands in when none load. */
function linkedSection(label: string, ids: number[], x: HistoryExtras, line: string | null = null): string {
  if (!ids.length && !line) return '';
  const head = `<div class="tk-pop-label">${label}${ids.length > 1 ? ` · ${count(ids.length)}` : ''}</div>`;
  const rows = (x.related ?? []).filter(r => ids.includes(r.id));
  if (!rows.length) {
    const status = ids.length && x.related === undefined ? t('Loading…') : line;
    return status ? `${head}<div class="tk-pop-note">${htmlEsc(status)}</div>` : '';
  }
  const list = rows.sort((a, b) => a.tStart - b.tStart || a.id - b.id).map(eventRow).join('');
  const more = ids.length - rows.length;
  return `${head}<div class="tk-pop-related-list">${list}</div>${more > 0 ? `<div class="tk-pop-note">${htmlEsc(t('and {n} more', { n: count(more) }))}</div>` : ''}`;
}

function linkedHtml(p: HistoryFeature, d: HistoryDetail, x: HistoryExtras): string {
  const g = linkedIds(d);
  return linkedSection(htmlEsc(t('Part of')), g.partOf, x)
    + linkedSection(htmlEsc(t('Includes')), g.parts, x)
    + linkedSection(htmlEsc(p.family === 'terror' ? t('Related attacks') : t('Related events')), g.related, x, gtdRelatedLine(d.attrs.related));
}

/** `pin` offers the Pin button; `windowed` leaves the kicker to the window's header. */
export function historyPopupHtml(p: HistoryFeature, d?: HistoryDetail | null, x: HistoryExtras = {}, view: { pin?: boolean; windowed?: boolean } = {}): string {
  const family = HISTORY_FAMILIES[p.family];
  const attack = p.kind === 'attack.terror';
  const rows: PopRow[] = [
    { label: t('When'), value: when(p, d, t, activeIntl()) },
    { label: t('Kind'), value: kindName(p.kind) },
    ...(typeof d?.attrs.also === 'string' && KINDS[d.attrs.also] ? [{ label: t('Also recorded as'), value: kindName(d.attrs.also) }] : []),
  ];
  // Map features drop null properties, so a missing magnitude arrives as undefined.
  const magnitude = d?.magnitude ?? p.magnitude;
  if (typeof magnitude === 'number' && family?.magnitude) {
    // A source's estimate with stated bounds reads as the estimate and its range.
    const range = d?.attrs.magnitude_range;
    const span = Array.isArray(range) && range.length === 2 && range.every(n => typeof n === 'number') ? ` (${count(range[0])}–${count(range[1])})` : '';
    rows.push({ label: t(family.magnitude), value: (p.family === 'hazard' ? magnitude.toFixed(1) : count(magnitude)) + span, mono: true });
  }
  const long = d ? longDescription(d.title, d.attrs) : null;
  if (d) rows.push(...(attack ? attackRows(d.attrs) : facts(long ? withoutDescription(d.attrs) : d.attrs, t).map(([label, value]) => ({ label, value }))));
  const summary = (attack ? text(d?.attrs.summary) : null) ?? long ?? (x.wiki?.extract.trim() || null);
  // Facts first: the picture and summary would push the death toll below the popup's fold.
  const story = [x.wiki ? wikiHtml(x.wiki) : '', summary ? summaryHtml(summary, !!x.expanded) : ''].join('');
  const url = typeof d?.attrs.url === 'string' && /^https?:\/\//.test(d.attrs.url) ? d.attrs.url : null;
  const stored = articleTitle(d?.attrs);
  // The stored title links at once; the summary, when it lands, carries the canonical URL.
  const article = x.wiki?.url ?? (stored ? articleUrl(stored) : url && isWikipedia(url) ? url : null);
  const lang = x.wiki?.lang ?? (stored ? articleRef(stored).lang : 'en');
  const wikipedia = lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(lang, activeIntl()) });
  const link = url && !isWikipedia(url) ? url : null;
  const source = d?.source ? (d.source.attribution ?? d.source.name) : d === undefined ? t('Loading details…') : null;
  return pop({
    kicker: view.windowed ? undefined : family ? t(family.label) : t('Event'),
    dot: family?.color ?? HISTORY_FALLBACK_COLOR,
    title: p.title ?? kindName(p.kind),
    rows,
    foot: `${story ? `<div class="tk-pop-body">${story}</div>` : ''}${d ? linkedHtml(p, d, x) : ''}` || undefined,
    note: [placement(p, magnitude, d), source, x.wiki ? `· ${t('From {source}, CC BY-SA', { source: wikipedia })}` : null].filter(Boolean).join(' ') || undefined,
    links: [
      article ? { href: article, label: wikipedia } : null,
      link ? { href: link, label: t('Source page') } : null,
      // /event/<id> answers with the event's page; popups only know ids.
      typeof window !== 'undefined' ? { href: `${window.location.origin}${localePath(activeLocale(), `/event/${p.id}`)}`, label: t('Page') } : null,
    ],
    wide: attack,
    pin: view.pin,
  });
}
