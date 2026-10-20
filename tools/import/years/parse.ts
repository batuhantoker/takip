import { dayNum, type Lang, monthIndex, type PageTime, toAscii } from './langs';
import { heading, inline, logicalLines, type Rendered, stripBlocks } from './wikitext';

/* A year page's events section as dated bullets, each with the links it makes and the links of the bullets it sits under. */

export type DatePrec = 'day' | 'month' | 'year' | 'decade' | 'century';

/** Astronomical years; months 1–12. `y2…` is the end of a stated range. */
export type BulletDate = { y: number; m?: number; d?: number; y2?: number; m2?: number; d2?: number; prec: DatePrec; approx?: boolean };

export type Bullet = {
  /** Headings under the events heading ("January–March", "By place > Europe"). */
  sec: string[];
  text: string;
  /** Article titles it links, in order, without date articles. */
  links: string[];
  /** Links of the bullets it sits under, nearest first (Current events: the story and its topic). */
  ctx?: string[];
  date: BulletDate;
  /** Nothing but a link: an event's name, or a ruler's in a list. */
  bare?: boolean;
  /** Links the text puts it in or at ("killed in [[Ra'anana]]", "[[İstanbul]]'da"). */
  loc?: string[];
};

export type PageResult = { events: boolean; bullets: Bullet[]; skipped: Record<string, number> };

const COARSER: Record<DatePrec, DatePrec> = { day: 'month', month: 'year', year: 'decade', decade: 'century', century: 'century' };

/** "Événements", "رویداد‌ها", "События:" all compare by their letters. */
export const headingKey = (s: string) => s.replace(/[‌‍‎‏]/g, '').replace(/[\s:：]+$/u, '').replace(/\s+/g, ' ').trim().toLowerCase();

type Raw = { depth: number; sec: string[]; r: Rendered; yearCtx: number | null; monthCtx: number | null };

/** The events section's lines (the whole page for a Current events day), or null when the page has none. */
function eventLines(lang: Lang, src: string, pt: PageTime): { lines: string[]; level: number } | null {
  if (pt.portal) {
    // The day's items sit inside {{Current events|…|content= … }}.
    const at = src.search(/\|\s*content\s*=/);
    const body = at >= 0 ? src.slice(src.indexOf('=', at) + 1).replace(/\}\}\s*$/, '') : src;
    return { lines: logicalLines(body), level: 1 };
  }
  const lines = logicalLines(src);
  const heads = lines.map((l, i) => ({ i, h: heading(l) })).filter((x): x is { i: number; h: { level: number; text: string } } => !!x.h);
  const ev = heads.find(x => lang.events.test(headingKey(x.h.text)));
  if (ev) {
    const end = heads.find(x => x.i > ev.i && x.h.level <= ev.h.level);
    return { lines: lines.slice(ev.i + 1, end?.i ?? lines.length), level: ev.h.level };
  }
  // Pages laid out by region ("== Africa ==", "== Europe ==") have their events before the births.
  const first = heads.find(x => x.h.level === 2);
  const stop = heads.find(x => lang.stop.test(headingKey(x.h.text)));
  if (!first || !stop || stop.i <= first.i) return null;
  return { lines: lines.slice(first.i, stop.i), level: 1 };
}

/** A leading year or year range: "1683–1699 –", "755 BC:", "MÖ 500 -", "前500年：". */
const YEAR_LEAD = /^(?:c\.\s*|ca\.\s*|MÖ\s*|前|紀元前)?([0-9]{1,4})(s)?(?:\s*(?:BC|BCE|v\. Chr\.|av\. J\.-C\.|a\. C\.|до н\. ?э\.|ق\.? ?م))?(?:\s*(?:год|г\.|年|yılı))?(?:\s*(?:[–—―-]|to|bis)\s*([0-9]{1,4})(?:\s*(?:год|г\.|年))?(?:\/[0-9]{1,4})?)?(?:\s+[–—―-]+\s*|\s*[:：,]\s*|\s*[–—―]\s*)/u;
const APPROX_LEAD = /^(?:(?:c\.|ca\.|circa|um|vers|v\.|около|ок\.|hacia|حوالي|حوالى|حدود|约|約|大约|大約)\s*|\((?:approximate|approx\.?|traditional|probable) date\)\s*[–—:-]?\s*)/iu;
const BC_MARK = /^(?:MÖ|前|紀元前)|BC|v\. Chr\.|av\. J\.-C\.|a\. C\.|до н\. ?э\.|ق\.? ?م/u;

/** Cuts `n` characters off the front of a rendered line, dropping links that sat there. */
function cut(r: Rendered, n: number): Rendered {
  const lead = r.text.slice(n).length - r.text.slice(n).trimStart().length;
  const k = n + lead;
  return { text: r.text.slice(k), links: r.links.filter(l => l.start >= k).map(l => ({ ...l, start: l.start - k, end: l.end - k })) };
}

