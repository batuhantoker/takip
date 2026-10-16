'use client';

import { useEffect } from 'react';
import {
  AIRPORT_WX_LAYERS, AIRPORT_WX_SOURCE, SIGMET_LAYERS, SIGMET_SOURCE,
  airportWxFeatures, setAviationWeatherData, setAviationWeatherVisible, sigmetFeatures,
} from '@/lib/feeds/aviation-weather/layers';
import type { AirportWx } from '@/lib/feeds/aviation-weather/metar';
import type { Sigmet } from '@/lib/feeds/aviation-weather/sigmet';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface AviationWeatherArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  /** Nothing is recorded yet; today's weather over a replayed past would mislead. */
  replayActive: boolean;
}

const REFRESH_MS = 5 * 60_000;

interface Feed {
  layers: string[];
  source: string;
  url: string;
  features: (json: unknown) => GeoJSON.Feature[];
}

const AIRPORTS: Feed = {
  layers: AIRPORT_WX_LAYERS, source: AIRPORT_WX_SOURCE, url: '/api/aviation-weather?kind=airports',
  features: json => airportWxFeatures((json as { airports?: AirportWx[] }).airports ?? []),
};
const SIGMETS: Feed = {
  layers: SIGMET_LAYERS, source: SIGMET_SOURCE, url: '/api/aviation-weather?kind=sigmets',
  features: json => sigmetFeatures((json as { sigmets?: Sigmet[] }).sigmets ?? []),
};

function useFeed(mapRef: MapRef, mapReady: boolean, on: boolean, feed: Feed) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    setAviationWeatherVisible(map, feed.layers, on);
    if (!on) {
      setAviationWeatherData(map, feed.source, []);
      return;
    }
    let request: AbortController | null = null;
    let next: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      clearTimeout(next);
      if (document.hidden) return;
      request?.abort();
      const ctl = (request = new AbortController());
      try {
        const res = await fetch(feed.url, { signal: ctl.signal });
        if (res.ok) setAviationWeatherData(map, feed.source, feed.features(await res.json()));
      } catch {
        if (ctl.signal.aborted) return;
        // A failed poll keeps what is drawn; the next one tries again.
      }
      if (request === ctl) next = setTimeout(load, REFRESH_MS);
    };
    const onVisibility = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisibility);
    void load();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(next);
      request?.abort();
    };
  }, [mapRef, mapReady, on, feed]);
}

/** Airport flight categories and SIGMET hazard areas, each fetched only while its layer is on. */
export function useAviationWeatherLayer({ mapRef, mapReady, activeLayers, replayActive }: AviationWeatherArgs) {
  useFeed(mapRef, mapReady, !!activeLayers.airport_weather && !replayActive, AIRPORTS);
  useFeed(mapRef, mapReady, !!activeLayers.sigmets && !replayActive, SIGMETS);
}
