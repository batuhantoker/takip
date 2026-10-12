'use client';

import type { ReactNode } from 'react';

/** What the sidebar can open beside it, one at a time. */
export type ToolId = 'layers' | 'oi' | 'draw' | 'alerts' | 'recon' | 'directions' | 'space' | 'arcgis' | 'markets';

/** Sidebar width, and the panel column that opens beside it. Search and the map cluster keep clear of both. */
export const NAV_WIDTH = 72;
export const DOCK_WIDTH = 400;

/** The column a tool opens into: beside the sidebar, above the status bar. */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <div data-hud className="absolute top-0 bottom-7 z-[250] flex flex-col p-2 pointer-events-none *:pointer-events-auto"
      style={{ left: NAV_WIDTH, width: DOCK_WIDTH + 16 }}>
      {children}
    </div>
  );
}
