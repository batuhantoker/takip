'use client';

import { useEffect, type RefObject } from 'react';
import type { FlightSelector } from '@/components/map/interaction/bind-flight-clicks';
import type { MapRef, SatelliteRow } from '@/components/map/types';
import { findFlight, findShip } from './live';
import { settleTrack, useTrackStatus } from './track-request';
import type { InspectSink } from './types';

/** How long a request waits for its target to show up in the feeds: two global flight polls and change. */
const DEADLINE_MS = 120_000;

/**
 * Answers a track request (a shared link, TI): finds the aircraft, ship or satellite in each data
 * update, opens its card, flies there and follows it, or gives up after the deadline.
 */
export function useTrackRequests({ mapRef, mapReady, data, satRowsRef, flightSelectRef, sink, selectSatellite }: {
  mapRef: MapRef;
  mapReady: boolean;
  data: Record<string, unknown>;
  satRowsRef: RefObject<SatelliteRow[]>;
  flightSelectRef: RefObject<FlightSelector | null>;
  sink: InspectSink;
  selectSatellite: RefObject<((index: number) => void) | null>;
}) {
  const request = useTrackStatus();
  const acquiring = request?.status === 'acquiring' ? request : null;

  useEffect(() => {
    if (!acquiring) return;
    const id = setTimeout(() => settleTrack('not-found'), Math.max(0, acquiring.since + DEADLINE_MS - Date.now()));
    return () => clearTimeout(id);
  }, [acquiring]);

  useEffect(() => {
    const map = mapRef.current;
    if (!acquiring || !mapReady || !map) return;
    const { kind, id } = acquiring.target;
    const go = (lng: number, lat: number, zoom: number) =>
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), zoom), duration: 1500, essential: true });

    if (kind === 'aircraft') {
      const found = findFlight(data, id);
      if (!found || !flightSelectRef.current) return;
      const { flight: f, layer } = found;
      flightSelectRef.current.select(f, [f.lng, f.lat], layer);
      go(f.lng, f.lat, 7);
    } else if (kind === 'ship') {
      const s = findShip(data, id);
      if (!s) return;
      sink.open({
        kind: 'ship', id: String(s.mmsi), mmsi: String(s.mmsi), name: s.name ?? '', type: s.type ?? '', lng: s.lng, lat: s.lat,
        speed: s.speed, heading: s.heading, destination: s.destination, flag: s.flag,
      });
      go(s.lng, s.lat, 9);
    } else {
      const index = satRowsRef.current?.findIndex(r => r.noradId === id) ?? -1;
      const row = satRowsRef.current?.[index];
      if (!row || !selectSatellite.current) return;
      selectSatellite.current(index);
      go(row.lng, row.lat, 3);
    }
    settleTrack('tracking');
  }, [acquiring, mapReady, data, mapRef, satRowsRef, flightSelectRef, sink, selectSatellite]);
}
