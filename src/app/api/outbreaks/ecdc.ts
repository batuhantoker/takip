import { httpText } from '@/lib/httpJson';
import { findCountries } from '@/app/api/advisories/country-codes';
import { rssDate, rssItems, rssTag } from '@/app/api/advisories/rss';
import { blankDiseases, matchDisease } from './diseases';
import type { OutbreakNotice } from './types';

/**
 * TAKIP — ECDC (the EU's disease agency) RSS by taxonomy term, no key. Reuse allowed with attribution to ECDC.
 * Term ids checked 2026-10-12. Kept: 1310 "Epidemiological update", 1295 "Risk assessment".
 * Dropped: 1307 "News" (mostly institutional), 1505 "Communicable Disease Threats Report" (weekly
 * digests naming no country), 323 "Avian influenza virus" (digests and overviews) and
 * 1244 "Scientific and technical publications".
 * Countries come from the title only. Many items are "worldwide overview" or "EU/EEA" and place nowhere.
 */

export const ECDC_TERMS = [
  { id: 1310, name: 'ECDC epidemiological updates' },
  { id: 1295, name: 'ECDC risk assessments' },
] as const;

export const ecdcFeedUrl = (term: number) => `https://www.ecdc.europa.eu/en/taxonomy/term/${term}/feed`;

export function mapEcdcItem(item: string): OutbreakNotice | null {
  const title = rssTag(item, 'title')?.replace(/\s+/g, ' ').trim();
  if (!title) return null;
  return {
    source: 'ECDC',
    title,
    url: rssTag(item, 'link') ?? 'https://www.ecdc.europa.eu/',
    published: rssDate(rssTag(item, 'pubDate')),
    disease: matchDisease(title),
    countries: findCountries(blankDiseases(title)),
    unmatched: [],
    level: null,
  };
}

export function parseEcdcFeed(xml: string): OutbreakNotice[] {
  if (!/<rss[\s>]/.test(xml)) throw new Error('ECDC: not an RSS document');
  return rssItems(xml).map(mapEcdcItem).filter((n): n is OutbreakNotice => n !== null);
}

export async function fetchEcdcFeed(term: number): Promise<OutbreakNotice[]> {
  return parseEcdcFeed(await httpText(ecdcFeedUrl(term), { timeoutMs: 20_000, headers: { Accept: '*/*' } }));
}
