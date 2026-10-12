'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import type { NavProgress } from '@/lib/navigation';
import type { ActiveRoute, NavSession } from '@/components/shell/dashboard-types';
import type { LiveLocation } from './directions-bar';
import NavigationView from './navigation-view';

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
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] w-[min(92vw,384px)] pointer-events-auto">
      {navSession ? (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
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
        </motion.div>
      ) : null}

      {children}
    </div>
  );
}
