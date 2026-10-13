'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AU_KM } from '@/lib/space/astro';
import type { StarCatalog } from '@/lib/space/earth-sky-layer';
import { LY_KM } from '@/lib/space/astro';
import type { CosmosMeta } from '@/lib/space/cosmos';
import type { NearbyStarCatalog } from '@/lib/space/nearby-stars';
import type { SpaceSelection } from '@/lib/space/selection';
import type { SatellitePoint } from './scene/earth';
import type { ReplayState } from './scene/flight-replay';
import { SpaceScene, type CameraInfo, type SpaceLayers } from './scene/space-scene';
import type { MapTarget } from './scene/zoom-anchor';
import { useExoplanets, useFleet, useOuter, useSky, useSunFrames, useSurface } from './use-space-data';

const json = <T,>(url: string) => fetch(url).then(r => (r.ok ? r.json() as Promise<T> : null)).catch(() => null);
let stars: Promise<StarCatalog | null> | null = null;
const loadStars = () => (stars ??= json<StarCatalog>('/data/sky/bright-stars.json'));
let nearby: Promise<NearbyStarCatalog | null> | null = null;
const loadNearby = () => (nearby ??= json<NearbyStarCatalog>('/data/sky/nearby-stars.json'));
const binary = (url: string) => fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
let cosmosMeta: Promise<CosmosMeta | null> | null = null;
const loadCosmosMeta = () => (cosmosMeta ??= json<CosmosMeta>('/data/cosmos/cosmos.json'));
let localGalaxies: Promise<ArrayBuffer | null> | null = null;
let deepGalaxies: Promise<ArrayBuffer | null> | null = null;

/** What each deeper layer needs loaded, by camera distance from the Sun; the System view stays as light as before. */
const OUTER_FROM_KM = 10 * AU_KM;
const STARS_FROM_KM = 700 * AU_KM;
const LOCAL_GALAXIES_FROM_KM = 2e6 * LY_KM;
const DEEP_GALAXIES_FROM_KM = 80e6 * LY_KM;

export type { CameraInfo };

/** A ref callback that mounts the space scene, and the scene once mounted, kept fed with every data source it draws. */
export function useSpaceScene(opts: {
  satellites: SatellitePoint[] | undefined;
  layers: SpaceLayers;
  selection: SpaceSelection | null;
  onSelect: (sel: SpaceSelection | null) => void;
  onSurface: (to: MapTarget) => void;
  /** Deeper data a request needs before the camera gets there. */
  wants?: { outer?: boolean; stars?: boolean };
}) {
  const [scene, setScene] = useState<SpaceScene | null>(null);
  const [camera, setCamera] = useState<CameraInfo | null>(null);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [reach, setReach] = useState({ outer: false, stars: false });
  const [catalog, setCatalog] = useState<NearbyStarCatalog | null>(null);
  const handlers = useRef({ onSelect: opts.onSelect, onSurface: opts.onSurface });
  useEffect(() => { handlers.current = { onSelect: opts.onSelect, onSurface: opts.onSurface }; }, [opts.onSelect, opts.onSurface]);

  const sky = useSky(true);
  const fleet = useFleet(true);
  const sun = useSunFrames(true);
  const moon = useSurface('moon');
  const mars = useSurface('mars');
  const outer = useOuter(reach.outer);
  const exoplanets = useExoplanets(reach.stars);

  const mount = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const s = new SpaceScene(el, {
      onSelect: sel => handlers.current.onSelect(sel),
      onCamera: setCamera,
      onReplay: setReplay,
      onSurface: to => handlers.current.onSurface(to),
    });
    loadStars().then(c => { if (c) s.setStars(c); });
    setScene(s);
    return () => {
      setScene(null);
      s.dispose();
    };
  }, []);

  const sunKm = camera?.sunKm ?? 0;
  const needOuter = sunKm > OUTER_FROM_KM || !!opts.wants?.outer, needStars = sunKm > STARS_FROM_KM || !!opts.wants?.stars;
  if ((needOuter && !reach.outer) || (needStars && !reach.stars)) setReach({ outer: reach.outer || needOuter, stars: reach.stars || needStars });
  useEffect(() => {
    if (!scene || !reach.stars) return;
    let live = true;
    loadNearby().then(c => { if (c && live) { scene.setNearbyStars(c); setCatalog(c); } });
    return () => { live = false; };
  }, [scene, reach.stars]);

  // Past the Local Group: the galaxy surveys, loaded once each as the camera first gets out to them.
  const cosmosStage = sunKm > DEEP_GALAXIES_FROM_KM ? 2 : sunKm > LOCAL_GALAXIES_FROM_KM ? 1 : 0;
  const [cosmosReached, setCosmosReached] = useState(0);
  if (cosmosStage > cosmosReached) setCosmosReached(cosmosStage);
  useEffect(() => {
    if (!scene || cosmosReached < 1) return;
    let live = true;
    const { local, deep } = scene.cosmos.loaded();
    loadCosmosMeta().then(m => {
      if (!m || !live) return;
      if (!scene.cosmos.meta()) scene.cosmos.setMeta(m);
      if (!local) (localGalaxies ??= binary(`/data/cosmos/${m.local.file}`)).then(b => { if (b && live && !scene.cosmos.loaded().local) scene.cosmos.setLocal(b); });
      if (cosmosReached >= 2 && !deep) (deepGalaxies ??= binary(`/data/cosmos/${m.deep.file}`)).then(b => { if (b && live && !scene.cosmos.loaded().deep) scene.cosmos.setDeep(b); });
    });
    return () => { live = false; };
  }, [scene, cosmosReached]);

  useEffect(() => { if (scene && sky) scene.setSky(sky); }, [scene, sky]);
  useEffect(() => { if (scene && fleet) scene.setFleet(fleet); }, [scene, fleet]);
  useEffect(() => { if (scene && moon) scene.setSurface(moon); }, [scene, moon]);
  useEffect(() => { if (scene && mars) scene.setSurface(mars); }, [scene, mars]);
  useEffect(() => { if (scene && outer) scene.setOuter(outer); }, [scene, outer]);
  useEffect(() => { if (scene && exoplanets) scene.setExoplanets(exoplanets); }, [scene, exoplanets]);
  useEffect(() => { if (scene && opts.satellites) scene.setSatellites(opts.satellites); }, [scene, opts.satellites]);
  useEffect(() => { scene?.setLayers(opts.layers); }, [scene, opts.layers]);
  useEffect(() => { scene?.setSelection(opts.selection); }, [scene, opts.selection]);
  useEffect(() => {
    const t = sun?.frames.find(f => f.key === 'aia171')?.frameTime;
    if (scene && t) scene.setSunFrame(`/api/space/sun/aia171?t=${encodeURIComponent(t)}`);
  }, [scene, sun]);

  return { mount, scene, camera, replay, sky, fleet, moon, mars, outer, exoplanets, catalog };
}
