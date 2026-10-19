'use client';

import { useCallback, useState } from 'react';
import { authClient } from '@/components/site/account/auth-client';
import { lookupError, lookupUrl, needsSignIn, parseLeaks, runSweep, SIGN_IN_REQUIRED } from '@/lib/intel/recon/lookup';
import { countAction } from '@/lib/platform/usage-actions';
import type { UsageAction } from '@takip/core/usage';
import { plainError } from './lookup-errors';

export interface HistoryEntry { tool: string; query: string; at: number }

// Usage statistics count the kind of lookup, never its target; tools not named here count as recon.other.
const RECON_ACTION: Record<string, UsageAction> = { bgp: 'recon.ip', shodan: 'recon.ip', scanner: 'recon.ip', sweep: 'recon.ip', vuln: 'recon.cve', dns: 'recon.domain', whois: 'recon.domain', certs: 'recon.domain', ssl: 'recon.domain', subdomains: 'recon.domain', headers: 'recon.domain', tech: 'recon.domain', username: 'recon.username', github: 'recon.username', phone: 'recon.phone', leaks: 'recon.email', crypto: 'recon.wallet', donbot: 'recon.wallet' };
export type ChainView = 'brief' | 'wallet';

const RECENT_KEY = 'takip.recon.recent';

function loadRecent(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(h => typeof h?.tool === 'string' && typeof h?.query === 'string' && typeof h?.at === 'number').slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function saveRecent(list: HistoryEntry[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked: the list lasts for this visit only */
  }
}

const GEO_TOOLS = new Set(['scanner', 'vuln', 'shodan', 'bgp', 'dns', 'whois', 'certs', 'ssl', 'subdomains', 'headers', 'tech', 'threats']);

const IP_LIKE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+:[0-9a-f:]+$/i;

/** The query's address for map placement: itself if it is one, else its first A record. */
async function resolveToIp(query: string): Promise<string | null> {
  if (IP_LIKE.test(query)) return query;
  const host = query.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  try {
    const d = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`).then(r => r.json());
    return d.Answer?.find((a: { type: number }) => a.type === 1)?.data ?? null;
  } catch {
    return null;
  }
}

/** All of Recon's lookup state and the one entry point that runs a tool. Kept out of the panel so the view stays small. */
export function useReconLookup({ onScanGeolocate }: { onScanGeolocate?: (target: string, data: any) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [resultTool, setResultTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sweepCidr, setSweepCidr] = useState(24);
  const [chainView, setChainView] = useState<ChainView>('brief');
  const [history, setHistory] = useState<HistoryEntry[]>(loadRecent);
  const [sweepResult, setSweepResult] = useState<any>(null);
  const [sweepProgress, setSweepProgress] = useState<{ current: number; total: number } | null>(null);
  const signedIn = Boolean(authClient.useSession().data);

  const clearResults = useCallback(() => {
    setResults(null);
    setResultTool(null);
    setSweepResult(null);
    setSweepProgress(null);
    setError('');
  }, []);

  const remember = useCallback((tool: string, q: string) => setHistory(prev => {
    const next = [{ tool, query: q, at: Date.now() }, ...prev.filter(h => !(h.tool === tool && h.query === q))].slice(0, 8);
    saveRecent(next);
    return next;
  }), []);

  const clearHistory = useCallback(() => { setHistory([]); saveRecent([]); }, []);

  // Takes tool and query as args: a caller that sets the tool then runs in one
  // handler would otherwise run against the previous tool (stale closure).
  const run = useCallback(async (tool: string, raw: string, opts?: { cidr?: number }) => {
    const q = raw.trim();
    if (!q || loading) return;
    if (needsSignIn(tool, signedIn)) { clearResults(); setError(SIGN_IN_REQUIRED); setResultTool(tool); return; }
    countAction(RECON_ACTION[tool] ?? 'recon.other');
    setLoading(true);
    setError('');
    setResults(null);
    setSweepResult(null);
    setResultTool(tool);

    if (tool === 'sweep') {
      const cidr = opts?.cidr ?? sweepCidr;
      const total = Math.pow(2, 32 - cidr);
      setSweepProgress({ current: 0, total });
      try {
        const result = await runSweep(q, cidr, total, done => setSweepProgress({ current: done, total }));
        setSweepResult(result);
        remember(tool, q);
      } catch (err: any) {
        setError(plainError(err.message || 'Scan failed'));
      } finally {
        setSweepProgress(null);
        setLoading(false);
      }
      return;
    }

    try {
      const url = lookupUrl(tool, q);
      const res = await fetch(url, tool === 'shodan' ? { cache: 'no-store' } : undefined);

      if (tool === 'shodan' && res.status === 404) {
        setResults({ ip: q, status: 'No Shodan records found', ports: [], cpes: [], hostnames: [], tags: [], vulns: [] });
        remember(tool, q);
        return;
      }
      if (tool === 'leaks' && res.status === 404) {
        setResults({ email: q, breached: false, breaches: [], data_exposed: [] });
        remember(tool, q);
        return;
      }

      const data = await res.json();
      if (!res.ok) { setError(plainError(lookupError(data, 'Lookup failed'))); return; }

      setResults(tool === 'leaks' ? parseLeaks(data, q) : data);
      remember(tool, q);

      if (tool === 'phone') {
        if (data.lat && data.lng && onScanGeolocate) onScanGeolocate(q, { lat: data.lat, lng: data.lng, type: 'phone', region: data.region });
      } else if (GEO_TOOLS.has(tool) && onScanGeolocate) {
        // Domain and URL tools carry a hostname, not an IP; resolve it first so
        // the IP geolocation route gets something it accepts instead of a 400.
        resolveToIp(q)
          .then(ip => {
            if (!ip) return;
            return fetch(`/api/osint/ip?ip=${encodeURIComponent(ip)}`)
              .then(r => r.json())
              .then(loc => { if (loc?.geo?.lat && loc?.geo?.lon) onScanGeolocate(q, { lat: loc.geo.lat, lng: loc.geo.lon, ...loc, type: tool }); });
          })
          .catch(() => {});
      }
    } catch {
      setError(plainError('Network error'));
    } finally {
      setLoading(false);
    }
  }, [loading, signedIn, sweepCidr, clearResults, remember, onScanGeolocate]);

  return {
    query, setQuery, results, resultTool, loading, error, setError,
    sweepCidr, setSweepCidr, chainView, setChainView,
    history, clearHistory, sweepResult, sweepProgress, signedIn,
    run, clearResults, isSignInError: error === SIGN_IN_REQUIRED,
  };
}

export type ReconLookup = ReturnType<typeof useReconLookup>;
