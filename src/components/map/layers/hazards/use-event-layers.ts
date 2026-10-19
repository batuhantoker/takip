'use client';

import { useEffect } from 'react';
import { t } from '@/lib/core/i18n/active';
import type { LayerHookArgs } from '@/components/map/types';

export function useEarthquakeLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    setGeo('earthquakes', activeLayers.earthquakes && data.earthquakes ? data.earthquakes.map((eq: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] }, properties: { id: eq.id, magnitude: eq.magnitude, place: eq.place, depth: eq.depth, source: eq.source, url: eq.url, network: eq.network, twin_source: eq.twin?.source, twin_magnitude: eq.twin?.magnitude, twin_network: eq.twin?.network } })) : []);
  }, [mapReady, data.earthquakes, activeLayers.earthquakes, setGeo]);
}

export function useIncidentLayers({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    // url has to travel with the feature: /api/gdelt gives every event its own
    // GDACS report link, and dropping it here is what left the popup with
    // nothing to link to.
    setGeo('gdelt', activeLayers.global_incidents && data.gdelt ? data.gdelt.map((e: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lng, e.lat] }, properties: { name: e.name, url: e.url, kind: e.type } })) : []);
  }, [mapReady, data.gdelt, activeLayers.global_incidents, setGeo]);

  /* ── GDELT 2.0 Events ── */
  useEffect(() => {
    if (!mapReady) return;
    const al = activeLayers as any;
    setGeo('gdelt-events', al.gdelt_events && data.gdelt_events ? data.gdelt_events.map((e: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: {
        name: e.name, country: e.country, family: e.family, precision: e.precision, action: e.action,
        actor1: e.actor1, actor2: e.actor2, tone: e.tone, goldstein: e.goldstein,
        reports: e.reports, outlets: e.outlets, articles: e.articles, links: e.links, others: e.others,
        first_seen: e.first_seen, last_seen: e.last_seen,
      },
    })) : []);
  }, [mapReady, data.gdelt_events, (activeLayers as any).gdelt_events, setGeo]);
}

export function useConflictZones({ mapReady, setGeo }: Pick<LayerHookArgs, 'mapReady' | 'setGeo'>) {
  useEffect(() => {
    if (!mapReady) return;
    // 🔴 CONFLICT ZONES - Live from /api/conflicts 🔴
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/conflicts');
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const conflictData = await res.json();
        if (cancelled) return;

        // Zone anchor markers (war/high/elevated labels)
        const zoneFeatures = (conflictData.zones || []).map((z: any) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
          properties: { 
            label: z.label, 
            severity: z.severity, 
            description: `${z.description}${z.eventCount > 0 ? ` [${t('{n, plural, one {# live event detected} other {# live events detected}}', { n: z.eventCount })}]` : ''}`,
            sourceUrl: z.sourceUrl,
            eventCount: z.eventCount,
          },
        }));

        // Individual live conflict events (scatter dots across conflict zones)
        const eventFeatures = (conflictData.liveEvents || [])
          .filter((e: any) => e.lat && e.lng)
          .map((e: any) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
            properties: { 
              label: (e.title || t('CONFLICT EVENT')).substring(0, 60).toUpperCase(),
              severity: 'war',
              description: e.title || t('Live conflict event detected by GDELT.'),
              sourceUrl: e.url || '',
            },
          }));

        setGeo('conflict-zones', [...zoneFeatures, ...eventFeatures]);
      } catch (e) {
        // Fallback: if API fails, use minimal known zones
        const FALLBACK_ZONES = [
          { label: t('UKRAINE WAR'), severity: 'war', lat: 48.5, lng: 31.2, description: t('Ongoing Russian invasion of Ukraine.'), sourceUrl: 'https://liveuamap.com/' },
          { label: t('GAZA CONFLICT'), severity: 'war', lat: 31.35, lng: 34.35, description: t('Active military operations in Gaza.'), sourceUrl: 'https://israelpalestine.liveuamap.com/' },
          { label: t('SUDAN CIVIL WAR'), severity: 'war', lat: 15.0, lng: 30.0, description: t('SAF vs RSF armed conflict.'), sourceUrl: 'https://sudan.liveuamap.com/' },
          { label: t('YEMEN WAR'), severity: 'war', lat: 15.5, lng: 48.0, description: t('Houthi operations and Red Sea threats.'), sourceUrl: 'https://yemen.liveuamap.com/' },
          { label: t('MYANMAR CONFLICT'), severity: 'war', lat: 19.5, lng: 96.5, description: t('Military junta vs opposition forces.'), sourceUrl: 'https://myanmar.liveuamap.com/' },
          { label: t('SYRIA'), severity: 'high', lat: 35.0, lng: 38.5, description: t('Ongoing civil conflict.'), sourceUrl: 'https://syria.liveuamap.com/' },
        ];
        const fallbackFeatures = FALLBACK_ZONES.map(z => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
          properties: { label: z.label, severity: z.severity, description: z.description, sourceUrl: z.sourceUrl },
        }));
        setGeo('conflict-zones', fallbackFeatures);
      }
    })();
    return () => { cancelled = true; };
  }, [mapReady, setGeo]);
}
