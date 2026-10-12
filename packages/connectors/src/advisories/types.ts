import type { FcdoAdvisory } from './fcdo';

export type AdvisoryIssuer = FcdoAdvisory['issuer'] | 'US State Department' | 'Australia Smartraveller';

/** One issuer's advice for one country, on FCDO's 0–4 scale; `label` keeps the issuer's own wording. */
export type Advisory = Omit<FcdoAdvisory, 'issuer'> & { issuer: AdvisoryIssuer };

export interface AdvisorySource {
  issuer: AdvisoryIssuer;
  ok: boolean;
  /** Serving the last good copy after a failed refresh. */
  stale?: true;
  error?: string;
}

export interface ParsedAdvisories {
  advisories: Advisory[];
  /** Feed names that resolved to no ISO code. */
  unmatched: string[];
}

/** Drops repeated pages for the same place, keeping the newest, then the more severe. */
export function dedupeAdvisories(rows: Advisory[], key: (a: Advisory) => string): Advisory[] {
  const best = new Map<string, Advisory>();
  for (const row of rows) {
    const k = key(row);
    const prev = best.get(k);
    const newer = (row.updated_at ?? '') > (prev?.updated_at ?? '');
    const same = (row.updated_at ?? '') === (prev?.updated_at ?? '');
    if (!prev || newer || (same && row.level > prev.level)) best.set(k, row);
  }
  return [...best.values()];
}
