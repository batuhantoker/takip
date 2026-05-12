'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/* ═══════════════════════════════════════════════════════════════
   OSIRIS MAP — Core MapLibre GL Component
   Real-time geospatial intelligence renderer
   ═══════════════════════════════════════════════════════════════ */

interface OsirisMapProps {
  data: any;
  activeLayers: Record<string, boolean>;
  onEntityClick?: (entity: any) => void;
  onMouseCoords?: (coords: { lat: number; lng: number }) => void;
  onRightClick?: (coords: { lat: number; lng: number }) => void;
  onViewStateChange?: (vs: { zoom: number; latitude: number }) => void;
  flyToLocation?: { lat: number; lng: number; ts: number } | null;
}

// ── Aircraft SVG Icons ──
function createAircraftSVG(heading: number, color: string, category: string, grounded: boolean): string {
  const fill = grounded ? '#555' : color;
  const opacity = grounded ? '0.5' : '1';
  const size = category === 'heli' ? 24 : 28;

  if (category === 'heli') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="transform:rotate(${heading}deg)">
      <g opacity="${opacity}"><circle cx="12" cy="12" r="3" fill="${fill}"/><line x1="12" y1="3" x2="12" y2="8" stroke="${fill}" stroke-width="1.5"/><line x1="6" y1="5" x2="18" y2="5" stroke="${fill}" stroke-width="1.5"/><line x1="12" y1="15" x2="12" y2="21" stroke="${fill}" stroke-width="1.2"/><line x1="8" y1="19" x2="16" y2="19" stroke="${fill}" stroke-width="1.2"/></g>
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="transform:rotate(${heading}deg)">
    <g opacity="${opacity}"><path d="M12 2L12 9M12 9L5 14L5 16L12 13L19 16L19 14L12 9ZM12 13L12 20M9 18L15 18" stroke="${fill}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.5" fill="${fill}"/></g>
  </svg>`;
}

function createSatelliteSVG(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8">
    <circle cx="4" cy="4" r="3" fill="${color}" opacity="0.8"/><circle cx="4" cy="4" r="1.5" fill="${color}"/>
  </svg>`;
}

// ── Day/Night Terminator Calculation ──
function computeSolarTerminator(): [number, number][] {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  const decRad = declination * Math.PI / 180;
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const subsolarLng = (12 - utcHours) * 15;

  const points: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const lngRad = (lng - subsolarLng) * Math.PI / 180;
    const lat = Math.atan(-Math.cos(lngRad) / Math.tan(decRad)) * 180 / Math.PI;
    points.push([lng, lat]);
  }

  // Close the polygon for the dark side
  const darkSide = declination >= 0 ? -90 : 90;
  points.push([180, darkSide]);
  points.push([-180, darkSide]);
  points.push(points[0]);

  return points;
}

