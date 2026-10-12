import { httpText } from '@/lib/httpJson';
import { iso2ForName, nameKey } from './country-codes';
import { dedupeAdvisories, type Advisory, type ParsedAdvisories } from './types';
import { rssDate, rssItems, rssTag, stripHtml } from './rss';

/**
 * TAKIP — Australia's Smartraveller advice (DFAT), no key. Licensed CC BY (latest version) per the
 * site's copyright page; attribute "Department of Foreign Affairs and Trade's Smartraveller website".
 * The level sits in <ta:warnings>: `ta:level` is N/5, where 1/5 belongs only to the "No travel advice"
 * placeholder, so the public levels 1–4 are 2/5–5/5. "Crisis alert" is a page, not a country.
 * The host is behind Akamai and refused every request from the dev machine (2026-10-12).
 * The fixtures come from the Wayback copy of 2026-10-01.
 */

export const SMARTRAVELLER_URL = 'https://www.smartraveller.gov.au/countries/documents/index.rss';

const NOT_DESTINATIONS = /^(?:crisis alert|no travel advice)$/i;

/** Same reading as US_LEVELS: normal 0, high caution 1, reconsider 2, do not travel 4. */
const BY_LABEL: Record<string, Advisory['level']> = {
  'exercise normal safety precautions': 0,
  'exercise a high degree of caution': 1,
  'reconsider your need to travel': 2,
  'do not travel': 4,
};
const BY_RATIO: Record<string, Advisory['level']> = { '2/5': 0, '3/5': 1, '4/5': 2, '5/5': 4 };

/** An unknown wording counts as "all travel to parts", as in fcdo.ts: under-reporting is the dangerous error. */
export function smartravellerLevel(ratio: string, label: string): Advisory['level'] {
  return BY_LABEL[label.trim().toLowerCase()] ?? BY_RATIO[ratio.replace(/\s/g, '')] ?? 3;
}

const firstSentence = (text: string) => text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? (text || null);

export function parseSmartraveller(xml: string): ParsedAdvisories {
  const items = rssItems(xml);
  if (!items.length) throw new Error('Smartraveller: feed has no items');
  const rows: Advisory[] = [];
  const unmatched: string[] = [];

  for (const item of items) {
    const country = rssTag(item, 'title') ?? '';
    if (!country || NOT_DESTINATIONS.test(country)) continue;
    const warning = rssTag(item, 'ta:warnings') ?? '';
    const ratio = rssTag(warning, 'ta:level') ?? '';
    const label = rssTag(warning, 'dc:description') ?? '';
    const iso2 = iso2ForName(country);
    if (!iso2) {
      unmatched.push(country);
      continue;
    }
    rows.push({
      issuer: 'Australia Smartraveller',
      iso2,
      country,
      level: smartravellerLevel(ratio, label),
      label: label || 'Smartraveller advice',
      statuses: ratio ? [ratio] : [],
      change: firstSentence(stripHtml(rssTag(item, 'description') ?? '')),
      updated_at: rssDate(rssTag(item, 'pubDate')),
      url: rssTag(item, 'link') ?? SMARTRAVELLER_URL,
    });
  }
  return { advisories: dedupeAdvisories(rows, a => `${a.iso2}|${nameKey(a.country)}`), unmatched };
}

export async function fetchSmartraveller(): Promise<ParsedAdvisories> {
  return parseSmartraveller(await httpText(SMARTRAVELLER_URL, { timeoutMs: 8_000, headers: { Accept: '*/*' } }));
}
