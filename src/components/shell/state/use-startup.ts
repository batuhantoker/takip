'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import { pickLandingCity } from '@/lib/places/landing-cities';
import { timeZoneCity } from '@/lib/places/timezone-cities';
import { browserTimeZone, locateVisitor } from '@/lib/places/ip-location/browser';
import { loadLayers } from '@/lib/map/layers/saved';
import { parseTrack, requestTrack } from '@/components/map/inspect/track-request';
import type { FlyToTarget } from './types';

type Home = { lat: number; lng: number; zoom?: number };

/** A newcomer lands on the globe over where they are, not on their streets: the satellites, aurora and night side in view. */
const GLOBE_ZOOM = 2.3;

/** The view a shared link names (share-panel.tsx writes lat, lon and zoom; a card's link adds track), if it is a real place. */
function sharedView(p: URLSearchParams): Home | null {
  if (!p.has('lat') || !p.has('lon')) return null;
  const lat = Number(p.get('lat'));
  const lng = Number(p.get('lon'));
  const zoom = Number(p.get('zoom'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, zoom: p.has('zoom') && Number.isFinite(zoom) ? Math.min(18, Math.max(1.5, zoom)) : undefined };
}

/** `near=<zoom>`: open around the visitor at that zoom, the link's own view being only the fallback. */
function nearZoom(p: URLSearchParams): number | null {
  const z = Number(p.get('near'));
  return p.has('near') && Number.isFinite(z) ? Math.min(18, Math.max(1.5, z)) : null;
}

/** On mount: restore layers, probe optional feeds, and fly to a shared view or the viewer's city once the splash has gone. */
export function useStartup({ setActiveLayers, setFlyToLocation, splashGone }: {
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
  splashGone: boolean;
}) {
  /** Server-side capability flags: layers that need credentials stay hidden without them. */
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  /* Where the viewer is: a shared link's view, else by IP (asked for at once).
     The camera flies there once the splash has gone. */
  const [homeLocation, setHomeLocation] = useState<Home | null>(() => {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search);
    return nearZoom(p) === null ? sharedView(p) : null;
  });
  /** Set once the viewer (or a shared run) takes the camera, so a late answer does not fly it away. */
  const autoLocateCancelled = useRef(false);

  /* Turn the globe to the viewer once the splash has gone; a shared link's own zoom wins.
     Starting as it began to fade meant a busy first load (the satellite
     catalogue is ~19k objects) could hold the fade until the camera had
     moved, and the opening globe was never seen. */
  useEffect(() => {
    if (!splashGone || !homeLocation || autoLocateCancelled.current) return;
    setFlyToLocation({ ...homeLocation, zoom: homeLocation.zoom ?? GLOBE_ZOOM, duration: 3500, quiet: true, ts: Date.now() });
  }, [splashGone, homeLocation, setFlyToLocation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // A shared link's layers win over the ones this browser remembers.
    const p = new URLSearchParams(window.location.search);
    const layers = p.get('layers');
    if (layers !== null) {
      const active = layers.split(',');
      // Links from before the vessel filters existed name none of them; keep the defaults then.
      const linkSetsShips = active.some(k => k.startsWith('ships_'));
      setActiveLayers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.startsWith('ships_') && !linkSetsShips) return;
          (next as any)[k] = active.includes(k);
        });
        return next;
      });
    } else {
      setActiveLayers(prev => ({ ...prev, ...loadLayers(prev) }));
    }

    // Probe which credential-gated feeds this deployment has configured, so the
    // layer panel can hide toggles that could never return data.
    fetch('/api/cloudflare-radar?probe=1')
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (p) setCapabilities(c => ({ ...c, cloudflare: !!p.configured })); })
      .catch(() => { /* leave the layer hidden */ });
    // Reference layers need data/reference/ on this server (see its README).
    fetch('/api/reference')
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (p) setCapabilities(c => ({ ...c, reference: !!p.available })); })
      .catch(() => { /* leave the layers hidden */ });

    // Once the user interacts, a late IP-location response must not steal the
    // camera back. The request is also cancelled when this page unmounts.
    const geoController = new AbortController();
    const cancelAutoLocate = () => { autoLocateCancelled.current = true; };
    window.addEventListener('pointerdown', cancelAutoLocate, { once: true });
    window.addEventListener('keydown', cancelAutoLocate, { once: true });
    /* Asked for at once rather than after a fixed 3 s wait, so the answer is
       in hand when the splash lifts; the effect above does the flying. When
       the visitor's city can't be found (no public address, every provider
       failed, or no answer within 6 s) the fly-in still happens, to the
       browser time zone's city, else a random well-covered one. */
    const shared = sharedView(p);
    const near = nearZoom(p);
    let located = !!shared && near === null;

    // A link that follows an aircraft, ship or satellite (track=aircraft:4bb1c2): the map finds it and follows it.
    const track = parseTrack(p.get('track'));
    if (track) {
      requestTrack(track);
      const needs = track.kind === 'ship' ? ['maritime'] : track.kind === 'satellite' ? ['satellites'] : ['flights', 'private', 'jets', 'military'];
      setActiveLayers(prev => (needs.some(k => prev[k as keyof ActiveLayers]) ? prev : { ...prev, ...Object.fromEntries(needs.map(k => [k, true])) }));
      // With no view in the link, the camera goes to the target, not the viewer's city.
      if (!shared) autoLocateCancelled.current = true;
    }
    const land = (home: Home) => {
      if (located || geoController.signal.aborted) return;
      located = true;
      setHomeLocation(home);
    };
    const landSomewhere = () => {
      if (located || geoController.signal.aborted) return;
      if (shared) return land(shared);
      const zone = timeZoneCity(browserTimeZone());
      if (zone) return land({ lng: zone[0], lat: zone[1] });
      const city = pickLandingCity();
      land({ lat: city.lat, lng: city.lng });
    };
    const geoGiveUp = setTimeout(landSomewhere, 6000);
    if (!located) {
      void locateVisitor(geoController.signal)
        .then(home => (home ? land(near === null ? home : { ...home, zoom: near }) : landSomewhere()))
        .catch(landSomewhere);
    }

    return () => {
      clearTimeout(geoGiveUp);
      geoController.abort();
      window.removeEventListener('pointerdown', cancelAutoLocate);
      window.removeEventListener('keydown', cancelAutoLocate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { capabilities, autoLocateCancelled };
}
