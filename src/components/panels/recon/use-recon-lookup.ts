'use client';

import { useCallback, useState } from 'react';
import { authClient } from '@/lib/account/auth-client';
import { lookupError, lookupUrl, needsSignIn, parseLeaks, runSweep, SIGN_IN_REQUIRED } from '@/lib/recon/lookup';
import { plainError } from './lookup-errors';

export interface HistoryEntry { tool: string; query: string; at: number }
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

/** All of Recon's lookup state and the one entry point that runs a tool. Kept out of the panel so the view stays small. */
export function useReconLookup({ onScanGeolocate }: { onScanGeolocate?: (target: string, data: any) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [resultTool, setResultTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanType, setScanType] = useState('quick');
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
  const run = useCallback(async (tool: string, raw: string, opts?: { scanType?: string; cidr?: number }) => {
    const q = raw.trim();
    if (!q || loading) return;
    if (needsSignIn(tool, signedIn)) { clearResults(); setError(SIGN_IN_REQUIRED); setResultTool(tool); return; }
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
      const url = lookupUrl(tool, q, opts?.scanType ?? scanType);
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
      } else if (GEO_TOOLS.has(tool)) {
        fetch(`/api/osint/ip?ip=${encodeURIComponent(q)}`)
          .then(r => r.json())
          .then(loc => { if (loc?.geo?.lat && loc?.geo?.lon && onScanGeolocate) onScanGeolocate(q, { lat: loc.geo.lat, lng: loc.geo.lon, ...loc, type: tool }); })
          .catch(() => {});
      }
    } catch {
      setError(plainError('Network error'));
    } finally {
      setLoading(false);
    }
  }, [loading, signedIn, sweepCidr, scanType, clearResults, remember, onScanGeolocate]);

  return {
    query, setQuery, results, resultTool, loading, error, setError,
    scanType, setScanType, sweepCidr, setSweepCidr, chainView, setChainView,
    history, clearHistory, sweepResult, sweepProgress, signedIn,
    run, clearResults, isSignInError: error === SIGN_IN_REQUIRED,
  };
}

export type ReconLookup = ReturnType<typeof useReconLookup>;
