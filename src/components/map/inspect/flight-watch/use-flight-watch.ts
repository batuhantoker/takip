'use client';

import { useCallback, useMemo, useState } from 'react';
import type { AircraftDetail, Airport, FlightTelemetry } from '@/lib/flights/watch';
import { unwatchFlight, useWatchedFlights, watchFlight } from './watch-store';

type Feed = Record<string, unknown>;

export function useFlightWatch(data: Feed) {
  const watchedFlights = useWatchedFlights();
  const [aircraftAirports, setAircraftAirports] = useState<Record<string, Airport[]>>({});

  const removeWatched = useCallback((icao24: string) => {
    unwatchFlight(icao24);
    setAircraftAirports((prev) => {
      const next = { ...prev };
      delete next[icao24];
      return next;
    });
  }, []);

  const handleAircraftDetail = useCallback((icao24: string, detail: AircraftDetail | null) => {
    const ports = [detail?.origin, detail?.destination]
      .filter((a): a is Airport => Boolean(a && Number.isFinite(a.lat) && Number.isFinite(a.lng)));
    setAircraftAirports((prev) => (ports.length ? { ...prev, [icao24]: ports } : prev));
  }, []);

  // Telemetry for watched aircraft, refreshed from whatever the feed last gave us.
  const buckets = [data?.commercial_flights, data?.private_flights, data?.private_jets, data?.military_flights] as
    (Array<FlightTelemetry & { icao24?: string }> | undefined)[];
  const watchTelemetry = useMemo(() => {
    const out: Record<string, FlightTelemetry> = {};
    if (!watchedFlights.length) return out;
    const wanted = new Set(watchedFlights.map((w) => w.icao24));
    for (const bucket of buckets) {
      for (const f of bucket || []) {
        if (f?.icao24 && wanted.has(f.icao24)) {
          out[f.icao24] = {
            lat: f.lat, lng: f.lng, alt: f.alt,
            speed_knots: f.speed_knots, heading: f.heading,
            grounded: f.grounded, squawk: f.squawk,
          };
        }
      }
    }
    return out;
  }, [watchedFlights, data?.commercial_flights, data?.private_flights, data?.private_jets, data?.military_flights]); // eslint-disable-line react-hooks/exhaustive-deps

  return { watchedFlights, watchFlight, aircraftAirports, removeWatched, handleAircraftDetail, watchTelemetry };
}
