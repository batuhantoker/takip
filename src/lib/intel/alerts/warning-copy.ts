import type { WarningAlert } from './live-alerts';

/*
 * Issuers write for their own systems: "Warning, Heavy rain", "CAP Alert",
 * "Jazan region - Ad Darb : The entire governorate; …— Saudi Arabia". These turn
 * that into what a person would say. Display only: search and grouping keep the raw text.
 */

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>' };
const decode = (s: string) => s.replace(/&(?:amp|quot|#39|apos|lt|gt);/g, m => ENTITIES[m]);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Mostly capital letters across at least two words: a headline that shouts. */
function shouts(s: string): boolean {
  const letters = s.match(/\p{L}/gu) ?? [];
  const cased = letters.filter(ch => ch.toLowerCase() !== ch.toUpperCase());
  const upper = cased.filter(ch => ch === ch.toUpperCase());
  return cased.length >= 6 && upper.length / cased.length > 0.9;
}

const sentence = (s: string) => cap(s.toLowerCase());
const titleWords = (s: string) => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

const GENERIC = /^(cap alert|alert|warning|notice|weather warning)$/i;

/** "Heavy rain warning", not "Warning, Heavy rain"; the hazard, not "CAP Alert". */
export function warningHeadline(w: Pick<WarningAlert, 'title' | 'type'>): string {
  let t = decode(w.title.trim());
  const type = decode(w.type.trim());

  // NWS and ECCC put the office or the area after the type: "Flood Warning issued … by NWS Mobile".
  if (t.toLowerCase().startsWith(type.toLowerCase()) && /^\s*(?:issued\b|[—–-]\s)/i.test(t.slice(type.length))) t = sentence(type);

  const levelFirst = /^(warning|watch|advanced watch|advisory|early warning|alert)\s*,\s*(.+)$/i.exec(t);
  if (levelFirst) t = `${cap(levelFirst[2])} ${levelFirst[1].toLowerCase().replace('advanced ', '')}`;

  // GDACS leads with its alert colour, which the severity dot already shows.
  const gdacs = /^(?:green|orange|red|yellow) notification for (.+?)\.\s/i.exec(t);
  if (gdacs) t = cap(gdacs[1]);
  t = t.replace(/^(?:green|orange|red|yellow) (\w)/i, (_, ch: string) => ch.toUpperCase());
  t = t.replace(/^drought is on ?going in /i, 'Drought in ');

  if (GENERIC.test(t) && type && !GENERIC.test(type)) t = cap(type);
  t = t.replace(/^forestfire\b/i, 'Forest fire');
  if (shouts(t)) return sentence(t);
  // "Avertissement de PLUIE Sévère pour la wilaya : BÉCHAR": calm the shouted words, keep the rest.
  const loud = t.match(/\b\p{Lu}{4,}\b/gu) ?? [];
  return loud.length >= 2 ? t.replace(/(?<![\p{L}-])\p{Lu}{4,}(?![\p{L}])/gu, w => titleWords(w)) : t;
}

export type WarningPlace = {
  /** For the meta line: "Jazan, Saudi Arabia", "Alexander, NC and 2 more". */
  short: string | null;
  /** Every area named, one per line: "Jazan: Ad Darb, Baysh". */
  parts: string[];
  country: string | null;
};

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];
const andMore = (xs: string[]) =>
  xs.length > 2 ? `${xs[0]} and ${xs.length - 1} more` : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : xs[0] ?? null;
const calm = (s: string) => {
  const t = s.replace(/[.\s]+$/, '').trim();
  return shouts(t) || /^\p{Lu}{4,}$/u.test(t) ? titleWords(t) : t;
};
// The meta line has room for the place, not the hundred municipalities in brackets after it.
const tidyPlace = (s: string) => calm(s.replace(/\s*\([^)]*\)/g, '').replace(/\s+,/g, ','));

/** Where a warning applies, from the issuer's area string. */
export function warningPlace(area: string | null, title = ''): WarningPlace {
  if (!area) return { short: null, parts: [], country: null };
  const a = decode(area).trim();

  const countryLevel = /^country-level, areas not mapped:\s*/i.exec(a);
  if (countryLevel) {
    const parts = unique(a.slice(countryLevel[0].length).split(';').map(s => s.trim().replace(/\.$/, '')));
    const country = /^([^:]{2,40}):/.exec(decode(title))?.[1]?.trim();
    return { short: country ?? andMore(parts), parts, country: country ?? null };
  }

  const dash = a.lastIndexOf(' — ');
  const country = dash >= 0 ? a.slice(dash + 3).trim() : null;
  const body = dash >= 0 ? a.slice(0, dash) : a;
  const segments = body.split(';').map(s => s.split(' : ')[0].trim()).filter(Boolean);
  const withCountry = (s: string | null) => (s && country && !s.toLowerCase().includes(country.toLowerCase()) ? `${s}, ${country}` : s ?? country);

  // WMO's Saudi feed: "Jazan region - Ad Darb", one governorate per segment.
  const regional = segments.map(s => /^(.+?) region - (.+)$/i.exec(s));
  if (segments.length && regional.every(Boolean)) {
    const byRegion = new Map<string, string[]>();
    for (const m of regional as RegExpExecArray[]) byRegion.set(m[1].trim(), [...(byRegion.get(m[1].trim()) ?? []), m[2].trim()]);
    const regions = [...byRegion.keys()];
    return {
      short: withCountry(andMore(regions)),
      parts: [...byRegion].map(([r, places]) => `${r}: ${unique(places).join(', ')}`),
      country,
    };
  }

  // A bare list of countries: "Angola, Democratic Republic of Congo, Republic of Congo, Gabon".
  const commaList = segments.length === 1 ? segments[0].replace(/\([^)]*\)/g, '').split(/,\s*/) : [];
  if (commaList.length >= 3 && !commaList.some(x => /^\p{Lu}{2}$/u.test(x.trim()))) {
    const items = unique(commaList.map(x => x.trim()));
    return { short: withCountry(andMore(items)), parts: [items.join(', ')], country };
  }

  const parts = unique(segments.map(calm));
  return { short: withCountry(andMore(unique(segments.map(tidyPlace)))), parts: parts.length ? parts : country ? [country] : [], country };
}
