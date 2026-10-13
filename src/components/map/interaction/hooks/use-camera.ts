'use client';

import { useEffect, type RefObject } from 'react';
import type { MapRef, WorldMapProps } from '@/components/map/types';

export function useDemoSpin({ mapRef, mapReady, demoMode }: { mapRef: MapRef; mapReady: boolean; demoMode: boolean }) {
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // ── DEMO MODE SPINNING ──
    let spinReq: number | undefined = undefined;
    let isSpinning = false;
    
    const startSpinning = () => {
      if (!map) return;
      isSpinning = true;
      let lastTime = performance.now();
      
      const frame = (time: number) => {
        if (!isSpinning) return;
        
        // Only spin if the user is not actively dragging or zooming the map
        if (!map.isMoving() && !map.isZooming()) {
          const dt = time - lastTime;
          const center = map.getCenter();
          // Adjust spin speed: 0.5 degrees per second
          center.lng += (0.5 * dt) / 1000;
          map.setCenter(center);
        }
        
        lastTime = time;
        spinReq = requestAnimationFrame(frame);
      };
      
      spinReq = requestAnimationFrame(frame);
    };

    if (demoMode) {
      startSpinning();
    } else {
      isSpinning = false;
      if (spinReq) cancelAnimationFrame(spinReq);
    }

    return () => {
      isSpinning = false;
      if (spinReq) cancelAnimationFrame(spinReq);
      if (typeof window !== 'undefined' && (window as any)._globeSpinTimer) {
        clearInterval((window as any)._globeSpinTimer);
      }
    };
  }, [mapReady, demoMode, mapRef]);
}

interface FlyToArgs {
  mapRef: MapRef;
  mapReady: boolean;
  flyToLocation: WorldMapProps['flyToLocation'];
  openAlertPinRef: RefObject<((id: string) => void) | null>;
}

export function useFlyTo({ mapRef, mapReady, flyToLocation, openAlertPinRef }: FlyToArgs) {
  // Fly-to
  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyToLocation) return;
    const map = mapRef.current;
    map.flyTo({ center: [flyToLocation.lng, flyToLocation.lat], zoom: flyToLocation.zoom ?? 8, duration: flyToLocation.duration ?? 2000 });
    const alertId = flyToLocation.alertId;
    if (!alertId) return;
    const open = () => openAlertPinRef.current?.(alertId);
    map.once('moveend', open);
    return () => { map.off('moveend', open); };
  }, [mapReady, flyToLocation, mapRef, openAlertPinRef]);
}

export function useMapCenter({ mapRef, mapReady, onMapCenter }: { mapRef: MapRef; mapReady: boolean; onMapCenter: WorldMapProps['onMapCenter'] }) {
  // ── MAP CENTER REPORTING ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const reportCenter = () => {
      const c = map.getCenter();
      const b = map.getBounds();
      onMapCenter?.({
        lat: c.lat,
        lng: c.lng,
        bounds: b ? { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() } : undefined,
      });
    };

    // Fire immediately so panels get initial coordinates
    reportCenter();

    map.on('moveend', reportCenter);
    return () => { map.off('moveend', reportCenter); };
  }, [mapReady, onMapCenter, mapRef]);
}