/** Abbreviations a sentence doesn't end at: "U.S. Secretary", "St. Petersburg", "c. 500", "Friedrich II.", "3. Mai". */
const ABBR = /(?:^|[\s(])(?:[A-Z]|[IVXLCDM]+|\d{1,3}|U\.S|St|Mt|Dr|Mr|Mrs|Jr|Sr|Gen|Lt|Col|Capt|Adm|Gov|Sen|Rep|Rev|Fr|No|Co|Corp|Inc|Ltd|vs|c|ca|approx|ed|vol|pp?|Bros|Ft|Hon|Pres|Prof|Sgt|Maj|Cdr|Cmdr|[A-Z]\.[A-Z]|v\. ?Chr|n\. ?Chr|a\. ?C|d\. ?C|av\. J\.-C|apr\. J\.-C|н\. ?э|г|гг|ст|им|ок|св|кн|dt|bzw|vgl|usw|etc)\.$/u;

/** Where the first sentence ends (after its stop for CJK, before it otherwise), or the text's length. */
export function sentenceEnd(text: string): number {
  const re = /([.!?])(?:\s+|$)(?=[\p{Lu}\p{Lo}"“«(\d]|$)|[。！？]/gu;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[1] === '.' && ABBR.test(text.slice(0, m.index + 1))) continue;
    return m.index + (m[1] === '.' ? 0 : 1);
  }
  return text.length;
}

/** Whether nothing but links and punctuation is left: a topic line ("[[Russo-Ukrainian War]]") rather than an event. */
const linkOnly = (r: Rendered) => {
  let rest = r.text;
  for (const l of [...r.links].sort((a, b) => b.start - a.start)) rest = rest.slice(0, l.start) + rest.slice(l.end);
  return !/\p{L}{2,}/u.test(rest.replace(/\b(?:and|und|et|y|и|ve|و|與|と)\b/giu, ''));
};

function dayDate(lang: Lang, r: Rendered): { m: number; d?: number; m2?: number; d2?: number; len: number } | null {
  for (const p of lang.date) {
    const m = r.text.match(p);
    if (!m?.groups) continue;
    const g = m.groups;
    const a = monthIndex(lang, g.m);
    const b = monthIndex(lang, g.m2);
    const start = a >= 0 ? a : b;
    if (start < 0) continue;
    const d = dayNum(g.d);
    const d2 = dayNum(g.d2);
    if (d !== null && (d < 1 || d > 31)) continue;
    if (d === null) return { m: start + 1, ...(a >= 0 && b >= 0 && b !== a ? { m2: b + 1 } : {}), len: m[0].length };
    return { m: start + 1, d, ...(d2 !== null && d2 >= 1 && d2 <= 31 ? { m2: (b >= 0 ? b : start) + 1, d2 } : {}), len: m[0].length };
  }
  return null;
}

/** The year a heading names inside a decade page ("=== 755 BC ===", "=== 1683 год ==="), or null. */
function headingYear(lang: Lang, text: string, pt: PageTime): number | null {
  const t = lang.page(text.trim());
  if (t && t.span === 'year' && !t.country && !t.portal) return t.year;
  const m = toAscii(text).match(/^(?:AD\s+)?(\d{1,4})(\s*BC)?(?:\s*AD)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] || pt.year < 1 ? 1 - n : n;
}

/** Parses one page. Bullets dated before the page's year (a war it continues) are skipped and counted. */
export function parsePage(lang: Lang, wikitext: string, pt: PageTime): PageResult {
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);
  const section = eventLines(lang, stripBlocks(wikitext), pt);
  if (!section) return { events: false, bullets: [], skipped };
  const raws: Raw[] = [];
  let sec: string[] = [];
  let yearCtx: number | null = null;
  let monthCtx: number | null = null;
  for (const line of section.lines) {
    const h = heading(line);
    if (h) {
      sec = [...sec.slice(0, Math.max(0, h.level - section.level - 1)), h.text];
      const y = headingYear(lang, h.text, pt);
      const mo = monthIndex(lang, h.text.trim());
      if (h.level === section.level + 1) {
        yearCtx = null;
        monthCtx = null;
      }
      if (y !== null) yearCtx = y;
      monthCtx = mo >= 0 ? mo + 1 : h.level <= section.level + 1 ? null : monthCtx;
      continue;
    }
    // Current events topic lines: ";Armed conflicts and attacks" or a bold line.
    const label = line.match(/^;\s*(.+)$/) ?? line.match(/^'''([^']+)'''\s*$/);
    if (label && pt.portal) {
      sec = [inline(label[1], lang.code).text];
      continue;
    }
    const b = line.match(/^([*#:]*[*#])\s*(.*)$/);
    if (!b) continue;
    raws.push({ depth: b[1].length, sec, r: inline(b[2], lang.code), yearCtx, monthCtx });
  }

  const out: Bullet[] = [];
  const stack: { depth: number; date: BulletDate; stated: boolean; links: string[] }[] = [];
  for (let i = 0; i < raws.length; i++) {
    const raw = raws[i];
    while (stack.length && stack[stack.length - 1].depth >= raw.depth) stack.pop();
    const parent = stack[stack.length - 1];
    let r = raw.r;
    let y = raw.yearCtx ?? pt.year;
    let y2: number | undefined;
    const approx = lang.approx.test(r.text);
    // "c. January –": the marker is part of the date.
    const mark = pt.portal ? null : r.text.match(APPROX_LEAD);
    if (mark && (mark[0].startsWith('(') || dayDate(lang, cut(r, mark[0].length)) || YEAR_LEAD.test(toAscii(r.text.slice(mark[0].length))))) r = cut(r, mark[0].length);
    // A Current events item is dated by its page.
    const lead = pt.portal ? null : toAscii(r.text).match(YEAR_LEAD);
    if (lead) {
      const bc = BC_MARK.test(lead[0]) || pt.year < 1;
      // "1000s BC:" opens a decade, which BC runs from its larger number.
      const decade = !!lead[2];
      const a = bc ? 1 - Number(lead[1]) - (decade ? 9 : 0) : Number(lead[1]);
      let b = lead[3] ? Number(lead[3]) : null;
      // "1843–44" ends in 1844.
      if (b !== null && !bc && lead[3].length < lead[1].length) b = Number(lead[1].slice(0, lead[1].length - lead[3].length) + lead[3]);
      const inPage = pt.span === 'year' ? a === pt.year && !decade : a >= pt.year && a < pt.year + (pt.span === 'decade' ? 10 : 100);
      if (!inPage) {
        // A span that began earlier, listed under every year it lasted.
        skip(a < pt.year ? 'span from an earlier year' : 'year outside the page');
        stack.push({ depth: raw.depth, date: { y: a, prec: 'year' }, stated: false, links: [] });
        continue;
      }
      y = a;
      if (b !== null && (bc ? 1 - b : b) > a) y2 = bc ? 1 - b : b;
      r = cut(r, lead[0].length);
    }
    const dd = pt.portal ? null : dayDate(lang, r);
    let date: BulletDate;
    let stated = true;
    if (pt.portal) date = { y, m: pt.portal.month + 1, d: pt.portal.day, prec: 'day' };
    else if (dd) {
      r = cut(r, dd.len);
      date = { y, m: dd.m, ...(dd.d ? { d: dd.d } : {}), prec: dd.d ? 'day' : 'month' };
      if (dd.m2) Object.assign(date, { y2: dd.m2 < dd.m ? y + 1 : y, m2: dd.m2, ...(dd.d2 ? { d2: dd.d2 } : {}) });
    } else if (lead) date = { y, prec: lead[2] ? 'decade' : 'year' };
    else if (parent?.stated) date = { ...parent.date };
    else if (raw.monthCtx) date = { y, m: raw.monthCtx, prec: 'month' };
    else {
      date = { y, prec: raw.yearCtx !== null || pt.span === 'year' ? 'year' : pt.span };
      stated = false;
    }
    if (y2 !== undefined && date.y2 === undefined) date.y2 = y2;
    if (approx && !date.approx && !pt.portal) {
      date.prec = COARSER[date.prec];
      date.approx = true;
    }
    const own = r.links.map(l => l.title).filter(t => !lang.dateLink.test(t));
    // Only the first sentence: later ones tell what followed elsewhere ("victoire à Ulm … Vienne").
    const first = sentenceEnd(r.text);
    const loc = r.links
      .filter(l => !lang.dateLink.test(l.title) && l.start < first)
      .filter(l => lang.locBefore.test(r.text.slice(Math.max(0, l.start - 30), l.start)) || !!lang.locAfter?.test(r.text.slice(l.end, l.end + 16)) || (l.start === 0 && !!lang.locLead?.test(r.text.slice(l.end))))
      .map(l => l.title);
    const ctx = stack.flatMap(s => s.links).reverse();
    stack.push({ depth: raw.depth, date, stated, links: own });
    const text = r.text.replace(/^[\s,.;:–—-]+/u, '').trim();
    const hasChild = i + 1 < raws.length && raws[i + 1].depth > raw.depth;
    if (!/\p{L}/u.test(text)) {
      if (!hasChild) skip('no text');
      continue;
    }
    // "WWII:", "Unknown dates", "Japan", a war's name over its battles: a heading for the items under it.
    const words = text.split(/\s+/).length;
    if (hasChild && (linkOnly(r) || words <= 3 || (/[:：]$/.test(text) && words <= 4) || /^(?:unknown dates?|dates? unknown|undated)$/i.test(text))) continue;
    out.push({ sec: raw.sec, text, links: [...new Set(own)], ...(ctx.length ? { ctx: [...new Set(ctx)] } : {}), date, ...(linkOnly(r) ? { bare: true } : {}), ...(loc.length ? { loc: [...new Set(loc)] } : {}) });
  }
  return { events: true, bullets: out, skipped };
}
