'use client';

import { useEffect, type RefObject } from 'react';
import { alertPinFeatures, type AlertPinFeature, type PinnedReport } from '@/lib/intel/alerts/map-pins';
import type { LayerHookArgs } from '@/components/map/types';

export function useLiveNewsLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    setGeo('live-news', activeLayers.live_news && data.live_feeds ? data.live_feeds.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { id: f.id, name: f.name, city: f.city, country: f.country, language: f.language, url: f.url, watch: f.watch_url, category: f.category, embed_allowed: f.embed_allowed !== false, offline: f.live === false } })) : []);
  }, [mapReady, data.live_feeds, activeLayers.live_news, setGeo]);
}

interface AlertPinArgs extends LayerHookArgs {
  alertPinsRef: RefObject<AlertPinFeature[]>;
  alertPinIds: string[] | null;
}

export function useAlertPins({ mapRef, mapReady, data, activeLayers, setGeo, alertPinsRef, alertPinIds }: AlertPinArgs) {
  // Live Alert pins. Kept whole in the ref even when the layer is off, so the
  // feed's locate button can still open a report's pin.
  useEffect(() => {
    if (!mapReady) return;
    const reports: PinnedReport[] = Array.isArray(data.alert_pins) ? data.alert_pins : [];
    alertPinsRef.current = alertPinFeatures(reports, alertPinIds);
    setGeo('alert-pins', activeLayers.alert_pins ? alertPinsRef.current : []);
  }, [mapReady, data.alert_pins, activeLayers.alert_pins, alertPinIds, setGeo, alertPinsRef]);

  /* The newest reports pulse, so something that just landed catches the eye
     without the other pins moving. Same 200ms tick the malware ring uses. */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeLayers.alert_pins) return;
    const map = mapRef.current;
    const tick = () => {
      try {
        map.setPaintProperty('alert-pin-pulse', 'circle-radius', 9 + Math.sin(Date.now() / 260) * 3.5);
        map.setPaintProperty('alert-pin-pulse', 'circle-stroke-opacity', 0.55 + Math.sin(Date.now() / 260) * 0.25);
      } catch { /* style not settled yet */ }
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [mapReady, activeLayers.alert_pins, mapRef]);
}
