'use client';

import { Search, XCircle } from 'lucide-react';
import { GROUPS, TABS, type ToolDef } from './recon-tools';

export function ToolGrid({ toolFilter, setToolFilter, matchesFilter, activeTab, selectTool }: {
  toolFilter: string;
  setToolFilter: (v: string) => void;
  matchesFilter: (t: ToolDef) => boolean;
  activeTab: string;
  selectTool: (id: string) => void;
}) {
  return (
    <div className="mt-2">
      <div className="relative mb-1.5">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
        <input
          value={toolFilter}
          onChange={e => setToolFilter(e.target.value)}
          placeholder="Filter tools…"
          className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-7 pr-6 py-1.5 text-[10px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none"
        />
        {toolFilter && (
          <button onClick={() => setToolFilter('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white">
            <XCircle className="w-3 h-3" />
          </button>
        )}
      </div>

      {GROUPS.map(group => {
        const tools = TABS.filter(t => t.group === group.id && t.id !== 'sweep' && matchesFilter(t));
        if (!tools.length) return null;
        return (
          <div key={group.id} className="mb-2 last:mb-0">
            <div className="text-[9px] font-mono tracking-[0.18em] text-[var(--text-muted)]/60 mb-1">{group.label}</div>
            <div className="grid grid-cols-4 gap-1">
              {tools.map(tab => (
                <button key={tab.id} onClick={() => selectTool(tab.id)}
                  title={tab.blurb}
                  className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-[9px] font-mono tracking-wider transition-all border ${activeTab === tab.id ? 'border-opacity-40 bg-opacity-15' : 'border-transparent hover:bg-[var(--hover-accent)]'}`}
                  style={{ borderColor: activeTab === tab.id ? tab.color : 'transparent', backgroundColor: activeTab === tab.id ? `${tab.color}15` : undefined, color: activeTab === tab.id ? tab.color : 'var(--text-muted)' }}>
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="leading-tight text-center w-full">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {toolFilter && !TABS.some(t => t.id !== 'sweep' && matchesFilter(t)) && (
        <div className="text-[10px] font-mono text-[var(--text-muted)] py-2 text-center">
          No tool matches “{toolFilter}”.
        </div>
      )}
    </div>
  );
}
