'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NavProgress } from '@/lib/navigation';
import type { ActiveRoute, NavSession } from '@/components/shell/dashboard-types';
import type { LiveLocation } from './directions-bar';

export type RouteTarget = { label: string; context?: string; lat: number; lng: number; kind?: string; ts: number };

/** Route planning and turn-by-turn guidance: what the planner, the banner and the map share. */
export function useDirections() {
  // The planner is mounted; it stays mounted while another tool has the panel, so the route survives.
  const [showDirections, setShowDirections] = useState(false);
  // A destination Search hands over ("Directions to here"); its stamp remounts the planner with it.
  const [routeTarget, setRouteTarget] = useState<RouteTarget | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [followUser, setFollowUser] = useState(false);
  const [navSession, setNavSession] = useState<NavSession | null>(null);
  const [navProgress, setNavProgress] = useState<NavProgress | null>(null);

  // A session owns its own position watch: the planner's dies with the planner when guidance takes over,
  // and without this the banner sits on "waiting for a fix" forever.
  useEffect(() => {
    if (!navSession) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setLiveLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
      }),
      () => { /* the view already explains the HTTPS requirement */ },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [navSession]);

  const closeDirections = useCallback(() => { setShowDirections(false); setActiveRoute(null); setRouteTarget(null); }, []);

  /** Where to draw the viewer: snapped to the route while guiding. */
  const userLocation = navSession && navProgress
    ? { lat: navProgress.snapped[1], lng: navProgress.snapped[0], accuracy: liveLocation?.accuracy, heading: liveLocation?.heading }
    : liveLocation;

  return {
    showDirections, setShowDirections, routeTarget, setRouteTarget, activeRoute, setActiveRoute,
    liveLocation, setLiveLocation, followUser, setFollowUser, navSession, setNavSession, setNavProgress,
    closeDirections, userLocation,
  };
}

export type Directions = ReturnType<typeof useDirections>;
