'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { OiMark } from '@/components/oi/atoms';

/** The tools that open in the right-hand dock, one at a time. */
export type ToolId = 'oi' | 'draw' | 'alerts' | 'recon' | 'directions' | 'space' | 'arcgis' | 'markets';

export interface RailTool {
  id: ToolId;
  label: string;
  title: string;
  icon: LucideIcon;
  /** Any CSS colour; the active button is tinted with it. */
  tint: string;
  badge?: number;
}

const TOOLTIP = 'absolute top-1/2 -translate-y-1/2 px-2 py-1 text-[9px] font-mono tracking-wider text-white/80 bg-black/80 backdrop-blur-sm rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none';

function RailButton({ tool, active, onSelect }: { tool: RailTool; active: boolean; onSelect: (id: ToolId) => void }) {
  const Icon = tool.icon;
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => onSelect(tool.id)}
        title={tool.title}
        aria-label={tool.label}
        aria-pressed={active}
        className="relative w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
        style={active ? { background: `color-mix(in srgb, ${tool.tint} 20%, transparent)` } : undefined}
      >
        <Icon className="w-4 h-4" style={{ color: active ? tool.tint : 'rgba(255,255,255,0.6)' }} />
        {active && <span aria-hidden className="absolute -right-1 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full" style={{ background: tool.tint }} />}
        {!!tool.badge && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-black text-[9px] font-mono font-bold leading-none px-0.5" style={{ background: tool.tint }}>
            {tool.badge}
          </span>
        )}
      </button>
      <span className={`${TOOLTIP} right-11 group-hover:opacity-100 group-focus-within:opacity-100`}>{tool.label.toUpperCase()}</span>
    </div>
  );
}

/** OI gets the biggest button, in its own colours, with a pulse while a forecast runs. */
function OiButton({ active, live, running, onSelect }: { active: boolean; live: boolean; running: boolean; onSelect: (id: ToolId) => void }) {
  return (
    // A named group: an unnamed one would light every group-hover style inside the OI panel too.
    <div className="relative group/oi">
      <button
        type="button"
        onClick={() => onSelect('oi')}
        title="OI — talk to it and it works the map for you, or run a forecast, on your own AI key (O)"
        aria-label="OI"
        aria-pressed={active}
        className={`relative w-11 h-11 rounded-full flex flex-col items-center justify-center gap-[3px] border transition-all duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${active ? 'bg-[var(--gold-primary)]/20 border-[var(--gold-primary)]/70 shadow-[0_0_18px_rgba(var(--gold-rgb),0.35)]' : 'bg-[var(--gold-primary)]/[0.07] border-[var(--gold-primary)]/35 hover:bg-[var(--gold-primary)]/15 hover:border-[var(--gold-primary)]/60 hover:shadow-[0_0_14px_rgba(var(--gold-rgb),0.25)]'}`}
      >
        <OiMark size={18} live={live} />
        <span className={`text-[7.5px] font-mono font-semibold tracking-[0.2em] leading-none pl-[0.2em] ${active ? 'text-[var(--gold-light)]' : 'text-[var(--gold-primary)]'}`}>OI</span>
        {active && <span aria-hidden className="absolute -right-1 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-[var(--gold-primary)]" />}
        {running && <span aria-hidden className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[var(--gold-light)] border border-black/60 animate-pulse" />}
      </button>
      {!active && <span className={`${TOOLTIP} right-14 group-hover/oi:opacity-100 group-focus-within/oi:opacity-100`}>OI · ASSIST &amp; FORECAST</span>}
    </div>
  );
}

/** The dock's tabs: OI first, then each group of tools, divided by a rule. */
export function ToolRail({ groups, active, onSelect, oiLive, oiRunning }: {
  groups: RailTool[][];
  active: ToolId | null;
  onSelect: (id: ToolId) => void;
  oiLive: boolean;
  oiRunning: boolean;
}) {
  return (
    <>
      <OiButton active={active === 'oi'} live={oiLive} running={oiRunning} onSelect={onSelect} />
      {groups.map((group, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div className="w-4 h-px bg-white/10" />
          {group.map(tool => <RailButton key={tool.id} tool={tool} active={active === tool.id} onSelect={onSelect} />)}
        </div>
      ))}
    </>
  );
}

/** The column every tool opens into: under the header, above the status bar, beside the rail. */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <div data-hud className="absolute top-[64px] right-[56px] bottom-10 w-[400px] z-[250] flex flex-col pointer-events-none *:pointer-events-auto">
      {children}
    </div>
  );
}
