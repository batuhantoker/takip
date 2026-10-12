import { httpText } from '@/lib/httpJson';
import { nameKey, iso2ForName } from './country-codes';
import { dedupeAdvisories, type Advisory, type ParsedAdvisories } from './types';
import { rssCategories, rssDate, rssItems, rssTag } from './rss';

/**
 * TAKIP — US State Department travel advisories (TAsTWs.xml, ~600 kB RSS), no key. US public domain.
 * One item per destination, headline Level 1–4. The Country-Tag category mixes FIPS and ISO codes
 * (IS is Israel, SV is Slovenia), so countries are resolved from the title instead.
 * The feed repeats some countries with an older page (Burma, Cambodia, Tunisia…). Gaza and the West Bank
 * are separate pages that both resolve to PS, and Bonaire and Saba/Sint Eustatius both resolve to BQ.
 */

export const US_STATE_URL = 'https://travel.state.gov/_res/rss/TAsTWs.xml';

/**
 * State's whole-country headline mapped onto FCDO's 0–4 scale. "Increased caution" is not advice against travel,
 * but it sits above "normal". "Reconsider" ≈ all but essential travel; "Do not travel" ≈ all travel. 3 (parts) is unused.
 */
export const US_LEVELS: Record<number, Advisory['level']> = { 1: 0, 2: 1, 3: 2, 4: 4 };

const LEVEL_RE = /Level ([1-4]):\s*([^-]+?)\s*(?:-|$)/;

export function parseUsAdvisories(xml: string): ParsedAdvisories {
  const items = rssItems(xml);
  if (!items.length) throw new Error('State Department: feed has no items');
  const rows: Advisory[] = [];
  const unmatched: string[] = [];

  for (const item of items) {
    const title = rssTag(item, 'title') ?? '';
    const threat = rssCategories(item)['Threat-Level'] ?? title;
    const level = threat.match(LEVEL_RE) ?? title.match(LEVEL_RE);
    const country = title.split(/\s+-\s+Level\s/)[0].replace(/\s+Travel Advisory$/i, '').trim();
    if (!level || !country) {
      unmatched.push(title);
      continue;
    }
    const iso2 = iso2ForName(country);
    if (!iso2) {
      unmatched.push(country);
      continue;
    }
    const n = Number(level[1]);
    rows.push({
      issuer: 'US State Department',
      iso2,
      country,
      level: US_LEVELS[n],
      label: level[2],
      statuses: [`Level ${n}: ${level[2]}`],
      change: null,
      updated_at: rssDate(rssTag(item, 'pubDate')),
      url: rssTag(item, 'link') ?? US_STATE_URL,
    });
  }
  return { advisories: dedupeAdvisories(rows, a => `${a.iso2}|${nameKey(a.country)}`), unmatched };
}

export async function fetchUsAdvisories(): Promise<ParsedAdvisories> {
  return parseUsAdvisories(await httpText(US_STATE_URL, { timeoutMs: 30_000, headers: { Accept: '*/*' } }));
}
