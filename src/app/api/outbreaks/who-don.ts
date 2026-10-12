import { httpJson } from '@/lib/httpJson';
import { matchDisease } from './diseases';
import { resolvePlace } from './places';
import type { OutbreakNotice } from './types';

/**
 * TAKIP — WHO Disease Outbreak News via the who.int OData API, no key. The DON RSS has been dead since 2024.
 * WHO content is CC BY-NC-SA 3.0 IGO: non-commercial use only.
 * Titles carry the place after the last spaced dash ("Marburg virus disease- Ethiopia") or, in some
 * posts, after the last comma ("…, Democratic Republic of the Congo & Uganda"). "Global" and
 * "Multi-country" posts have no country to place.
 */

export const WHO_DON_URL = 'https://www.who.int/api/emergencies/diseaseoutbreaknews?sf_provider=dynamicProvider372&sf_culture=en'
  + '&$orderby=PublicationDateAndTime%20desc&$select=Title,ItemDefaultUrl,PublicationDateAndTime&$top=30';
const ITEM_BASE = 'https://www.who.int/emergencies/disease-outbreak-news/item';

interface DonItem {
  Title?: string;
  ItemDefaultUrl?: string;
  PublicationDateAndTime?: string;
}

export function splitDonTitle(title: string): { subject: string; place: string } | null {
  const m = title.match(/^(.*\S)\s*[-–—]\s+(\S.*)$/) ?? title.match(/^(.*?),\s+([^,]+)$/);
  return m ? { subject: m[1].trim(), place: m[2].trim() } : null;
}

export function mapDonItem(item: DonItem): OutbreakNotice | null {
  const title = item.Title?.trim();
  if (!title) return null;
  const split = splitDonTitle(title);
  const places = split ? resolvePlace(split.place) : { countries: [], unmatched: [] };
  const published = item.PublicationDateAndTime && Number.isFinite(Date.parse(item.PublicationDateAndTime))
    ? new Date(item.PublicationDateAndTime).toISOString()
    : null;
  return {
    source: 'WHO',
    title,
    url: item.ItemDefaultUrl ? `${ITEM_BASE}${item.ItemDefaultUrl.startsWith('/') ? '' : '/'}${item.ItemDefaultUrl}` : ITEM_BASE,
    published,
    disease: matchDisease(split?.subject ?? title),
    ...places,
    level: null,
  };
}

export function parseWhoDon(json: unknown): OutbreakNotice[] {
  const items = (json as { value?: unknown } | null)?.value;
  if (!Array.isArray(items)) throw new Error('WHO DON: unexpected OData shape');
  return items.map(i => mapDonItem(i as DonItem)).filter((n): n is OutbreakNotice => n !== null);
}

export async function fetchWhoDon(): Promise<OutbreakNotice[]> {
  return parseWhoDon(await httpJson<unknown>(WHO_DON_URL, { timeoutMs: 20_000 }));
}
