'use client';

import type { ReactNode } from 'react';
import AdSlot from '@/components/ads/ad-slot';
import { AD_SLOTS } from '@/lib/ads';

/** What the sidebar can open beside it, one at a time. */
export type ToolId = 'layers' | 'oi' | 'draw' | 'alerts' | 'recon' | 'directions' | 'space' | 'arcgis' | 'markets';

/** Sidebar width, and the panel column that opens beside it. Search and the map cluster keep clear of both. */
export const NAV_WIDTH = 72;
export const DOCK_WIDTH = 400;

/** Browsing panels carry an ad underneath; tools mid-task (TI, drawing, routes, recon) never do. */
const AD_TOOLS: ReadonlySet<ToolId> = new Set(['layers', 'alerts', 'space', 'arcgis', 'markets']);

/** The column a tool opens into: beside the sidebar, above the status bar. */
export function Dock({ tool, children }: { tool: ToolId | null; children: ReactNode }) {
  return (
    <div data-hud className="absolute top-0 bottom-7 z-[250] flex flex-col p-2 pointer-events-none *:pointer-events-auto"
      style={{ left: NAV_WIDTH, width: DOCK_WIDTH + 16 }}>
      {children}
      <AdSlot slot={AD_SLOTS.panel} variant="panel" visible={tool !== null && AD_TOOLS.has(tool)}
        className="glass-panel shrink-0 mt-2 p-2" />
    </div>
  );
}
