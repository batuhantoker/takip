'use client';

import { Search, Loader2 } from 'lucide-react';
import type { ToolDef } from './recon-tools';

export function QueryBar({
  activeTab, chainView, setChainView, currentTab, query, setQuery, runLookup, loading,
  scanType, setScanType, sweepCidr, setSweepCidr,
}: {
  activeTab: string;
  chainView: 'brief' | 'wallet';
  setChainView: (v: 'brief' | 'wallet') => void;
  currentTab: ToolDef | undefined;
  query: string;
  setQuery: (v: string) => void;
  runLookup: () => void;
  loading: boolean;
  scanType: string;
  setScanType: (v: string) => void;
  sweepCidr: number;
  setSweepCidr: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* CHAIN INTEL view switch — the brief takes no target. */}
      {activeTab === 'crypto' && (
        <div className="flex gap-1">
          {([['brief', 'DAILY BRIEF'], ['wallet', 'WALLET FORENSICS']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setChainView(id)}
              className="px-2 py-1 rounded text-[10px] font-mono font-bold tracking-wider transition-colors"
              style={{
                color: chainView === id ? currentTab?.color : 'var(--text-muted)',
                background: chainView === id ? `${currentTab?.color}1a` : 'transparent',
                border: `1px solid ${chainView === id ? `${currentTab?.color}55` : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!(activeTab === 'crypto' && chainView === 'brief') && (
      <div className="flex gap-1.5">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runLookup()}
            placeholder={currentTab?.placeholder}
            className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-8 pr-3 py-2.5 text-[10px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none transition-colors"
            style={{ borderColor: query ? `${currentTab?.color}40` : undefined }} />
        </div>
        <button onClick={runLookup} disabled={loading || !query.trim()}
          className="px-4 py-2 rounded-lg text-[11px] font-mono font-bold tracking-wider disabled:opacity-30 transition-all flex items-center justify-center min-w-[70px]"
          style={{ backgroundColor: `${currentTab?.color}20`, border: `1px solid ${currentTab?.color}40`, color: currentTab?.color }}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'SCAN'}
        </button>
      </div>
      )}

      {/* Secondary Controls */}
      {activeTab === 'scanner' && (
        <select value={scanType} onChange={e => setScanType(e.target.value)}
          className="bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[11px] font-mono text-[var(--text-muted)] outline-none w-full">
          <option value="quick">QUICK SCAN</option><option value="deep">DEEP SCAN</option><option value="ports">TOP 1000 PORTS</option>
        </select>
      )}
      {activeTab === 'sweep' && (
        <div className="flex items-center justify-between bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg p-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] pl-2">SUBNET MASK:</span>
          <div className="flex items-center gap-0.5">
            {[24, 25, 26, 27, 28].map(c => (
              <button key={c} onClick={() => setSweepCidr(c)}
                className={`px-2 py-1 text-[11px] font-mono rounded transition-all ${
                  sweepCidr === c ? 'bg-[#FF3D3D]/20 text-[#FF3D3D]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >/{c}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
