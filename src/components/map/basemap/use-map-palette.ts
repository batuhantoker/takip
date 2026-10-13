'use client';

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { MAP_PALETTE_KEYS, readMapPalette, type MapPalette } from '@/lib/map/palette';
import type { OiGlobe } from '@/lib/oi/globe';
import { STYLE_EVENT } from '@/lib/style/tokens';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface MapPaletteArgs {
  mapRef: MapRef;
  mapReady: boolean;
  theme: NonNullable<WorldMapProps['theme']>;
  palette: MapPalette;
  setPalette: Dispatch<SetStateAction<MapPalette>>;
  oiGlobeRef: RefObject<OiGlobe | null>;
}

export function useMapPalette({ mapRef, mapReady, theme, palette, setPalette, oiGlobeRef }: MapPaletteArgs) {
  /**
   * Pull the palette out of the document whenever it can have changed.
   *
   * Two triggers, and they need different timing. The Style Studio writes the
   * properties and then dispatches, so reading straight away is correct. A
   * theme switch flips a class on <body> from an effect in the page component
   * — a parent, so it runs *after* this one — and reading now would return the
   * outgoing theme. The extra frame covers that case.
   */
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.body);
      const next = readMapPalette(name => cs.getPropertyValue(name));
      setPalette(prev => (MAP_PALETTE_KEYS.every(k => prev[k] === next[k]) ? prev : next));
    };
    read();
    const raf = requestAnimationFrame(read);
    window.addEventListener(STYLE_EVENT, read);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(STYLE_EVENT, read);
    };
  }, [theme, setPalette]);

    // Update aircraft icon colors dynamically on theme switch
    useEffect(() => {
      if (!mapReady || !mapRef.current) return;
      const map = mapRef.current;

      const updateMapIcon = (id: string, color: string, size: number) => {
        if (!map.hasImage(id)) return;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const cx = size / 2, cy = size / 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.4);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx, cy + size * 0.35);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
        ctx.closePath();
        ctx.fill();
        map.updateImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
      };

      updateMapIcon('plane-cyan', palette.flightCivil, 24);
      updateMapIcon('plane-green', palette.flightPrivate, 24);
      updateMapIcon('plane-pink', palette.flightGov, 24);
      updateMapIcon('plane-red', palette.flightMilitary, 24);
      updateMapIcon('plane-grey', palette.flightUnknown, 24);
    }, [mapReady, palette, mapRef]);

  // OI's arcs take their three tones from the Style Studio (violet, magenta, indigo unless changed).
  useEffect(() => {
    oiGlobeRef.current?.setColors({ support: palette.oiSupport, oppose: palette.oiOppose, neutral: palette.oiNeutral });
  }, [palette.oiSupport, palette.oiOppose, palette.oiNeutral, oiGlobeRef]);

    // Cameras are circles, so the colour is a paint property: the dot and the cluster ring.
    useEffect(() => {
      if (!mapReady || !mapRef.current) return;
      const map = mapRef.current;
      if (map.getLayer('cctv-dots')) map.setPaintProperty('cctv-dots', 'circle-color', palette.cctv);
      if (map.getLayer('cctv-clusters')) map.setPaintProperty('cctv-clusters', 'circle-stroke-color', palette.cctv);
    }, [mapReady, palette.cctv, mapRef]);
}
