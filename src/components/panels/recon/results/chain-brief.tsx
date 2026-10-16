'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCw, Sparkles } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { PanelSection } from '@/components/ui/panel';
import { Segmented } from '@/components/ui/segmented';
import { Stat } from '@/components/ui/stat';
import { hostedAiNotice } from '@/lib/intel/ai/hosted';
import { ErrorNote } from '@/components/panels/recon/parts/error-note';
import { CveList, ExploitList, SanctionedWallets, usd } from './chain-brief-sections';

/**
 * Daily chain-threat brief, shown in Recon → Crypto. Self-contained: owns its
 * own fetch, window selector, unattended refresh and AI overview.
 */

const AUTO_REFRESH_MS = 15 * 60_000;

function ChainBriefInner() {
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [ai, setAi] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async (d: number, force = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/chain/daily?days=${d}${force ? '&refresh=1' : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The brief isn’t available right now.');
      setBrief(data);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || 'Couldn’t load the brief.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  // Keeps a long-open panel from going stale; the upstreams move daily at most.
  useEffect(() => {
    const t = setInterval(() => { if (typeof document !== 'undefined' && document.hidden) return; load(days, true); }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [days, load]);

  const runAi = useCallback(async () => {
    if (!brief) return;
    setAiLoading(true);
    setAi('');
    try {
      const res = await fetch('/api/ai/overview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chain', payload: { brief } }),
      });
      const d = await res.json();
      const notice = hostedAiNotice(d.hostedAi ?? d.error);
      setAi(d.overview ? [d.overview, notice].filter(Boolean).join('\n\n') : notice || d.error || 'No summary came back. Try again in a moment.');
    } catch {
      setAi('Couldn’t reach the summariser. Try again in a moment.');
    } finally {
      setAiLoading(false);
    }
  }, [brief]);

  const t = brief?.totals;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Segmented size="sm" label="Window" value={String(days)} onChange={v => setDays(Number(v))}
          options={[7, 30, 90].map(d => ({ value: String(d), label: `${d} days` }))} />
        <span className="ml-auto text-meta whitespace-nowrap text-ink-3">
          {loading ? 'Updating…' : lastRefresh && <>Updated <span className="font-mono tabular-nums">{lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span></>}
        </span>
        <IconButton label="Refresh now" icon={RotateCw} size="sm" disabled={loading} onClick={() => load(days, true)} className="-mr-1.5" />
      </div>

      {loading && !brief && (
        <div className="mt-4 flex items-center justify-center gap-2 py-6 text-small text-ink-3">
          <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />Building the brief…
        </div>
      )}
      {error && <ErrorNote className="mt-4" message={error} onRetry={() => load(days, true)} />}

      {brief && (
        <>
          <div className="mt-5 grid max-w-md grid-cols-3 gap-3">
            <Stat size="sm" label="Stolen" value={usd(t?.exploit_losses_usd)} />
            <Stat size="sm" label="Exploits" value={t?.exploit_count ?? 0} />
            <Stat size="sm" label="CVEs" value={t?.cve_count ?? 0} />
          </div>

          <div className="mt-4">
            <Button variant="secondary" size="sm" icon={aiLoading ? undefined : Sparkles} loading={aiLoading} onClick={runAi}>Brief me</Button>
            {ai && <p className="mt-2 whitespace-pre-wrap rounded-card border border-line bg-surface-2 p-2.5 text-small leading-relaxed text-ink-2">{ai}</p>}
          </div>

          <ExploitList exploits={brief.exploits} />
          <CveList cves={brief.cves} />
          <SanctionedWallets wallets={brief.sanctioned_wallets} total={t?.sanctioned_wallet_count ?? 0} />

          {brief.degraded?.length > 0 && (
            <PanelSection title="Sources not answering" hint={brief.degraded.length}>
              {brief.degraded.map((d: string, i: number) => <p key={i} className="text-small text-ink-2">{d}</p>)}
            </PanelSection>
          )}

          <p className="mt-6 text-meta text-ink-3">From {(brief.sources || []).join(', ')} · refreshes every 15 min</p>
        </>
      )}
    </div>
  );
}

export default memo(ChainBriefInner);
