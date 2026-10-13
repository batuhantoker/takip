'use client';

import { useEffect, useMemo } from 'react';
import FlightWatchPanel from '@/components/map/inspect/flight-watch/flight-watch-panel';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useFlightWatch } from '@/components/map/inspect/flight-watch/use-flight-watch';
import { useWatchedAirports } from '@/components/map/layers/live/use-flight-layers';
import { FloatingWindow } from '@/components/map/windows';
import type { MapRef } from '@/components/map/types';
import type { FlightTelemetry, WatchedFlight } from '@/lib/flights/watch';
import { AircraftInspect } from '@/components/map/inspect/cards/aircraft-inspect';
import { findFlight, findShip } from './live';
import { useRing } from './rings';
import { SatelliteInspect, type SatelliteDetail } from '@/components/map/inspect/cards/satellite-inspect';
import { InspectSheet } from '@/components/map/inspect/parts/inspect-sheet';
import { ShipInspect } from '@/components/map/inspect/cards/ship-inspect';
import type { InspectTarget } from './types';
import { inspectId } from './use-inspect';

type Feed = Record<string, unknown>;
type Watch = ReturnType<typeof useFlightWatch>;

const keep = () => {};

/** One window per aircraft, ship and satellite, and the watched aircraft; on a phone, one sheet. */
export function InspectHost({ mapRef, data, targets, sat, onClose, onCloseAll, onCloseSat, onSelectFlight }: {
  mapRef: MapRef;
  data: Feed;
  targets: InspectTarget[];
  sat: SatelliteDetail | null;
  onClose: (target: InspectTarget) => void;
  onCloseAll: () => void;
  onCloseSat: () => void;
  onSelectFlight: (flight: WatchedFlight, telem: FlightTelemetry | undefined) => void;
}) {
  const watch = useFlightWatch(data);
  const isMobile = useIsMobile();
  useWatchedAirports({ mapRef, mapReady: true, aircraftAirports: watch.aircraftAirports });

  const satId = sat ? `satellite:${sat.noradId ?? sat.name}` : null;
  const last = targets.at(-1);
  const lastId = last ? inspectId(last) : null;
  // A phone shows one sheet: whatever opened last pushes the rest out.
  useEffect(() => { if (isMobile && satId) onCloseAll(); }, [isMobile, satId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isMobile || !lastId) return;
    onCloseSat();
    targets.slice(0, -1).forEach(onClose);
  }, [isMobile, lastId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isMobile) {
    if (last) return <TargetCard key={lastId} target={last} data={data} mapRef={mapRef} watch={watch} onClose={() => onClose(last)} sheet />;
    if (sat) return <InspectSheet key={satId} onClose={onCloseSat}><SatelliteInspect sat={sat} mapRef={mapRef} onClose={onCloseSat} /></InspectSheet>;
    return null;
  }
  return (
    <>
      {targets.map(t => (
        <TargetCard key={inspectId(t)} target={t} data={data} mapRef={mapRef} watch={watch} onClose={() => onClose(t)} />
      ))}
      {sat && satId && (
        <FloatingWindow id={satId} kind="inspect" label={sat.name} onClose={onCloseSat}>
          <SatelliteInspect key={satId} sat={sat} mapRef={mapRef} onClose={onCloseSat} />
        </FloatingWindow>
      )}
      {watch.watchedFlights.length > 0 && (
        <FloatingWindow id="watch" kind="watch" label="Watched aircraft" closable={false} onClose={keep}>
          <FlightWatchPanel
            watched={watch.watchedFlights}
            telemetry={watch.watchTelemetry}
            onRemove={watch.removeWatched}
            onDetail={watch.handleAircraftDetail}
            onSelect={onSelectFlight}
            selectedId={last?.kind === 'aircraft' ? last.icao24 : null}
          />
        </FloatingWindow>
      )}
    </>
  );
}

/** An aircraft or ship card, kept on the latest position from the feed, with its ring on the map. */
function TargetCard({ target, data, mapRef, watch, onClose, sheet }: {
  target: InspectTarget;
  data: Feed;
  mapRef: MapRef;
  watch: Watch;
  onClose: () => void;
  sheet?: boolean;
}) {
  const id = inspectId(target);
  const liveFlight = useMemo(
    () => (target.kind === 'aircraft' ? findFlight(data, target.icao24)?.flight ?? null : null),
    // Each poll replaces the arrays; `data` itself is the same object throughout.
    [target.kind, target.id, data.commercial_flights, data.private_flights, data.private_jets, data.military_flights], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const liveShip = useMemo(
    () => (target.kind === 'ship' ? findShip(data, target.mmsi) : null),
    [target.kind, target.id, data.maritime_ships], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const at = target.kind === 'aircraft' ? (liveFlight ?? target) : target.kind === 'ship' ? (liveShip ?? target) : null;
  useRing(id, at ? { lat: at.lat, lng: at.lng } : null);

  let card = null;
  let label = '';
  if (target.kind === 'aircraft') {
    label = target.callsign || target.icao24.toUpperCase();
    card = (
      <AircraftInspect target={target} live={liveFlight} mapRef={mapRef} onClose={onClose}
        watching={watch.watchedFlights.some(w => w.icao24 === target.icao24)}
        onWatch={() => watch.watchFlight({ icao24: target.icao24, callsign: target.callsign })}
        onUnwatch={() => watch.removeWatched(target.icao24)} />
    );
  } else if (target.kind === 'ship') {
    label = target.name || 'Vessel';
    card = <ShipInspect target={target} live={liveShip} mapRef={mapRef} onClose={onClose} />;
  }
  if (!card) return null;
  if (sheet) return <InspectSheet onClose={onClose}>{card}</InspectSheet>;
  return <FloatingWindow id={id} kind="inspect" label={label} onClose={onClose}>{card}</FloatingWindow>;
}
