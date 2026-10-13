'use client';

import { useEffect, type RefObject } from 'react';
import { CCTV_LAYERS } from '@/lib/cameras/map-layers';
import { shipFilter } from '@/lib/ships/filter';
import type { MapRef, SatelliteLayer, SatelliteRow, WorldMapProps } from '@/components/map/types';

interface LayerVisibilityArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  setVis: (ids: string[], visible: boolean) => void;
  satRowsRef: RefObject<SatelliteRow[]>;
  satLayerRef: RefObject<SatelliteLayer | null>;
  /** Replay draws ships and aircraft itself; the live ones hide meanwhile. */
  replayActive?: boolean;
}

export function useLayerVisibility({ mapRef, mapReady, activeLayers, setVis, satRowsRef, satLayerRef, replayActive = false }: LayerVisibilityArgs) {
  // Visibility
  useEffect(() => {
    if (!mapReady) return;
    setVis(['eq-circles','eq-label'], activeLayers.earthquakes);
    const anySat = activeLayers.satellites || (activeLayers as any).sat_comms || (activeLayers as any).sat_military || (activeLayers as any).sat_navigation || (activeLayers as any).sat_earth || (activeLayers as any).sat_science;
    // The circle layers stay hidden whatever the toggles say — the 3D layer
    // is the single representation, and showing both drew every satellite
    // twice, once flat on the ground and once at altitude.
    setVis(['sat-glow','sat-dots'], false);
    // Clearing the 3D layer is what actually turns satellites off.
    if (!anySat) { satRowsRef.current = []; satLayerRef.current?.setPoints([]); }
    setVis(['gdelt-dots'], activeLayers.global_incidents);
    setVis(['gdelt-events-dots'], (activeLayers as any).gdelt_events);
    setVis(['cf-outage-dots','cf-outage-label'], (activeLayers as any).cf_outages);
    setVis(['cf-attack-dots','cf-attack-label'], (activeLayers as any).cf_attacks);

    setVis(['malware-dots','malware-label','malware-new-ring'], activeLayers.malware);
    setVis(['cyber-heads','cyber-labels'], (activeLayers as any).cyber_attacks);
    setVis(['day-night-fill'], activeLayers.day_night);
    setVis(['fl-commercial'], activeLayers.flights && !replayActive);
    setVis(['fl-private'], activeLayers.private && !replayActive);
    setVis(['fl-jets'], activeLayers.jets && !replayActive);
    setVis(['fl-military'], activeLayers.military && !replayActive);
    setVis(CCTV_LAYERS, activeLayers.cctv);
    setVis(['fires-heat'], activeLayers.fires);
    setVis(['weather-dots','weather-label'], activeLayers.weather);
    setVis(['wx-temp-label'], !!activeLayers.wx_temperature);
    setVis(['wx-wind'], !!activeLayers.wx_wind);
    setVis(['infra-dots','infra-label'], activeLayers.infrastructure);
    setVis(['maritime-dots','maritime-label'], activeLayers.maritime);
    setVis(['choke-dots','choke-label'], activeLayers.maritime);
    setVis(['ship-dots','ship-arrows','ship-label'], activeLayers.maritime && !replayActive);
    const shipsShown = shipFilter(activeLayers);
    for (const id of ['ship-dots','ship-arrows','ship-label']) {
      if (mapRef.current?.getLayer(id)) mapRef.current.setFilter(id, shipsShown);
    }
    setVis(['news-dots','news-label'], activeLayers.live_news);
    setVis(['alert-pin-dots','alert-pin-label','alert-pin-pulse','alert-pin-selected'], activeLayers.alert_pins);
    setVis(['conflict-icons'], activeLayers.conflict_zones !== false);

    setVis(['balloon-dots','balloon-label'], activeLayers.balloons);
    setVis(['launch-dots','launch-label'], activeLayers.launches);
    setVis(['aurora-heat'], activeLayers.aurora);
    setVis(['service-status-dots','service-status-label'], activeLayers.service_status);
    setVis(['gnss-fill','gnss-line'], activeLayers.gps_jamming);
    setVis(['rad-dots','rad-label'], activeLayers.radiation);
    setVis(['war-alert-glow','war-alert-dots','war-alert-label'], activeLayers.war_alerts);
    setVis(['fire-incident-dots','fire-incident-label'], activeLayers.fires);
    setVis(['airport-delay-dots','airport-delay-label'], activeLayers.airport_delays);
    setVis(['chokepoint-flow-ring','chokepoint-flow-label'], activeLayers.chokepoint_flow);
    setVis(['outbreak-rings','outbreak-label'], activeLayers.outbreaks);
    setVis(['sdk-sea'], activeLayers.sdk_sea !== false);
    setVis(['sdk-air'], activeLayers.sdk_air !== false);
    setVis(['sdk-intel'], activeLayers.sdk_naval !== false);
    // Sweep layers always visible when data is present (controlled by useEffect)
    setVis(['sweep-connections','sweep-pulse-ring','sweep-device-dots','sweep-device-labels'], true);
  }, [mapReady, activeLayers, setVis, mapRef, satRowsRef, satLayerRef, replayActive]);
}
