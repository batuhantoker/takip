'use client';

import { useEffect } from 'react';
import { activeLocale } from '@/lib/core/i18n/active';
import { snapBox } from '@/lib/feeds/reference/view';
import { setAttractionsData, setAttractionsVisible } from '@/lib/places/attractions/map-layers';
import { spotsUrl, type SpotCollection } from '@/lib/places/attractions/spots';
import { FIRST_ZOOM } from '@/lib/places/attractions/zoom';
import type { LayerHookArgs } from '@/components/map/types';

const SETTLE_MS = 250;

/** Things to do (lib/places/attractions) for the view, asked for again whenever the map settles somewhere new. */
export function useAttractionsLayer({ mapRef, mapReady, activeLayers }: Pick<LayerHookArgs, 'mapRef' | 'mapReady' | 'activeLayers'>) {
  const on = !!activeLayers.things_to_do;

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    setAttractionsVisible(map, on);
    if (!on) {
      setAttractionsData(map, null);
      return;
    }

    let request: AbortController | null = null;
    let loaded = '';
    let settle: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const zoom = Math.floor(map.getZoom());
      if (zoom < FIRST_ZOOM) {
        request?.abort();
        loaded = '';
        setAttractionsData(map, null);
        return;
      }
      const b = map.getBounds();
      const url = spotsUrl(snapBox({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }, zoom), zoom, activeLocale());
      if (url === loaded) return;
      request?.abort();
      const ctl = (request = new AbortController());
      loaded = url;
      try {
        const res = await fetch(url, { signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json() as SpotCollection;
        if (request === ctl) setAttractionsData(map, body);
      } catch {
        if (ctl.signal.aborted) return;
        // Asked for again on the next move.
        if (loaded === url) loaded = '';
      }
    };
    const onMove = () => {
      clearTimeout(settle);
      settle = setTimeout(load, SETTLE_MS);
    };

    map.on('moveend', onMove);
    void load();
    return () => {
      map.off('moveend', onMove);
      clearTimeout(settle);
      request?.abort();
    };
  }, [mapReady, on, mapRef]);
}
