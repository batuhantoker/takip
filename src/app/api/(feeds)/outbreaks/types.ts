import type { CountryMention } from '@/app/api/(intel)/advisories/country-codes';

export type OutbreakSource = 'WHO' | 'CDC' | 'ECDC';

/** One feed item, before the age, disease and dedupe rules. */
export interface OutbreakNotice {
  source: OutbreakSource;
  title: string;
  url: string;
  /** ISO timestamp, or null when the feed's date did not parse. */
  published: string | null;
  disease: string | null;
  countries: CountryMention[];
  /** Names in a slot that should hold countries but resolved to none. */
  unmatched: string[];
  /** The issuer's own grade (CDC Level 1–4); null when the issuer has none. */
  level: number | null;
}

export interface OutbreakSourceStatus {
  name: string;
  ok: boolean;
  /** Serving the last good copy after a failed refresh. */
  stale?: true;
  error?: string;
}

export interface Outbreak {
  id: string;
  disease: string;
  country: string;
  iso2: string;
  lat: number;
  lng: number;
  precision: 'country';
  title: string;
  url: string;
  published: string;
  source: OutbreakSource;
  level: number | null;
}
