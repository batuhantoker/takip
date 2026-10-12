'use client';

import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DrawMode } from '@/lib/draw';
import type { FlyToTarget, MapCenter, NavSession } from '@/components/shell/dashboard-types';
import SearchBar from './search-bar';
import SearchTrigger from './search-trigger';
import type { PlaceLike } from './places';

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
        <div data-hud className="absolute top-4 left-1/2 -translate-x-1/2 z-[450] w-[min(360px,calc(100vw-640px))]">
          <SearchTrigger onOpen={() => setShowDesktopSearch(true)} />
        </div>
      )}
      <AnimatePresence>
        {showDesktopSearch && !isMobile && (
          <div data-hud className="absolute top-3 left-1/2 -translate-x-1/2 z-[450] w-[min(560px,calc(100vw-180px))] pointer-events-auto">
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
