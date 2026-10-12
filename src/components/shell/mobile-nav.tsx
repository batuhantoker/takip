'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Layers, Newspaper, Search, Route, Radar, Orbit } from 'lucide-react';
import type { ActiveRoute, MobilePanel, NavSession } from './dashboard-types';

export default function MobileNav({ mobilePanel, setMobilePanel, showDirections, setShowDirections, navSession, setActiveRoute }: {
  mobilePanel: MobilePanel | null;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  showDirections: boolean;
  setShowDirections: Dispatch<SetStateAction<boolean>>;
  navSession: NavSession | null;
  setActiveRoute: Dispatch<SetStateAction<ActiveRoute | null>>;
}) {
  return (
    <div className="mobile-nav">
      <div className="glass-panel mobile-nav-inner">
        {[
          { id: 'layers' as const, icon: Layers, label: 'LAYERS' },
          { id: 'intel' as const, icon: Newspaper, label: 'INTEL' },
          { id: 'recon' as const, icon: Radar, label: 'RECON' },
          { id: 'oi' as const, icon: Orbit, label: 'OI' },
          { id: 'search' as const, icon: Search, label: 'SEARCH' },
          // Routing was reachable only from the desktop tool rail, so a
          // phone could not open it at all. It sits next to SEARCH
          // because both answer "take me somewhere".
          { id: 'route' as const, icon: Route, label: 'ROUTE' },
        ].map(tab => {
          // Routing opens the planner at the top of the screen rather than
          // the bottom drawer — it needs the room above the keyboard, and
          // guidance has to stay readable while you drive.
          const isRoute = tab.id === 'route';
          const active = isRoute ? showDirections || Boolean(navSession) : mobilePanel === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isRoute) {
                  // Mid-drive this must not touch anything: closing the
                  // planner clears the active route, which would take the
                  // line off the map underneath a driver. Guidance is
                  // ended from the navigation view's own exit.
                  if (navSession) return;
                  setMobilePanel(null);
                  setShowDirections((open) => {
                    if (open) setActiveRoute(null);
                    return !open;
                  });
                  return;
                }
                setMobilePanel(mobilePanel === tab.id ? null : tab.id);
              }}
              aria-pressed={active}
              disabled={isRoute && Boolean(navSession)}
              className={`mobile-nav-btn ${active ? 'active' : ''}`}
            >
              <tab.icon className={`w-4 h-4 ${tab.id === 'recon' ? 'text-[var(--cyan-primary)]' : ''}`} />
              <span className={tab.id === 'recon' ? 'text-[var(--cyan-primary)]' : ''}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
