'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Radar, Minimize2 } from 'lucide-react';
import { TABS, type ToolDef } from './recon-tools';

export function ExpandedView({ currentTab, setIsFullScreen, rail, children }: {
  currentTab: ToolDef | undefined;
  setIsFullScreen: (v: boolean) => void;
  rail: ReactNode;
  children: ReactNode;
}) {
  const fullScreenNode = (
    <div className="fixed inset-4 z-[999] flex items-center justify-center">
      {/* Click-away backdrop; Escape also exits. */}
      <div className="absolute inset-[-1rem] bg-black/60 backdrop-blur-sm" onClick={() => setIsFullScreen(false)} />

      <div className="relative w-full h-full max-w-[1500px] glass-panel bg-[#0a0a09]/97 backdrop-blur-2xl border border-[var(--cyan-primary)]/40 rounded-xl flex flex-col overflow-hidden shadow-2xl shadow-[var(--cyan-primary)]/20">
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--border-secondary)] bg-[#111] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Radar className="w-5 h-5 text-[var(--cyan-primary)] flex-shrink-0" />
            <span className="hud-text text-[16px] text-[var(--text-primary)]">TAKIP RECON TOOLKIT</span>
            <span className="gotham-tag gotham-tag--classified" style={{ fontSize: '9px' }}>{TABS.length} MODULES</span>
            {currentTab && (
              <>
                <span className="text-[var(--text-muted)]/40">/</span>
                <span className="flex items-center gap-1.5 min-w-0">
                  <currentTab.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: currentTab.color }} />
                  <span className="text-[11px] font-mono font-bold tracking-wider truncate" style={{ color: currentTab.color }}>
                    {currentTab.label}
                  </span>
                </span>
              </>
            )}
          </div>
          <button onClick={() => setIsFullScreen(false)} className="p-2 hover:bg-white/5 rounded transition-colors text-[var(--text-muted)] hover:text-white flex-shrink-0" title="Exit expanded view (Esc)">
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Two panes: the toolkit stays visible while results use the width. */}
        <div className="flex-1 flex min-h-0">
          <aside className="w-[260px] flex-shrink-0 border-r border-[var(--border-secondary)] bg-[#0d0d0c]/60">
            {rail}
          </aside>
          <main className="flex-1 min-w-0 overflow-y-auto p-6 styled-scrollbar">
            <div className="w-full full-screen-mode-content max-w-[1000px]">
              {currentTab && (
                <div className="mb-4">
                  <div className="flex items-center gap-2.5 mb-1">
                    <currentTab.icon className="w-5 h-5" style={{ color: currentTab.color }} />
                    <h2 className="text-[15px] font-mono font-bold tracking-widest" style={{ color: currentTab.color }}>
                      {currentTab.label}
                    </h2>
                  </div>
                  <p className="text-[11px] font-mono text-[var(--text-muted)]">{currentTab.blurb}</p>
                </div>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(fullScreenNode, document.body) : fullScreenNode;
}
