'use client';

import { Search, XCircle, LocateFixed } from 'lucide-react';
import { GROUPS, TABS, type ToolDef } from './recon-tools';

/* ── Expanded-view tool rail ──────────────────────────────────
   Fullscreen has room for the full label plus a one-line description, so
   the toolkit becomes a readable list rather than a grid of abbreviations. */
export function ToolRail({ toolFilter, setToolFilter, matchesFilter, activeTab, selectTool, handleSelfTrack, loading }: {
  toolFilter: string;
  setToolFilter: (v: string) => void;
  matchesFilter: (t: ToolDef) => boolean;
  activeTab: string;
  selectTool: (id: string) => void;
  handleSelfTrack: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="relative p-3 pb-2 flex-shrink-0">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          value={toolFilter}
          onChange={e => setToolFilter(e.target.value)}
          placeholder="Filter tools…"
          className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-8 pr-7 py-2 text-[10px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none"
        />
        {toolFilter && (
          <button onClick={() => setToolFilter('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 styled-scrollbar">
        {GROUPS.map(group => {
          const tools = TABS.filter(t => t.group === group.id && matchesFilter(t));
          if (!tools.length) return null;
          return (
            <div key={group.id} className="mb-3 last:mb-0">
              <div className="text-[10px] font-mono tracking-[0.2em] text-[var(--text-muted)]/70 mb-1.5 pt-1">
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {tools.map(tab => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => selectTool(tab.id)}
                      className="group flex items-start gap-2.5 px-2 py-1.5 rounded-lg border text-left transition-all"
                      style={{
                        borderColor: active ? `${tab.color}55` : 'transparent',
                        background: active ? `${tab.color}14` : undefined,
                      }}
                    >
                      <tab.icon
                        className="w-4 h-4 mt-0.5 flex-shrink-0 transition-colors"
                        style={{ color: active ? tab.color : 'var(--text-muted)' }}
                      />
                      <span className="min-w-0">
                        <span
                          className="block text-[10px] font-mono font-bold tracking-wider leading-tight"
                          style={{ color: active ? tab.color : 'var(--text-secondary)' }}
                        >
                          {tab.label}
                        </span>
                        <span className="block text-[10px] font-mono text-[var(--text-muted)] leading-snug">
                          {tab.blurb}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {toolFilter && !TABS.some(matchesFilter) && (
          <div className="text-[11px] font-mono text-[var(--text-muted)] py-3 text-center">
            No tool matches “{toolFilter}”.
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[var(--border-secondary)] flex-shrink-0">
        <button
          onClick={handleSelfTrack}
          disabled={loading}
          className={`w-full py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${loading ? 'opacity-60 cursor-wait' : 'hover:bg-[var(--hover-accent)]'}`}
          style={{ borderColor: 'rgba(0, 230, 118, 0.25)' }}
        >
          <LocateFixed className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: '#00E676' }} />
          <span className="font-mono font-bold tracking-[0.1em] text-[11px]" style={{ color: '#00E676' }}>
            {loading ? 'TRACKING…' : 'SELF TRACK'}
          </span>
        </button>
      </div>
    </div>
  );
}
