'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Layers, Radar, Route, Search, TriangleAlert } from 'lucide-react';
import { OiMark } from '@/components/panels/ti-agent/atoms';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { ActiveRoute, MobilePanel, NavSession } from '@/components/shell/state/types';

type Tab = { id: MobilePanel | 'route'; label: string; glyph: ReactNode };

const ICON = 'size-[18px]';
const TABS: Tab[] = [
  { id: 'layers', label: 'Layers', glyph: <Layers className={ICON} strokeWidth={1.75} /> },
  { id: 'intel', label: 'Alerts', glyph: <TriangleAlert className={ICON} strokeWidth={1.75} /> },
  { id: 'recon', label: 'Recon', glyph: <Radar className={ICON} strokeWidth={1.75} /> },
  { id: 'oi', label: 'TI', glyph: <OiMark size={18} /> },
  { id: 'search', label: 'Search', glyph: <Search className={ICON} strokeWidth={1.75} /> },
  // Search and Route sit together: both answer "take me somewhere".
  { id: 'route', label: 'Route', glyph: <Route className={ICON} strokeWidth={1.75} /> },
];

/** The phone's bottom bar: one sheet at a time, and Route, which opens at the top instead. */
export default function MobileNav({ mobilePanel, setMobilePanel, showDirections, setShowDirections, navSession, setActiveRoute }: {
  mobilePanel: MobilePanel | null;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  showDirections: boolean;
  setShowDirections: Dispatch<SetStateAction<boolean>>;
  navSession: NavSession | null;
  setActiveRoute: Dispatch<SetStateAction<ActiveRoute | null>>;
}) {
  return (
    <nav data-hud aria-label="Tools"
      className="fixed inset-x-0 bottom-0 z-[450] border-t border-line bg-surface-1 px-1 pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-14 items-stretch gap-0.5 py-1">
        {TABS.map(tab => {
          // The route planner needs the room above the keyboard, and guidance has to stay readable while driving.
          const isRoute = tab.id === 'route';
          const active = isRoute ? showDirections || Boolean(navSession) : mobilePanel === tab.id;
          return (
            <button key={tab.id} type="button" aria-pressed={active}
              // Mid-drive this must not clear the route under the driver; guidance ends from its own exit.
              disabled={isRoute && Boolean(navSession)}
              onClick={() => {
                if (!isRoute) { setMobilePanel(mobilePanel === tab.id ? null : tab.id as MobilePanel); return; }
                setMobilePanel(null);
                setShowDirections(open => {
                  if (open) setActiveRoute(null);
                  return !open;
                });
              }}
              className={cx(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-card text-meta font-medium disabled:opacity-40',
                active ? (tab.id === 'oi' ? 'bg-gold-soft text-gold' : 'bg-surface-3 text-ink-1') : 'text-ink-3 active:bg-surface-2',
                FOCUS_RING,
                TRANSITION,
              )}>
              <span aria-hidden className="flex size-[18px] items-center justify-center">{tab.glyph}</span>
              <span className="max-w-full truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
