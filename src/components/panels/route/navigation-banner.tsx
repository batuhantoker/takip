'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { NavProgress } from '@/lib/places/route/navigation';
import type { ActiveRoute, NavSession } from '@/components/shell/state/types';
import type { LiveLocation } from './directions-bar';
import NavigationView from '@/components/panels/route/parts/navigation-view';

export default function NavigationBanner({ navSession, setNavSession, liveLocation, setNavProgress, followUser, setFollowUser, setActiveRoute, children }: {
  navSession: NavSession | null;
  setNavSession: Dispatch<SetStateAction<NavSession | null>>;
  liveLocation: LiveLocation | null;
  setNavProgress: Dispatch<SetStateAction<NavProgress | null>>;
  followUser: boolean;
  setFollowUser: Dispatch<SetStateAction<boolean>>;
  setActiveRoute: Dispatch<SetStateAction<ActiveRoute | null>>;
  children: ReactNode;
}) {
  return (
    // Centred over the map, not the window: the sidebar and an open panel sit to its left. On a phone it clears the header.
    <div className="pointer-events-auto absolute top-3 z-[400] max-md:top-[calc(64px+env(safe-area-inset-top))] flex w-[min(92vw,400px)] -translate-x-1/2 flex-col gap-2" style={{ left: 'calc((100% + var(--shell-left, 0px)) / 2)' }}>
      {navSession ? (
        <div className="transition-[opacity,translate] duration-150 ease-out starting:-translate-y-2 starting:opacity-0 motion-reduce:transition-none">
          <NavigationView
            key={navSession.key}
            route={navSession.route}
            destinationLabel={navSession.label}
            fix={liveLocation}
            onProgress={setNavProgress}
            following={followUser}
            onRecenter={() => setFollowUser(true)}
            onExit={() => { setNavSession(null); setNavProgress(null); setFollowUser(false); }}
            onReroute={async (fromPt) => {
              // Re-plan from where the driver actually is, to the same destination.
              const dest = navSession.route.geometry.coordinates.at(-1)!;
              try {
                const res = await fetch(
                  `/api/v1/directions?from=${fromPt.lat},${fromPt.lng}&to=${dest[1]},${dest[0]}&mode=auto`,
                );
                const data = await res.json();
                if (res.ok && !data.error) {
                  setNavSession((n) => (n ? { ...n, route: data, key: Date.now() } : n));
                  setActiveRoute({ ...data, from: fromPt, to: { lat: dest[1], lng: dest[0] } });
                }
              } catch { /* keep the old route rather than dropping guidance */ }
            }}
          />
        </div>
      ) : null}

      {children}
    </div>
  );
}
