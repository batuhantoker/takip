import { httpText } from '@/lib/httpJson';
import { rssDate, rssItems, rssTag } from '@/app/api/advisories/rss';
import { matchDisease } from './diseases';
import { parseCountryList, resolvePlace, type Places } from './places';
import type { OutbreakNotice } from './types';

/**
 * TAKIP — CDC Travel Health Notices RSS, no key. US public domain.
 * Titles read "Level N - Disease in Place" or "Level N - Global Disease". Multi-country notices put
 * a "Country List :" in the description, repeated several times with the earlier copies cut off
 * mid-name ("Ecua", "Senega"), so only the last copy is read.
 * The host serves this XML as text/html.
 */

export const CDC_NOTICES_URL = 'https://wwwnc.cdc.gov/travel/rss/notices.xml';

export function cdcCountryList(description: string): string | null {
  const parts = description.split(/Country List\s*:/i);
  return parts.length > 1 ? parts[parts.length - 1].trim() : null;
}

export function mapCdcItem(item: string): OutbreakNotice | null {
  const title = (rssTag(item, 'title') ?? '').replace(/\s+/g, ' ').trim();
  const m = title.match(/^Level\s+([1-4])\s*[-–]\s*(.+)$/i);
  if (!m) return null;
  const subject = m[2];
  const list = cdcCountryList(rssTag(item, 'description') ?? '');
  const inPlace = subject.match(/.*\sin\s+(.+)$/)?.[1];
  const places: Places = list ? parseCountryList(list) : inPlace ? resolvePlace(inPlace) : { countries: [], unmatched: [] };
  return {
    source: 'CDC',
    title,
    url: rssTag(item, 'link') ?? CDC_NOTICES_URL,
    published: rssDate(rssTag(item, 'pubDate')),
    disease: matchDisease(subject),
    ...places,
    level: Number(m[1]),
  };
}

export function parseCdcNotices(xml: string): OutbreakNotice[] {
  if (!/<rss[\s>]/.test(xml)) throw new Error('CDC: not an RSS document');
  return rssItems(xml).map(mapCdcItem).filter((n): n is OutbreakNotice => n !== null);
}

export async function fetchCdcNotices(): Promise<OutbreakNotice[]> {
  return parseCdcNotices(await httpText(CDC_NOTICES_URL, { timeoutMs: 20_000, headers: { Accept: '*/*' } }));
}
