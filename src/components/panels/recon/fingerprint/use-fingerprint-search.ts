'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  validateQuery, splitNdjson, pushHistory, parseHistory,
  HISTORY_KEY, type SearchType, type Category, type HistoryEntry,
} from '@/lib/intel/recon/fingerprint/search';
import { toRow, type Row, type Source, type Phase } from '@/lib/intel/recon/fingerprint/rows';
import { lookupError, SIGN_IN_REQUIRED } from '@/lib/intel/recon/lookup';
import type { Identity } from '@/lib/intel/recon/people/correlate';
import { countAction } from '@/lib/platform/usage-actions';

/** Where a username search is: sweeping sites, re-testing hits, or reading the profiles found. */
export type Stage = 'sweep' | 'verifying' | 'profiles';

/**
 * Held by OsintPanel rather than the view: the expanded mode renders through
 * a portal, so the view remounts on every toggle and would otherwise drop a
 * sweep that is still streaming.
 */
export function useFingerprintSearch() {
  const [mode, setMode] = useState<SearchType>('username');
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState<{ type: SearchType; query: string } | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [progress, setProgress] = useState({ checked: 0, total: 0, ruledOut: 0 });
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showUnsure, setShowUnsure] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [tiedOnly, setTiedOnly] = useState(false);
  const [stage, setStage] = useState<Stage>('sweep');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [networkTrouble, setNetworkTrouble] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return parseHistory(window.localStorage.getItem(HISTORY_KEY));
    } catch {
      return []; // storage blocked
    }
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [phase]);

  const record = useCallback((entry: HistoryEntry) => {
    setHistory(prev => {
      const next = pushHistory(prev, entry);
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked — the log just won't persist */
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* storage blocked */
    }
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(async (type: SearchType, raw: string) => {
    const q = raw.trim();
    const invalid = validateQuery(type, q);
    if (invalid) {
      setError(invalid);
      return;
    }

    countAction(`recon.${type}` as const);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const t0 = Date.now();
    setMode(type);
    setQuery(q);
    setError('');
    setSearched({ type, query: q });
    setRows({});
    setSources([]);
    setStage('sweep');
    setIdentity(null);
    setNetworkTrouble(false);
    setTiedOnly(false);
    setCategories([]);
    setProgress({ checked: 0, total: 0, ruledOut: 0 });
    setStartedAt(t0);
    setNow(t0);
    setFinishedAt(0);
    setPhase('running');

    const finish = (status: HistoryEntry['status'], count: number) => {
      setFinishedAt(Date.now());
      setPhase(status === 'done' ? 'done' : status === 'stopped' ? 'stopped' : 'error');
      record({ query: q, type, count, status, at: t0 });
    };

    const getJson = async (url: string) => {
      const res = await fetch(url, { signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(lookupError(data, `HTTP ${res.status}`));
      return data;
    };
    const settle = (id: string, patch: Partial<Source>) =>
      setSources(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    const message = (e: unknown) => (e instanceof Error ? e.message : 'Lookup failed');
    const signInRefused = (e: unknown) => message(e) === SIGN_IN_REQUIRED;
    // A refusal isn't a search: nothing is logged, and the bar offers sign-in.
    const refuse = () => {
      setSearched(null);
      setSources([]);
      setStartedAt(0);
      setPhase('idle');
      setError(SIGN_IN_REQUIRED);
    };

    /* ── username: streamed sweep ── */
    if (type === 'username') {
      let hits = 0;
      try {
        const res = await fetch(`/api/osint/fingerprint?username=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(lookupError(body, `Search failed (${res.status})`));
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let completed = false;

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { lines, rest } = splitNdjson(buffer);
          buffer = rest;

          // One state update per network chunk, not per line — a chunk can
          // carry dozens of verdicts.
          let checked = 0;
          let ruledOut = 0;
          let total = 0;
          const added: Record<string, Row> = {};
          for (const line of lines) {
            const ev = JSON.parse(line);
            if (ev.type === 'result') {
              checked++;
              total = ev.total;
              if (ev.status === 'not_found') ruledOut++;
              else if (ev.status === 'found') { added[ev.site] = toRow(ev, 'verifying'); hits++; }
              else if (ev.status === 'blocked') added[ev.site] = toRow(ev, 'blocked');
              else if (ev.status === 'error') added[ev.site] = toRow(ev, 'error');
            } else if (ev.type === 'stage') {
              setStage(ev.stage);
            } else if (ev.type === 'profile') {
              const { site, profile } = ev;
              setRows(p => (p[site] ? { ...p, [site]: { ...p[site], profile } } : p));
            } else if (ev.type === 'done') {
              // Calibrated verdicts replace the provisional ones; `found` carries each hit's details and tie to the person.
              const next: Record<string, Row> = {};
              for (const r of ev.found || []) next[r.site] = toRow(r, r.unverified ? 'verifying' : 'verified');
              for (const r of ev.inconclusive || []) next[r.site] = toRow(r, 'unverifiable');
              for (const r of ev.blocked || []) next[r.site] = toRow(r, 'blocked');
              for (const r of ev.unreliable || []) next[r.site] = toRow(r, 'unreliable');
              for (const r of ev.errors || []) next[r.site] = toRow(r, 'error');
              setRows(next);
              setIdentity(ev.identity ?? null);
              setNetworkTrouble(!!ev.network_trouble);
              setProgress({ checked: ev.checked, total: ev.checked, ruledOut: ev.not_found_count ?? 0 });
              completed = true;
              finish('done', (ev.found || []).length);
            } else if (ev.type === 'error') {
              throw new Error(ev.error || 'Search failed');
            }
          }
          if (checked) {
            setProgress(p => ({ checked: p.checked + checked, total, ruledOut: p.ruledOut + ruledOut }));
          }
          if (Object.keys(added).length) setRows(p => ({ ...p, ...added }));
        }
        if (!completed) throw new Error('The connection closed before the sweep finished.');
      } catch (e) {
        if (ctrl.signal.aborted) {
          finish('stopped', hits);
        } else if (signInRefused(e)) {
          refuse();
        } else {
          setError(message(e));
          finish('fail', hits);
        }
      }
      return;
    }

    /* ── email and phone: a few sources in parallel, each answering on its own ── */
    const plan: { id: string; label: string; via: string; url: string }[] = type === 'email'
      ? [
          { id: 'profile', label: 'Accounts and mail', via: 'Gravatar, GitHub, keys.openpgp.org, DNS', url: `/api/osint/email?email=${encodeURIComponent(q)}` },
          { id: 'breach', label: 'Breaches', via: 'XposedOrNot', url: `/api/osint/leaks?email=${encodeURIComponent(q)}` },
          { id: 'stealer', label: 'Infostealer logs', via: 'Hudson Rock', url: `/api/osint/hudsonrock?type=email&query=${encodeURIComponent(q)}` },
        ]
      : [
          { id: 'number', label: 'Phone number', via: 'libphonenumber', url: `/api/osint/phone?number=${encodeURIComponent(q)}` },
          // Hudson Rock matches the login string exactly, so send one spelling: digits and a leading +.
          { id: 'stealer', label: 'Infostealer logs', via: 'Hudson Rock', url: `/api/osint/hudsonrock?type=phone&query=${encodeURIComponent(q.replace(/[^\d+]/g, ''))}` },
        ];
    setSources(plan.map(({ id, label, via }) => ({ id, label, via, state: 'pending' })));

    const outcomes = await Promise.allSettled(plan.map(p => getJson(p.url).then(
      d => { settle(p.id, { state: 'done', data: d }); return d; },
      e => { settle(p.id, { state: 'error', error: message(e) }); throw e; },
    )));
    if (ctrl.signal.aborted) return finish('stopped', 0);
    if (outcomes.some(o => o.status === 'rejected' && signInRefused(o.reason))) return refuse();
    if (outcomes.every(o => o.status === 'rejected')) {
      setError('Every source failed to answer.');
      return finish('fail', 0);
    }
    const first = outcomes[type === 'email' ? 1 : 0];
    const data = first.status === 'fulfilled' ? first.value : null;
    finish('done', type === 'email' ? (data?.breaches || []).length : data?.valid ? 1 : 0);
  }, [record]);

  return {
    mode, setMode, query, setQuery, phase, error, setError, searched, rows, progress,
    elapsedMs: startedAt ? (phase === 'running' ? now : finishedAt) - startedAt : 0,
    sources, view, setView, categories, setCategories, showUnsure, setShowUnsure,
    showBlocked, setShowBlocked, tiedOnly, setTiedOnly, stage, identity, networkTrouble, history, clearHistory, run, stop,
  };
}

export type FingerprintState = ReturnType<typeof useFingerprintSearch>;
