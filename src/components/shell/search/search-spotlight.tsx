'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { DrawMode } from '@/lib/places/areas/draw';
import type { FlyToTarget, MapCenter, NavSession } from '@/components/shell/state/types';
import SearchBar from './search-bar';
import type { PlaceLike } from './places';

/** Search, at the top-left of the map: clear of the sidebar and any panel beside it (the page sets --shell-left). */
export default function SearchSpotlight({ isMobile, showDesktopSearch, setShowDesktopSearch, drawMode, navSession, mapCenter, openDirectionsTo, setFlyToLocation }: {
  isMobile: boolean;
  showDesktopSearch: boolean;
  setShowDesktopSearch: Dispatch<SetStateAction<boolean>>;
  drawMode: DrawMode | null;
  navSession: NavSession | null;
  mapCenter: MapCenter | null;
  openDirectionsTo: (p: PlaceLike) => void;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
}) {
  // Drawing and turn-by-turn own the top of the map.
  if (isMobile || drawMode || navSession) return null;
  return (
    <div data-hud className="pointer-events-none absolute top-3 z-[450] transition-[left] duration-150 ease-out motion-reduce:transition-none"
      style={{ left: 'calc(var(--shell-left, 0px) + 12px)', width: 'min(420px, calc(100vw - var(--shell-left, 0px) - 24px))' }}>
      <SearchBar center={mapCenter} open={showDesktopSearch} onOpen={() => setShowDesktopSearch(true)} onClose={() => setShowDesktopSearch(false)}
        onDirections={openDirectionsTo} onLocate={(lat, lng, zoom) => setFlyToLocation({ lat, lng, zoom, ts: Date.now() })} />
    </div>
  );
}
