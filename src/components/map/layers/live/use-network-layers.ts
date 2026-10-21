'use client';

import { useEffect } from 'react';
import { t } from '@/lib/core/i18n/active';
import { arrivalBeacons } from '@/lib/intel/cyber/malware/intel';
import { mergeOutages } from '@/lib/intel/outages/outage';
import type { LayerHookArgs } from '@/components/map/types';

export function useCyberLayers({ mapRef, mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  /* ── Internet outages: Cloudflare Radar and IODA ── */
  useEffect(() => {
    if (!mapReady) return;
    const on = (activeLayers as any).cf_outages;
    const outages = on ? mergeOutages(data.cf_outages ?? [], data.ioda_outages ?? [], Date.now()) : [];
    setGeo('cf-outages', outages.map(o => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
      properties: {
        source: o.source, kind: o.kind, country: o.country, country_name: o.country_name, network: o.network,
        scope: o.scope, cause: o.cause, description: o.description, start: o.start, end: o.end,
        ongoing: !!o.ongoing, url: o.url, seen_in: o.seen_in.join(','),
      },
    })));
  }, [mapReady, data.cf_outages, data.ioda_outages, (activeLayers as any).cf_outages, setGeo]);

  /* ── Cloudflare Radar: attack origins ── */
  useEffect(() => {
    if (!mapReady) return;
    const al = activeLayers as any;
    setGeo('cf-attacks', al.cf_attacks && data.cf_attack_origins ? data.cf_attack_origins.map((a: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: { country: a.country, country_name: a.country_name, share: a.share },
    })) : []);
  }, [mapReady, data.cf_attack_origins, (activeLayers as any).cf_attacks, setGeo]);

  // Malware Threats
  useEffect(() => {
    if (!mapReady) return;
    setGeo('malware-nodes', activeLayers.malware && data.malware_threats ? data.malware_threats.map((m: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
      properties: {
        ip: m.ip, malware: m.malware, status: m.status, threat_type: m.threat_type,
        country: m.country, city: m.city, port: m.port,
        asn: m.asn, as_name: m.as_name,
        // How many live malicious URLs this host serves — the dot is sized by
        // it, so a box distributing forty payloads reads bigger than one.
        url_count: m.url_count ?? 1,
        first_seen: m.first_seen, last_seen: m.last_seen,
        reference: m.reference, reporter: m.reporter,
        detected_at: m.detected_at ?? 0,
      },
    })) : []);
  }, [mapReady, data.malware_threats, activeLayers.malware, setGeo]);

  /* Detections that landed while the operator was watching get a ring for a
     minute. Without it a pushed feed is indistinguishable from a static one —
     nodes simply appear, and the thing that makes it live goes unseen. */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeLayers.malware) return;
    const map = mapRef.current;

    /* Arrivals are rare — a handful an hour — so the common case is that there
       is nothing to draw. Tracking whether the last tick drew anything keeps
       this from pushing an empty collection into the source five times a
       second for the entire time the layer is on. */
    let drawing = false;

    const tick = () => {
      const now = Date.now();
      const beacons = arrivalBeacons(data.malware_threats ?? [], now);

      if (beacons.length === 0) {
        if (drawing) { setGeo('malware-new', []); drawing = false; }
        return;
      }

      setGeo('malware-new', beacons.map(b => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
        properties: { age: b.age },
      })));
      drawing = true;

      try {
        // One shared pulse, so the ring reads as a beacon rather than each
        // node breathing on its own schedule.
        map.setPaintProperty('malware-new-ring', 'circle-radius',
          ['interpolate', ['linear'], ['get', 'age'], 0, 6 + Math.sin(now / 200) * 2, 1, 26]);
      } catch { /* style not settled yet */ }
    };

    tick();
    const timer = setInterval(tick, 200);
    return () => { clearInterval(timer); setGeo('malware-new', []); };
  }, [mapReady, data.malware_threats, activeLayers.malware, setGeo, mapRef]);

  /* ══ BOTNET C2 INFRASTRUCTURE ══
     Static dots, no animation. The arcs that used to fly across this layer
     were drawn between a fabricated attacker origin and the C2's country, and
     the marching-ants animation read as traffic that no source had observed.
     A blocklist has no motion in it. */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const al = activeLayers as any;
    const indicators = data.cyber_attacks;

    if (!al.cyber_attacks || !indicators?.length) {
      setGeo('cyber-heads', []);
      return;
    }

    // A C2 whose hosting country is unknown has no honest position on a map.
    const dots = indicators
      .filter((c: any) => typeof c.lng === 'number' && typeof c.lat === 'number')
      .map((c: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          id: c.id, ip: c.ip, port: c.port, malware: c.malware, status: c.status,
          hostname: c.hostname, country: c.country, as_number: c.as_number, as_name: c.as_name,
          first_seen: c.first_seen, last_online: c.last_online,
        },
      }));

    setGeo('cyber-heads', dots);
  }, [mapReady, (activeLayers as any).cyber_attacks, data.cyber_attacks, setGeo]);
}

export function useSdkLinks({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  // ══ TAKIP SDK — Lattice Sensor Mesh ══
  // Uses real submarine cable data for SEA domain, curated routes for AIR/INTEL
  useEffect(() => {
    if (!mapReady) return;
    setGeo('sdk-entities', []);

    const anySDK = activeLayers.sdk_sea || activeLayers.sdk_air || activeLayers.sdk_naval;
    if (!anySDK) {
      setGeo('sdk-links', []);
      return;
    }

    const links: any[] = [];

    // ── SEA DOMAIN: Real submarine cable data (1-for-1 Match) ──
    if (activeLayers.sdk_sea && data.submarine_cables) {
      const ignoredColors = new Set(['#9BB5CC', '#A0B8CD', '#8EABC2', '#9bb5cc', '#a0b8cd', '#8eabc2']);
      for (const cable of data.submarine_cables) {
        if (!cable.geometry) continue;
        
        // Remove the light blue background arcs
        if (cable.properties?.color && ignoredColors.has(cable.properties.color)) continue;
        
        links.push({
          type: 'Feature',
          geometry: cable.geometry, // Raw topographic paths exactly from Submarine Map
          properties: {
            domain: 'SEA',
            fromName: cable.properties?.name || t('Submarine Cable'),
            toName: cable.properties?.landing_points || '',
            source: 'Global Subsea Cable Network',
            url: 'https://www.submarinecablemap.com/',
            ...cable.properties,
            color: '#1976D2', // Darker blue as requested, more transparent in layer paint
          },
        });
      }
    }

    setGeo('sdk-links', links);
  }, [mapReady, activeLayers.sdk_sea, activeLayers.sdk_air, activeLayers.sdk_naval, data.submarine_cables, setGeo]);
}
