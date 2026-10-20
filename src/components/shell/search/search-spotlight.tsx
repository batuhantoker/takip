'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Corner } from '@/components/shell/layout/lib/model';
import type { DrawMode } from '@/lib/places/areas/draw';
import type { FlyToTarget, MapCenter, NavSession } from '@/components/shell/state/types';
import type { FlightHit } from '@/lib/feeds/aviation/flight-search';
import SearchBar from './search-bar';
import type { PlaceLike } from './places';

/** Search, in its corner of the map (top-left unless moved). Hidden from the layout, it still opens with / and goes again on close. */
export default function SearchSpotlight({ isMobile, corner, hidden, showDesktopSearch, setShowDesktopSearch, drawMode, navSession, mapCenter, openDirectionsTo, trackFlight, setFlyToLocation }: {
  isMobile: boolean;
  corner: Corner;
  hidden: boolean;
  showDesktopSearch: boolean;
  setShowDesktopSearch: Dispatch<SetStateAction<boolean>>;
  drawMode: DrawMode | null;
  navSession: NavSession | null;
  mapCenter: MapCenter | null;
  openDirectionsTo: (p: PlaceLike) => void;
  trackFlight?: (f: FlightHit) => void;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
}) {
  // Drawing and turn-by-turn own the top of the map.
  if (isMobile || drawMode || navSession || (hidden && !showDesktopSearch)) return null;
  return (
    <div style={{ width: 'min(420px, calc(100vw - var(--shell-left, 0px) - 24px))' }}>
      <SearchBar center={mapCenter} open={showDesktopSearch} onOpen={() => setShowDesktopSearch(true)} onClose={() => setShowDesktopSearch(false)}
        upward={corner.startsWith('bottom')}
        onDirections={openDirectionsTo} onTrackFlight={trackFlight} onLocate={(lat, lng, zoom) => setFlyToLocation({ lat, lng, zoom, ts: Date.now() })} />
    </div>
  );
}
