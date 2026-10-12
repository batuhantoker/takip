'use client';

import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DrawMode } from '@/lib/draw';
import type { FlyToTarget, MapCenter, NavSession } from '@/components/shell/dashboard-types';
import SearchBar from './search-bar';
import SearchTrigger from './search-trigger';
import type { PlaceLike } from './places';

/** Top-left of the map, clear of the sidebar and of any panel beside it (the page sets --shell-left). */
const AT_LEFT = 'calc(var(--shell-left, 0px) + 12px)';

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
  return (
    <>
      {!isMobile && !showDesktopSearch && !drawMode && !navSession && (
        <div data-hud className="absolute top-3 z-[450] transition-[left] duration-200" style={{ left: AT_LEFT, width: 'min(380px, calc(100vw - var(--shell-left, 0px) - 120px))' }}>
          <SearchTrigger onOpen={() => setShowDesktopSearch(true)} />
        </div>
      )}
      <AnimatePresence>
        {showDesktopSearch && !isMobile && (
          <div data-hud className="absolute top-3 z-[450] pointer-events-auto" style={{ left: AT_LEFT, width: 'min(560px, calc(100vw - var(--shell-left, 0px) - 120px))' }}>
            <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.16 }}>
              <SearchBar center={mapCenter} onClose={() => setShowDesktopSearch(false)} onDirections={openDirectionsTo}
                onLocate={(lat, lng, zoom) => setFlyToLocation({ lat, lng, zoom, ts: Date.now() })} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
