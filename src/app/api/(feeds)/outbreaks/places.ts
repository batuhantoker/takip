import { findCountries, iso2ForName, type CountryMention } from '@/app/api/(intel)/advisories/country-codes';

/**
 * TAKIP — reads the country slot of an outbreak title or list.
 * Regional scopes ("Global", "Multi-country", "EU/EEA", "Sub-Saharan Africa") are deliberately not
 * countries, so they are skipped rather than reported as unmatched.
 */

export interface Places {
  countries: CountryMention[];
  unmatched: string[];
}

const NOT_A_COUNTRY = /\b(?:global|multi[- ]?(?:countr(?:y|ies)|locations?|regional)|worldwide|international|eu\/eea|europe|sub-saharan africa|americas|african region|region|cruise ship)\b/i;

const cleanName = (s: string) => s.trim().replace(/^(?:and|the)\s+/, '').replace(/\s+/g, ' ');

function add(out: Places, mention: CountryMention) {
  if (!out.countries.some(c => c.iso2 === mention.iso2)) out.countries.push(mention);
}

function resolvePart(part: string, out: Places): void {
  const name = cleanName(part);
  if (!name) return;
  const iso2 = iso2ForName(name);
  if (iso2) return add(out, { iso2, name });
  const found = findCountries(name);
  if (found.length) return found.forEach(m => add(out, m));
  if (!NOT_A_COUNTRY.test(name)) out.unmatched.push(name);
}

/** A title's place slot: "Uganda", "Democratic Republic of the Congo & Uganda", "Ituri … of the DRC". */
export function resolvePlace(text: string): Places {
  const out: Places = { countries: [], unmatched: [] };
  const whole = iso2ForName(cleanName(text));
  if (whole) {
    add(out, { iso2: whole, name: cleanName(text) });
    return out;
  }
  for (const part of text.split(/\s*[&;,]\s*/)) resolvePart(part, out);
  return out;
}

/** Splits on commas outside brackets: "French Polynesia, including … (Tahiti, Moorea, and Bora-Bora), Gabon". */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const c of list) {
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    if (c === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  return [...parts, current];
}

/** Bare sovereignty tags that trail a territory, as in "Wake Island, U.S.". */
const QUALIFIER = /^(?:U\.?S\.?|U\.?K\.?)$/;

/**
 * CDC's "Country List": comma-separated, with "including …" clauses that name parts of the previous
 * country. Unresolved names inside a clause are skipped. The clause ends at its "and …" item or
 * at the next name that is a country.
 */
export function parseCountryList(list: string): Places {
  const out: Places = { countries: [], unmatched: [] };
  let inClause = false;
  for (const raw of splitTopLevel(list)) {
    const part = raw.trim();
    if (!part) continue;
    if (/^includ(?:ing|es)\b/i.test(part)) {
      inClause = true;
      continue;
    }
    const name = cleanName(part);
    const iso2 = iso2ForName(name);
    if (iso2) {
      add(out, { iso2, name: name.replace(/\s*\([^)]*\)/g, '') });
      inClause = false;
      continue;
    }
    if (inClause) {
      if (/^and\s/i.test(part)) inClause = false;
      continue;
    }
    if (!QUALIFIER.test(part)) out.unmatched.push(name);
  }
  return out;
}
