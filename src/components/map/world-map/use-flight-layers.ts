'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { LayerHookArgs, MapRef, WorldMapProps } from './types';

export function useFlightLayers({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  // Flight data → GeoJSON (GPU rendered)
  useEffect(() => {
    if (!mapReady) return;
    const toFeatures = (arr: any[], decimate: number = 1) => {
      let filtered = arr || [];
      if (decimate > 1) {
        filtered = filtered.filter((_, i) => i % decimate === 0);
      }
      return filtered.map((f: any) => ({
        type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
        properties: { callsign: f.callsign, heading: f.heading || 0, alt: f.alt, model: f.model, speed_knots: f.speed_knots, registration: f.registration, icao24: f.icao24 },
      }));
    };
    setGeo('flights', activeLayers.flights ? toFeatures(data.commercial_flights, 10) : []);
    setGeo('private-fl', activeLayers.private ? toFeatures(data.private_flights, 2) : []);
    setGeo('jets', activeLayers.jets ? toFeatures(data.private_jets, 2) : []);
    setGeo('military', activeLayers.military ? toFeatures(data.military_flights) : []);
  }, [mapReady, data.commercial_flights, data.private_flights, data.private_jets, data.military_flights, activeLayers.flights, activeLayers.private, activeLayers.jets, activeLayers.military]);
}

interface WatchedAirportArgs {
  mapRef: MapRef;
  mapReady: boolean;
  aircraftAirports: NonNullable<WorldMapProps['aircraftAirports']>;
}

export function useWatchedAirports({ mapRef, mapReady, aircraftAirports }: WatchedAirportArgs) {
  // ── AIRPORTS FOR WATCHED AIRCRAFT ──
  // The endpoints that survived corroboration against the aircraft's reported
  // track — where the leg began and where it is booked to end.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const SRC = 'watched-airports';
    const IDS = ['watched-airport-glow', 'watched-airport-dot', 'watched-airport-label'];

    // The same airport can serve several watched aircraft — draw it once.
    const seen = new Set<string>();
    const features = Object.values(aircraftAirports).flat()
      .filter((a) => {
        if (!a || seen.has(a.icao)) return false;
        seen.add(a.icao);
        return true;
      })
      .map((a) => ({
        type: 'Feature' as const,
        properties: { label: a.iata || a.icao, city: a.city || '' },
        geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
      }));

    if (features.length === 0) {
      IDS.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      return;
    }

    const fc = { type: 'FeatureCollection' as const, features };
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: fc as never });
    else (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(fc as never);

    if (!map.getLayer('watched-airport-glow')) {
      map.addLayer({
        id: 'watched-airport-glow', type: 'circle', source: SRC,
        paint: { 'circle-radius': 13, 'circle-color': '#FFB300', 'circle-opacity': 0.16, 'circle-blur': 0.8 },
      });
    }
    if (!map.getLayer('watched-airport-dot')) {
      map.addLayer({
        id: 'watched-airport-dot', type: 'circle', source: SRC,
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFFFFF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFB300',
        },
      });
    }
    if (!map.getLayer('watched-airport-label')) {
      map.addLayer({
        id: 'watched-airport-label', type: 'symbol', source: SRC,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Noto Sans Bold'],
          'text-offset': [0, 1.6],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#FFB300', 'text-halo-color': '#0C0E1A', 'text-halo-width': 1.5 },
      });
    }
  }, [mapReady, aircraftAirports, mapRef]);
}
