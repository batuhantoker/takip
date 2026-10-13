'use client';

import { LocateFixed, ZoomIn } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import type { MapRef } from '@/components/map/types';

/** Follow and Zoom to, as header icon buttons. */
export function MoveActions({ mapRef, lat, lng, zoom, following, onFollow }: {
  mapRef: MapRef;
  lat: number;
  lng: number;
  zoom: number;
  following?: boolean;
  onFollow?: (on: boolean) => void;
}) {
  const zoomTo = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [lng, lat], zoom: Math.max(zoom, Math.min(map.getZoom(), 16)), duration: 1200, essential: true });
  };
  return (
    <>
      {onFollow && (
        <IconButton label={following ? 'Stop following' : 'Follow'} icon={LocateFixed} active={following} onClick={() => onFollow(!following)} />
      )}
      <IconButton label="Zoom to" icon={ZoomIn} onClick={zoomTo} />
    </>
  );
}
