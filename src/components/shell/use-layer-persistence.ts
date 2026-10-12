'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { saveLayers } from '@/lib/saved-layers';
import type { ActiveLayers } from '@/lib/default-layers';

export function useLayerPersistence({ activeLayers, setActiveLayers }: {
  activeLayers: ActiveLayers;
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
}) {
  // URL state: persist active layers only (lat/lon comes from IP geolocation on each load)
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const active = Object.entries(activeLayers).filter(([,v]) => v).map(([k]) => k).join(',');
      // A forecast being watched keeps its place in the address, so the address bar stays shareable.
      const oiRun = new URLSearchParams(window.location.search).get('oi');
      const url = `${window.location.pathname}?layers=${active}${oiRun ? `&oi=${encodeURIComponent(oiRun)}` : ''}`;
      window.history.replaceState(null, '', url);
    }, 1500);
  }, [activeLayers]);

  // OI focus: clear the globe of the other layers while a forecast draws,
  // and put back exactly what was on when focus ends.
  const [oiFocus, setOiFocus] = useState(false);
  const focusSaved = useRef<typeof activeLayers | null>(null);
  const toggleOiFocus = useCallback(() => {
    const saved = focusSaved.current;
    if (saved) {
      focusSaved.current = null;
      setActiveLayers(saved);
      setOiFocus(false);
      return;
    }
    const KEEP = new Set(['day_night', 'live_clouds', 'wx_temperature', 'wx_wind', 'wx_radar', 'terrain_3d', 'terrain_elevation']);
    setActiveLayers(prev => {
      focusSaved.current = prev;
      return Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, KEEP.has(k) ? v : false])) as typeof prev;
    });
    setOiFocus(true);
  }, []);

  // Skips the defaults so they never overwrite what is stored before it is read;
  // during OI focus the operator's own choice is what gets remembered.
  const defaultLayers = useRef(activeLayers);
  useEffect(() => {
    if (activeLayers !== defaultLayers.current) saveLayers(focusSaved.current ?? activeLayers);
  }, [activeLayers]);

  return { oiFocus, toggleOiFocus };
}
