/**
 * TAKIP — minimal RSS reading for the advisory and outbreak feeds, with no XML library.
 * Handles only what these feeds use: flat <item>s, CDATA, entity-encoded HTML and RFC-822-ish dates.
 * Gotcha: Smartraveller dates carry AEST/AEDT, which Date.parse does not know.
 */

export function rssItems(xml: string): string[] {
  return xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/g) ?? [];
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== '#') return NAMED[code.toLowerCase()] ?? whole;
    const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}

function unwrap(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return cdata ? cdata[1] : decodeEntities(raw);
}

const escapeTag = (tag: string) => tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text of every `<tag>` in the fragment; attributes are ignored, `<tag/>` reads as ''. */
export function rssTags(fragment: string, tag: string): string[] {
  const t = escapeTag(tag);
  const re = new RegExp(`<${t}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${t}>)`, 'g');
  return [...fragment.matchAll(re)].map(m => unwrap(m[1] ?? '').trim());
}

export function rssTag(fragment: string, tag: string): string | null {
  return rssTags(fragment, tag)[0] ?? null;
}

/** `<category domain="…">` values keyed by domain. */
export function rssCategories(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of fragment.matchAll(/<category\s+domain="([^"]*)"[^>]*>([\s\S]*?)<\/category>/g)) {
    out[m[1]] ??= unwrap(m[2]).trim();
  }
  return out;
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<\/?(?:br|p|li|ul|ol|div)\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ZONES: Record<string, string> = {
  GMT: '+00:00', UTC: '+00:00', UT: '+00:00', Z: '+00:00',
  AEST: '+10:00', AEDT: '+11:00', ACST: '+09:30', ACDT: '+10:30', AWST: '+08:00',
  EST: '-05:00', EDT: '-04:00', CST: '-06:00', CDT: '-05:00', PST: '-08:00', PDT: '-07:00',
};
const pad = (n: number | string) => String(n).padStart(2, '0');

/**
 * `Mon, 12 Oct 2026`, `01 Oct 2026 22:00:00 AEST`, `Fri, 02 Oct 2026 04:00:00 GMT`, `… +0200`.
 * A date without a time stays `YYYY-MM-DD` rather than gaining an invented midnight.
 */
export function rssDate(raw: string | null | undefined): string | null {
  const m = raw?.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([A-Za-z]{1,4}|[+-]\d{4})?)?/);
  if (!m) return null;
  const [, day, mon, year, hh, mm, ss, zone] = m;
  const month = MONTHS.indexOf(mon.toLowerCase());
  if (month < 0) return null;
  const date = `${year}-${pad(month + 1)}-${pad(day)}`;
  if (hh == null) return Number.isFinite(Date.parse(date)) ? date : null;
  const offset = !zone ? '+00:00'
    : /^[+-]\d{4}$/.test(zone) ? `${zone.slice(0, 3)}:${zone.slice(3)}`
      : ZONES[zone.toUpperCase()];
  if (!offset) return null;
  const t = Date.parse(`${date}T${pad(hh)}:${mm}:${ss ?? '00'}${offset}`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
