'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ActiveLayers } from '@/lib/layers/defaults';
import { pickLandingCity } from '@/lib/places/landing-cities';
import { loadLayers } from '@/lib/layers/saved';
import type { FlyToTarget } from './types';

type Home = { lat: number; lng: number; zoom?: number };

/** The view a shared link names (share-panel.tsx writes lat, lon and zoom), if it is a real place. */
function sharedView(p: URLSearchParams): Home | null {
  if (!p.has('lat') || !p.has('lon')) return null;
  const lat = Number(p.get('lat'));
  const lng = Number(p.get('lon'));
  const zoom = Number(p.get('zoom'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, zoom: p.has('zoom') && Number.isFinite(zoom) ? Math.min(18, Math.max(1.5, zoom)) : undefined };
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
  const [homeLocation, setHomeLocation] = useState<Home | null>(() =>
    typeof window === 'undefined' ? null : sharedView(new URLSearchParams(window.location.search)));
  /** Set once the viewer (or a shared run) takes the camera, so a late answer does not fly it away. */
  const autoLocateCancelled = useRef(false);

  /* Fly from the globe down to the viewer's city once the splash has gone.
     Starting as it began to fade meant a busy first load (the satellite
     catalogue is ~19k objects) could hold the fade until the camera was
     nearly at street level, and the globe was never seen. */
  useEffect(() => {
    if (!splashGone || !homeLocation || autoLocateCancelled.current) return;
    setFlyToLocation({ ...homeLocation, zoom: homeLocation.zoom ?? 8, duration: 3500, quiet: true, ts: Date.now() });
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
       failed, or no answer within 6 s) the fly-in still happens, to a random
       well-covered city, rather than stopping on the globe. */
    const shared = sharedView(p);
    let located = !!shared;
    const landSomewhere = () => {
      if (located || geoController.signal.aborted) return;
      located = true;
      const city = pickLandingCity();
      setHomeLocation({ lat: city.lat, lng: city.lng });
    };
    const geoGiveUp = setTimeout(landSomewhere, 6000);
    if (!shared) fetch('/api/geo', { signal: geoController.signal })
      .then(r => r.json())
      .then(geo => {
        if (located || geoController.signal.aborted) return;
        if (geo.status === 'success' &&
            Number.isFinite(geo.lat) && Number.isFinite(geo.lon) && Math.abs(geo.lat) <= 90 && Math.abs(geo.lon) <= 180) {
          located = true;
          setHomeLocation({ lat: geo.lat, lng: geo.lon });
        } else {
          landSomewhere();
        }
      })
      .catch(landSomewhere);

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
