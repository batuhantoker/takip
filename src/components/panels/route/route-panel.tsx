'use client';

import { useIsMobile } from '@/components/ui/use-is-mobile';
import { cx } from '@/components/ui/class-names';
import { countAction } from '@/lib/platform/usage-actions';
import DirectionsBar from './directions-bar';
import type { Directions } from './use-directions';

/* In the panel on a desktop, at the top of a phone. It stays mounted through a
   running session: unmounting it would discard the route you are driving, so
   ending guidance would drop you into an empty form instead of back onto it.
   On a phone it shares the top of the screen with the guidance, so it steps aside. */
export default function RoutePlanner({ directions: d, center, onLocate, onClose }: {
  directions: Directions;
  center: { lat: number; lng: number } | null;
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  const guiding = Boolean(d.navSession);
  const hidden = guiding && mobile;
  return (
    <div
      aria-hidden={hidden}
      className={cx(
        'flex min-h-0 flex-1 flex-col transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none',
        hidden && 'pointer-events-none h-0 overflow-hidden opacity-0',
      )}
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
          countAction('route.navigate');
          d.setNavSession({ route: r, label, key: Date.now() });
          d.setFollowUser(true);
        }}
        guiding={guiding}
        onEndNavigation={() => { d.setNavSession(null); d.setNavProgress(null); d.setFollowUser(false); }}
        onLocate={onLocate}
        onClose={onClose}
      />
    </div>
  );
}
