'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { loadRecent, rememberPlace, type RecentPlace } from '@/lib/places/recent-places';
import type { LiveLocation, Place, RouteResult } from '@/lib/places/route/plan';
import { noteDeviceLocation } from '@/lib/platform/device-location';
import { countAction } from '@/lib/platform/usage-actions';

export interface RoutePlannerCallbacks {
  onRoute: (route: (RouteResult & {
    from: Place;
    to: Place;
    alternates?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
    activeSegment?: [number, number][] | null;
  }) | null) => void;
  onLocate?: (lat: number, lng: number, zoom?: number) => void;
  /** Live position, when tracking is on, so the map can draw the dot. */
  onLiveLocation?: (loc: LiveLocation | null) => void;
  /** Selected step segment, for highlighting the leg on the map. */
  onActiveSegment?: (seg: [number, number][] | null) => void;
  onFollowChange?: (follow: boolean) => void;
}

export function useRoutePlanner(
  { onRoute, onLocate, onLiveLocation, onActiveSegment, onFollowChange }: RoutePlannerCallbacks,
  initialTo: Place | null,
) {
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState(initialTo?.label ?? '');
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(initialTo);
  const [mode, setMode] = useState<string>('auto');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveLocation | null>(null);
  const [tracking, setTracking] = useState(false);
  const [follow, setFollow] = useState(false);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [chosen, setChosen] = useState(0);
  const [vias, setVias] = useState<Array<{ place: Place | null; text: string }>>([]);
  const [avoid, setAvoid] = useState({ tolls: false, highways: false, ferries: false });
  const [showOptions, setShowOptions] = useState(false);
  const [recent, setRecent] = useState<RecentPlace[]>(() => (typeof window === 'undefined' ? [] : loadRecent()));
  const watchId = useRef<number | null>(null);

  /** Remember a place picked for the route, for the next time a field is empty. */
  const remember = (p: Place) => {
    if (p.kind === 'current') return;
    setRecent(rememberPlace({ label: p.label, context: p.context, lat: p.lat, lng: p.lng, kind: p.kind }));
  };

  const runRoute = useCallback(async (
    a: Place,
    b: Place,
    m: string,
    stops: Place[] = [],
    av: { tolls: boolean; highways: boolean; ferries: boolean } = { tolls: false, highways: false, ferries: false },
  ) => {
    setLoading(true);
    setError(null);
    setActiveStep(null);
    try {
      const viaParam = stops.length
        ? `&via=${stops.map((p) => `${p.lat},${p.lng}`).join('|')}` : '';
      const avoidList = Object.entries(av).filter(([, on]) => on).map(([k]) => k);
      const avoidParam = avoidList.length ? `&avoid=${avoidList.join(',')}` : '';
      const res = await fetch(
        `/api/v1/directions?from=${a.lat},${a.lng}&to=${b.lat},${b.lng}&mode=${m}${viaParam}${avoidParam}`,
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        setRoute(null);
        setRoutes([]);
        onRoute(null);
        setError(data.error || 'No route found');
      } else {
        const all: RouteResult[] = data.routes?.length ? data.routes : [data];
        setRoutes(all);
        setChosen(0);
        setRoute(all[0]);
        countAction('route.plan');
        onRoute({ ...all[0], from: a, to: b, alternates: all.slice(1).map((r) => r.geometry) });
      }
    } catch {
      setRoute(null);
      setRoutes([]);
      onRoute(null);
      setError('Routing service unreachable');
    }
    setLoading(false);
  }, [onRoute]);

  /** Current intermediate stops that actually resolved to a place. */
  const stops = useCallback(
    () => vias.map((v) => v.place).filter((p): p is Place => p !== null),
    [vias],
  );

  /** Continuous position updates — the moving dot, not a one-shot fix. */
  const toggleTracking = useCallback(() => {
    if (tracking) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setTracking(false);
      setFollow(false);
      onFollowChange?.(false);
      setLive(null);
      onLiveLocation?.(null);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('This browser has no geolocation');
      return;
    }

    setLocateError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        noteDeviceLocation(pos.coords);
        const loc: LiveLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        };
        setLive(loc);
        onLiveLocation?.(loc);
        setTracking(true);
      },
      () => {
        setLocateError('Location permission denied — needs HTTPS or localhost');
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    setTracking(true);
  }, [tracking, onLiveLocation, onFollowChange]);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  /**
   * Fill the origin with wherever the operator is.
   *
   * Tries the browser first (precise, but needs permission and a secure
   * context), then falls back to TAKIP's existing IP geolocation, which needs
   * neither — so this still does something useful when permission is denied.
   */
  const useMyLocation = useCallback(async () => {
    setLocating(true);
    setLocateError(null);

    const apply = (lat: number, lng: number, label: string) => {
      const place: Place = { label, lat, lng, kind: 'current' };
      setFromText(label);
      setFrom(place);
      onLocate?.(lat, lng, 14);
      if (to) runRoute(place, to, mode, stops(), avoid);
    };

    const browser = await new Promise<GeolocationPosition | null>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    });

    if (browser) {
      noteDeviceLocation(browser.coords);
      const { latitude, longitude } = browser.coords;
      apply(latitude, longitude, 'My location');
      setLocating(false);
      return;
    }

    try {
      const res = await fetch('/api/geo');
      const d = await res.json();
      if (d?.lat && d?.lon) {
        apply(d.lat, d.lon, d.city ? `Near ${d.city}` : 'Approximate location');
        setLocateError('Approximate — from network location');
      } else {
        setLocateError('Could not determine your location');
      }
    } catch {
      setLocateError('Could not determine your location');
    }
    setLocating(false);
  }, [to, mode, runRoute, onLocate, stops, avoid]);

  const pickFrom = (p: Place) => { setFrom(p); remember(p); if (to) runRoute(p, to, mode, stops(), avoid); };
  const pickTo = (p: Place) => { setTo(p); remember(p); if (from) runRoute(from, p, mode, stops(), avoid); };
  const pickMode = (m: string) => { setMode(m); if (from && to) runRoute(from, to, m, stops(), avoid); };

  /** A recent place, from the empty state: the destination first, then the start. */
  const pickRecent = (p: Place) => {
    if (!to) { setToText(p.label); pickTo(p); }
    else { setFromText(p.label); pickFrom(p); }
  };

  /** Empty one end of the route: the route goes with it. */
  const clearEnd = (end: 'from' | 'to') => {
    if (end === 'from') { setFrom(null); setFromText(''); } else { setTo(null); setToText(''); }
    setRoute(null);
    setRoutes([]);
    setError(null);
    setActiveStep(null);
    onRoute(null);
  };

  const pickVia = (i: number, p: Place) => {
    const next = vias.map((v, j) => (j === i ? { place: p, text: p.label } : v));
    setVias(next);
    remember(p);
    const all = next.map((v) => v.place).filter((x): x is Place => x !== null);
    if (from && to) runRoute(from, to, mode, all, avoid);
  };

  const removeVia = (i: number) => {
    const next = vias.filter((_, j) => j !== i);
    setVias(next);
    const all = next.map((v) => v.place).filter((x): x is Place => x !== null);
    if (from && to) runRoute(from, to, mode, all, avoid);
  };

  const toggleAvoid = (key: 'tolls' | 'highways' | 'ferries') => {
    const next = { ...avoid, [key]: !avoid[key] };
    setAvoid(next);
    if (from && to) runRoute(from, to, mode, stops(), next);
  };

  const swap = () => {
    setFrom(to); setTo(from);
    setFromText(toText); setToText(fromText);
    // Reverse the intermediate stops too, or the trip back visits them backwards.
    const reversed = [...vias].reverse();
    setVias(reversed);
    if (from && to) {
      runRoute(to, from, mode, reversed.map((v) => v.place).filter((x): x is Place => x !== null), avoid);
    }
  };

  const chooseRoute = (i: number) => {
    const r = routes[i];
    setChosen(i);
    setRoute(r);
    setActiveStep(null);
    onActiveSegment?.(null);
    if (from && to) onRoute({ ...r, from, to, alternates: routes.filter((_, j) => j !== i).map((x) => x.geometry) });
  };

  return {
    fromText, setFromText, toText, setToText, from, to, mode, route, loading, error, activeStep, setActiveStep,
    locating, locateError, live, tracking, follow, setFollow, routes, chosen, vias, setVias, avoid,
    showOptions, setShowOptions, recent, toggleTracking, useMyLocation,
    pickFrom, pickTo, pickMode, pickRecent, clearEnd, pickVia, removeVia, toggleAvoid, swap, chooseRoute,
  };
}
