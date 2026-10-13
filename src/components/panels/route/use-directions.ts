'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { NavProgress } from '@/lib/route/navigation';
import type { ActiveRoute, NavSession } from '@/components/shell/state/types';
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
  const [navSession, setNavSessionState] = useState<NavSession | null>(null);
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

  // Guidance outlives the planner: closing it mid-drive keeps the route drawn, and the drive ending then clears it.
  const closeDirections = useCallback(() => {
    setShowDirections(false);
    setRouteTarget(null);
    if (!navSession) setActiveRoute(null);
  }, [navSession]);
  const setNavSession = useCallback<Dispatch<SetStateAction<NavSession | null>>>((next) => {
    setNavSessionState(next);
    if (next === null && !showDirections) setActiveRoute(null);
  }, [showDirections]);

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
