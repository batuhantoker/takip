import { cachedSource } from '../source-cache';

/**
 * TAKIP — UK FCDO travel advice from the gov.uk Content API, no key. OGL v3, credit the FCDO.
 * FCDO publishes no ISO codes, so slugs come from matching ISO-2 English names to its index,
 * plus the hand-resolved pages below. A page with no warning is a real "no warning",
 * not a failed lookup.
 */

const INDEX_URL = 'https://www.gov.uk/api/content/foreign-travel-advice';
const pageUrl = (slug: string) => `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`;
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const DAY_MS = 24 * 3600_000;
const ADVICE_TTL_MS = 3 * 3600_000;

/** Pages whose slug the ISO name doesn't produce (checked against the index, 2026-10-12). */
export const FCDO_SLUG_OVERRIDES: Record<string, string> = {
  CD: 'democratic-republic-of-the-congo', CG: 'congo', PS: 'palestine', TR: 'turkey', PN: 'pitcairn-island',
  MM: 'myanmar', FM: 'federated-states-of-micronesia', MO: 'macao', HK: 'hong-kong', US: 'usa', GM: 'the-gambia',
  BQ: 'bonaire-st-eustatius-saba', SX: 'st-maarten', MF: 'st-martin-and-st-barthelemy', BL: 'st-martin-and-st-barthelemy',
  VC: 'st-vincent-and-the-grenadines', AQ: 'antarctica-british-antarctic-territory',
  SH: 'st-helena-ascension-and-tristan-da-cunha', AC: 'st-helena-ascension-and-tristan-da-cunha', TA: 'st-helena-ascension-and-tristan-da-cunha',
  CK: 'cook-islands-tokelau-and-niue', TK: 'cook-islands-tokelau-and-niue', NU: 'cook-islands-tokelau-and-niue',
};

/** Most severe first. */
export const FCDO_STATUSES = [
  { token: 'avoid_all_travel_to_whole_country', level: 4, label: 'Advises against all travel' },
  { token: 'avoid_all_travel_to_parts', level: 3, label: 'Advises against all travel to parts' },
  { token: 'avoid_all_but_essential_travel_to_whole_country', level: 2, label: 'Advises against all but essential travel' },
  { token: 'avoid_all_but_essential_travel_to_parts', level: 1, label: 'Advises against all but essential travel to parts' },
] as const;

export interface FcdoAdvisory {
  issuer: 'UK FCDO';
  iso2: string;
  country: string;
  /** 0 no warning … 4 against all travel to the whole country. */
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  statuses: string[];
  change: string | null;
  updated_at: string | null;
  url: string;
}

const slugify = (name: string) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function fcdoSlugFor(iso2: string, slugs: ReadonlySet<string>): string | null {
  const code = iso2.toUpperCase();
  const override = FCDO_SLUG_OVERRIDES[code];
  if (override) return slugs.has(override) ? override : null;
  let name: string | undefined;
  try {
    name = regionNames.of(code);
  } catch {
    return null;
  }
  if (!name || name === code) return null;
  const slug = slugify(name);
  return slugs.has(slug) ? slug : null;
}

/** An unknown token counts as "against all travel to parts": under-reporting is the dangerous error. */
export function rankStatuses(statuses: string[]): { level: FcdoAdvisory['level']; label: string } {
  if (!statuses.length) return { level: 0, label: 'No FCDO warning against travel' };
  const levels = statuses.map(s => FCDO_STATUSES.find(f => f.token === s)?.level ?? 3);
  const worst = Math.max(...levels) as FcdoAdvisory['level'];
  const match = FCDO_STATUSES.find(f => f.level === worst);
  return { level: worst, label: match?.label ?? 'Warns against travel' };
}

interface ContentItem {
  title?: string;
  public_updated_at?: string;
  details?: {
    alert_status?: unknown;
    change_description?: string;
    country?: { name?: string; slug?: string };
  };
}

export function mapFcdoPage(iso2: string, page: ContentItem): FcdoAdvisory {
  const slug = page.details?.country?.slug;
  if (!slug) throw new Error('FCDO: page without a country');
  const statuses = Array.isArray(page.details?.alert_status)
    ? page.details.alert_status.filter((s): s is string => typeof s === 'string')
    : [];
  return {
    issuer: 'UK FCDO',
    iso2: iso2.toUpperCase(),
    country: page.details?.country?.name ?? slug,
    ...rankStatuses(statuses),
    statuses,
    change: page.details?.change_description || null,
    updated_at: page.public_updated_at ?? null,
    url: `https://www.gov.uk/foreign-travel-advice/${slug}`,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`FCDO HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const loadSlugs = cachedSource<string>('fcdo:index', async () => {
  const index = await getJson<{ links?: { children?: ContentItem[] } }>(INDEX_URL);
  const slugs = (index.links?.children ?? []).map(c => c.details?.country?.slug).filter((s): s is string => !!s);
  if (slugs.length < 200) throw new Error(`FCDO index has only ${slugs.length} countries`);
  return slugs;
}, DAY_MS);

/** null when the FCDO has no page for the country (the UK itself, for one). Throws when the lookup fails. */
export async function fetchFcdoAdvisory(iso2: string): Promise<FcdoAdvisory | null> {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return null;
  const slugs = await loadSlugs();
  if (!slugs.length) throw new Error('FCDO index unavailable');
  const slug = fcdoSlugFor(iso2, new Set(slugs));
  if (!slug) return null;
  const [advisory] = await cachedSource<FcdoAdvisory>(`fcdo:${slug}`, async () =>
    [mapFcdoPage(iso2, await getJson<ContentItem>(pageUrl(slug)))], ADVICE_TTL_MS)();
  if (!advisory) throw new Error(`FCDO advice for ${slug} unavailable`);
  return { ...advisory, iso2: iso2.toUpperCase() };
}