export default function OsirisMap({
  data,
  activeLayers,
  onEntityClick,
  onMouseCoords,
  onRightClick,
  onViewStateChange,
  flyToLocation,
}: OsirisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [20, 20],
      zoom: 2.5,
      minZoom: 1.5,
      maxZoom: 18,
      attributionControl: false,
      antialias: true,
    });

    map.on('load', () => {
      mapRef.current = map;
      setMapReady(true);

      // Add empty sources for all layers
      map.addSource('flights', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('military', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('satellites', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('earthquakes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('gdelt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('gps-jamming', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('day-night', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      // ── Day/Night Layer ──
      map.addLayer({
        id: 'day-night-fill',
        type: 'fill',
        source: 'day-night',
        paint: {
          'fill-color': '#000022',
          'fill-opacity': 0.35,
        },
      });

      // ── Earthquake Layers ──
      map.addLayer({
        id: 'earthquakes-heat',
        type: 'circle',
        source: 'earthquakes',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'magnitude'], 2.5, 4, 5, 12, 7, 24, 9, 40],
          'circle-color': ['interpolate', ['linear'], ['get', 'magnitude'],
            2.5, '#FFD700',
            4, '#FF9500',
            5.5, '#FF5722',
            7, '#FF1744',
            9, '#D50000',
          ],
          'circle-opacity': 0.6,
          'circle-blur': 0.4,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FFD700',
          'circle-stroke-opacity': 0.3,
        },
      });

      map.addLayer({
        id: 'earthquakes-label',
        type: 'symbol',
        source: 'earthquakes',
        filter: ['>=', ['get', 'magnitude'], 4.5],
        layout: {
          'text-field': ['concat', 'M', ['to-string', ['get', 'magnitude']]],
          'text-size': 9,
          'text-font': ['Open Sans Regular'],
          'text-offset': [0, 1.5],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#FFD700',
          'text-halo-color': '#000',
          'text-halo-width': 1,
        },
      });

      // ── GDELT Conflict Layer ──
      map.addLayer({
        id: 'gdelt-circles',
        type: 'circle',
        source: 'gdelt',
        paint: {
          'circle-radius': 4,
          'circle-color': '#FF3D3D',
          'circle-opacity': 0.5,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FF3D3D',
          'circle-stroke-opacity': 0.3,
        },
      });

      // ── GPS Jamming Layer ──
      map.addLayer({
        id: 'gps-jamming-fill',
        type: 'circle',
        source: 'gps-jamming',
        paint: {
          'circle-radius': 30,
          'circle-color': '#FF0000',
          'circle-opacity': 0.15,
          'circle-blur': 1,
        },
      });

      map.addLayer({
        id: 'gps-jamming-label',
        type: 'symbol',
        source: 'gps-jamming',
        layout: {
          'text-field': ['concat', 'GPS JAM ', ['to-string', ['get', 'severity']], '%'],
          'text-size': 10,
          'text-font': ['Open Sans Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FF4444',
          'text-halo-color': '#000',
          'text-halo-width': 1,
        },
      });

      // ── Satellite Layer ──
      map.addLayer({
        id: 'satellites-circles',
        type: 'circle',
        source: 'satellites',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.5, 5, 3, 10, 5],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.7,
        },
      });
    });

    // Mouse move for coordinates
    map.on('mousemove', (e) => {
      onMouseCoords?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    // Right-click for region dossier
    map.on('contextmenu', (e) => {
      e.preventDefault();
      onRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    // View state tracking
    map.on('moveend', () => {
      const center = map.getCenter();
      onViewStateChange?.({ zoom: map.getZoom(), latitude: center.lat });
    });

    // Click handlers for entities
    const clickableLayers = ['earthquakes-heat', 'gdelt-circles', 'satellites-circles'];
    for (const layer of clickableLayers) {
      map.on('click', layer, (e) => {
        if (e.features && e.features.length > 0) {
          const props = e.features[0].properties;
          onEntityClick?.(props);
        }
      });
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Update Day/Night Terminator ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const updateTerminator = () => {
      if (!activeLayers.day_night) {
        (map.getSource('day-night') as any)?.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const coords = computeSolarTerminator();
      (map.getSource('day-night') as any)?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {},
        }],
      });
    };

    updateTerminator();
    const interval = setInterval(updateTerminator, 60000);
    return () => clearInterval(interval);
  }, [mapReady, activeLayers.day_night]);

  // ── Update Flight Markers (HTML markers for rotation) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!activeLayers.flights && !activeLayers.military && !activeLayers.jets && !activeLayers.private) return;

    const allFlights: any[] = [];
    if (activeLayers.flights && data.commercial_flights) allFlights.push(...data.commercial_flights);
    if (activeLayers.private && data.private_flights) allFlights.push(...data.private_flights);
    if (activeLayers.jets && data.private_jets) allFlights.push(...data.private_jets);
    if (activeLayers.military && data.military_flights) allFlights.push(...data.military_flights);

    // Viewport culling
    const bounds = map.getBounds();
    const buffer = 5;
    const filtered = allFlights.filter(f => {
      return f.lat >= bounds.getSouth() - buffer &&
             f.lat <= bounds.getNorth() + buffer &&
             f.lng >= bounds.getWest() - buffer &&
             f.lng <= bounds.getEast() + buffer;
    });

    // Limit markers for performance
    const maxMarkers = 1500;
    const toRender = filtered.length > maxMarkers
      ? filtered.filter((_, i) => i % Math.ceil(filtered.length / maxMarkers) === 0)
      : filtered;

    for (const flight of toRender) {
      const color = flight.category === 'military' ? '#FF3D3D'
        : flight.category === 'jet' ? '#FF69B4'
        : flight.category === 'private' ? '#00E676'
        : '#00E5FF';

      const el = document.createElement('div');
      el.innerHTML = createAircraftSVG(flight.heading || 0, color, flight.aircraft_category || 'plane', flight.grounded);
      el.style.cursor = 'pointer';

      el.addEventListener('click', () => {
        onEntityClick?.({
          type: 'flight',
          ...flight,
        });

        // Show popup
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '320px', offset: 15 })
          .setLngLat([flight.lng, flight.lat])
          .setHTML(`
            <div style="background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border:1px solid rgba(212,175,55,0.3);border-radius:8px;padding:12px;font-family:'JetBrains Mono',monospace;min-width:220px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <div style="color:#D4AF37;font-size:13px;font-weight:700;letter-spacing:0.1em;">${flight.callsign}</div>
                <div style="color:${color};font-size:8px;background:${color}22;padding:2px 6px;border-radius:4px;text-transform:uppercase;">${flight.category}</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
                <div><span style="color:#5C5A54;">MODEL</span><br/><span style="color:#E8E6E0;">${flight.model}</span></div>
                <div><span style="color:#5C5A54;">ALT</span><br/><span style="color:#00E5FF;">${flight.alt ? Math.round(flight.alt) + 'm' : 'N/A'}</span></div>
                <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:#E8E6E0;">${flight.speed_knots ? flight.speed_knots + 'kt' : 'N/A'}</span></div>
                <div><span style="color:#5C5A54;">HDG</span><br/><span style="color:#E8E6E0;">${Math.round(flight.heading)}°</span></div>
                <div><span style="color:#5C5A54;">REG</span><br/><span style="color:#E8E6E0;">${flight.registration}</span></div>
                <div><span style="color:#5C5A54;">ICAO</span><br/><span style="color:#E8E6E0;">${flight.icao24}</span></div>
              </div>
              ${flight.squawk === '7700' ? '<div style="margin-top:8px;color:#FF3D3D;font-size:9px;font-weight:700;">⚠ SQUAWK 7700 — EMERGENCY</div>' : ''}
              ${flight.squawk === '7500' ? '<div style="margin-top:8px;color:#FF3D3D;font-size:9px;font-weight:700;">⚠ SQUAWK 7500 — HIJACK</div>' : ''}
            </div>
          `)
          .addTo(map);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([flight.lng, flight.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [mapReady, data.commercial_flights, data.private_flights, data.private_jets, data.military_flights, activeLayers.flights, activeLayers.military, activeLayers.jets, activeLayers.private]);

  // ── Update Earthquake Data ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource('earthquakes') as any;
    if (!source) return;

    if (!activeLayers.earthquakes || !data.earthquakes) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: data.earthquakes.map((eq: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] },
        properties: {
          id: eq.id,
          magnitude: eq.magnitude,
          place: eq.place,
          depth: eq.depth,
          time: eq.time,
          type: 'earthquake',
        },
      })),
    });
  }, [mapReady, data.earthquakes, activeLayers.earthquakes]);

  // ── Update Satellite Data ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource('satellites') as any;
    if (!source) return;

    if (!activeLayers.satellites || !data.satellites) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: data.satellites.map((sat: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [sat.lng, sat.lat] },
        properties: {
          name: sat.name,
          mission: sat.mission,
          color: sat.color,
          alt: sat.alt,
          type: 'satellite',
        },
      })),
    });
  }, [mapReady, data.satellites, activeLayers.satellites]);

  // ── Update GDELT Data ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource('gdelt') as any;
    if (!source) return;

    if (!activeLayers.global_incidents || !data.gdelt) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: data.gdelt.map((ev: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ev.lng, ev.lat] },
        properties: {
          name: ev.name,
          type: 'conflict',
        },
      })),
    });
  }, [mapReady, data.gdelt, activeLayers.global_incidents]);

  // ── Update GPS Jamming Data ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource('gps-jamming') as any;
    if (!source) return;

    if (!activeLayers.gps_jamming || !data.gps_jamming) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: data.gps_jamming.map((z: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [z.lng, z.lat] },
        properties: { severity: z.severity, count: z.count },
      })),
    });
  }, [mapReady, data.gps_jamming, activeLayers.gps_jamming]);

  // ── Layer visibility toggle ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const setVis = (layers: string[], visible: boolean) => {
      for (const id of layers) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      }
    };

    setVis(['earthquakes-heat', 'earthquakes-label'], activeLayers.earthquakes);
    setVis(['gdelt-circles'], activeLayers.global_incidents);
    setVis(['gps-jamming-fill', 'gps-jamming-label'], activeLayers.gps_jamming);
    setVis(['satellites-circles'], activeLayers.satellites);
    setVis(['day-night-fill'], activeLayers.day_night);
  }, [mapReady, activeLayers]);

  // ── Fly-to Location ──
  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyToLocation) return;
    mapRef.current.flyTo({
      center: [flyToLocation.lng, flyToLocation.lat],
      zoom: 8,
      duration: 2000,
      essential: true,
    });
  }, [mapReady, flyToLocation]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full" />
  );
}
