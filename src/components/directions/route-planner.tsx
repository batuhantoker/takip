'use client';

import { motion } from 'framer-motion';
import DirectionsBar from './directions-bar';
import type { Directions } from './use-directions';

/* In the panel on a desktop, at the top of a phone. It stays mounted underneath
   a running session: unmounting it would discard the route you are driving, so
   ending guidance would drop you into an empty form instead of back onto it. */
export default function RoutePlanner({ directions: d, center, onLocate, onClose }: {
  directions: Directions;
  center: { lat: number; lng: number } | null;
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: d.navSession ? 0 : 1, y: 0 }}
      className={d.navSession ? 'pointer-events-none h-0 overflow-hidden' : ''}
      aria-hidden={Boolean(d.navSession)}
    >
      <DirectionsBar
        key={d.routeTarget?.ts ?? 'plan'}
        initialTo={d.routeTarget}
        center={center}
        onRoute={(r) => d.setActiveRoute(r)}
        onLiveLocation={d.setLiveLocation}
        onFollowChange={d.setFollowUser}
        onActiveSegment={(seg) => d.setActiveRoute((r) => (r ? { ...r, activeSegment: seg } : r))}
        onStartNavigation={(r, label) => {
          d.setNavSession({ route: r, label, key: Date.now() });
          d.setFollowUser(true);
        }}
        onLocate={onLocate}
        onClose={onClose}
      />
    </motion.div>
  );
}
