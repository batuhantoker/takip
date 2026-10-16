import { platformCategory, toCsv, type Category } from './search';
import type { ProfileFacts } from '../people/facts';
import type { Match, MatchTier } from '../people/correlate';
import type { EmailReport } from '../people/email';

export const ACCENT = '#3B82F6';

export type RowStatus = 'verifying' | 'verified' | 'unverifiable' | 'blocked' | 'unreliable' | 'error';

export interface Row {
  site: string;
  url: string;
  category: Category;
  status: RowStatus;
  http_status?: number;
  reason?: string;
  ms: number;
  /** What the profile says about its owner. */
  profile?: ProfileFacts;
  /** Whether it looks like the same person as the other hits, once the search is done. */
  match?: Match;
}

export const STATUS_META: Record<RowStatus, { label: string; color: string; rank: number }> = {
  verified: { label: 'FOUND', color: '#00E676', rank: 0 },
  verifying: { label: 'VERIFYING', color: ACCENT, rank: 0 },
  unverifiable: { label: 'UNSURE', color: '#FF9500', rank: 1 },
  blocked: { label: 'BLOCKED', color: '#E040FB', rank: 2 },
  unreliable: { label: 'CANT_TELL', color: '#8A8A85', rank: 2 },
  error: { label: 'NO ANSWER', color: '#FF3D3D', rank: 3 },
};

export const CATEGORY_COLOR: Record<Category, string> = {
  Social: '#3B82F6', Developer: '#87CEEB', Gaming: '#00E676', Video: '#FF3D3D', Music: '#E040FB',
  Creative: '#FF9500', Writing: '#FFD700', Lifestyle: '#00BCD4', Commerce: '#F7931A',
  Forums: '#B388FF', Other: '#8A8A85',
};

/** Hits sorted strongest tie to the person first; a search still running has no ties yet. */
export const TIER_RANK: Record<MatchTier, number> = { confirmed: 0, linked: 1, likely: 2, unknown: 3, other: 4 };

export interface BreachDetail {
  name: string;
  year: string | null;
  records: number | null;
  domain: string | null;
  industry: string | null;
  password_risk: string | null;
  data: string[];
}

export interface Stealer {
  date_compromised?: string;
  operating_system?: string;
  total_corporate_services?: number;
  total_user_services?: number;
}

/** Union of the fields read from /api/osint/leaks, /email, /hudsonrock and /phone. */
interface SourceData extends Partial<Omit<EmailReport, 'email' | 'domain'>> {
  breaches?: string[];
  data_exposed?: string[];
  details?: BreachDetail[];
  risk?: { label: string | null; score: number | null } | null;
  compromised?: boolean;
  stealers?: Stealer[];
  domain?: string;
  summary?: { mail_servers?: string[] };
  valid?: boolean;
  number?: string;
  international?: string;
  national?: string;
  country_code?: string;
  region?: string;
  region_code?: string;
  line_type?: string;
}

export interface Source {
  id: string;
  label: string;
  via: string;
  state: 'pending' | 'done' | 'error';
  data?: SourceData;
  error?: string;
}

export type Phase = 'idle' | 'running' | 'done' | 'stopped' | 'error';

/** One site verdict as the stream carries it (a sherlock SiteResult). */
interface Verdict {
  site: string;
  url: string;
  http_status?: number;
  reason?: string;
  ms?: number;
  profile?: ProfileFacts;
  match?: Match;
}

export function toRow(r: Verdict, status: RowStatus): Row {
  return {
    site: r.site,
    url: r.url,
    category: platformCategory(r.site),
    status,
    http_status: r.http_status,
    reason: r.reason,
    ms: r.ms ?? 0,
    profile: r.profile,
    match: r.match,
  };
}

/** A file of the search's rows, with what each profile said and how it tied to the person. */
export function exportRows(rows: Row[], search: { query: string; type: string; checked: number }, format: 'csv' | 'json') {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const base = `fingerprint-${search.query.replace(/[^A-Za-z0-9._-]/g, '_')}-${stamp}`;
  const status = (r: Row) => STATUS_META[r.status].label.toLowerCase();
  if (format === 'json') {
    return {
      filename: `${base}.json`,
      type: 'application/json',
      body: JSON.stringify({
        query: search.query, type: search.type, exported_at: new Date().toISOString(), platforms_checked: search.checked,
        results: rows.map(r => ({
          platform: r.site, category: r.category, status: status(r), url: r.url, http_status: r.http_status ?? null, response_ms: r.ms,
          note: r.reason ?? null, match: r.match?.tier ?? null, match_reasons: r.match?.reasons ?? [], profile: r.profile ?? null,
        })),
      }, null, 2),
    };
  }
  return {
    filename: `${base}.csv`,
    type: 'text/csv',
    body: toCsv(
      ['platform', 'category', 'status', 'url', 'match', 'match_reasons', 'name', 'location', 'website', 'http_status', 'response_ms'],
      rows.map(r => [
        r.site, r.category, status(r), r.url, r.match?.tier ?? '', r.match?.reasons.join('; ') ?? '',
        r.profile?.name ?? '', r.profile?.location ?? '', r.profile?.website ?? '', r.http_status ?? '', r.ms,
      ]),
    ),
  };
}

export function download(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const bareUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
