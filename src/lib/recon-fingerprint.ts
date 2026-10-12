import { platformCategory, type Category } from '@/lib/fingerprint';

export const ACCENT = '#3B82F6';

export type RowStatus = 'verifying' | 'verified' | 'unverifiable' | 'blocked' | 'error';

export interface Row {
  site: string;
  url: string;
  category: Category;
  status: RowStatus;
  http_status?: number;
  reason?: string;
  ms: number;
}

export const STATUS_META: Record<RowStatus, { label: string; color: string; rank: number }> = {
  verified: { label: 'FOUND', color: '#00E676', rank: 0 },
  verifying: { label: 'VERIFYING', color: ACCENT, rank: 0 },
  unverifiable: { label: 'UNSURE', color: '#FF9500', rank: 1 },
  blocked: { label: 'BLOCKED', color: '#E040FB', rank: 2 },
  error: { label: 'NO ANSWER', color: '#FF3D3D', rank: 3 },
};

export const CATEGORY_COLOR: Record<Category, string> = {
  Social: '#3B82F6', Developer: '#87CEEB', Gaming: '#00E676', Video: '#FF3D3D', Music: '#E040FB',
  Creative: '#FF9500', Writing: '#FFD700', Lifestyle: '#00BCD4', Commerce: '#F7931A',
  Forums: '#B388FF', Other: '#8A8A85',
};

/** Union of the fields read from /api/osint/leaks, /dns and /phone. */
interface SourceData {
  breaches?: string[];
  data_exposed?: string[];
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
