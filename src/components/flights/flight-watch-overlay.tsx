'use client';

import type { Dispatch, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import type { WatchedFlight, FlightTelemetry, AircraftDetail } from '@/lib/flight-watch';
import type { FlyToTarget } from '@/components/shell/dashboard-types';
import FlightWatchPanel from './flight-watch-panel';

export default function FlightWatchOverlay({ watchedFlights, watchTelemetry, removeWatched, handleAircraftDetail, isMobile, setFlyToLocation }: {
  watchedFlights: WatchedFlight[];
  watchTelemetry: Record<string, FlightTelemetry>;
  removeWatched: (icao24: string) => void;
  handleAircraftDetail: (icao24: string, detail: AircraftDetail | null) => void;
  isMobile: boolean;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      className="absolute top-3 z-[380] w-[min(92vw,290px)] pointer-events-auto
                 max-h-[calc(100vh-180px)] overflow-y-auto styled-scrollbar"
      style={{ left: isMobile ? '12px' : '120px' }}
    >
      <FlightWatchPanel
        watched={watchedFlights}
        telemetry={watchTelemetry}
        onRemove={removeWatched}
        onLocate={(lat, lng) => setFlyToLocation({ lat, lng, zoom: 8, ts: Date.now() })}
        onDetail={handleAircraftDetail}
      />
    </motion.div>
  );
}
