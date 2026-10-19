'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, usePresence } from 'framer-motion';
import { Vector3 } from 'three';
import { bodyDirection } from '@/lib/space/frames';
import { floorZoom, type GlobeLink, type GlobeView, type MapPose } from '@/lib/space/globe-match';
import { jdFromMs } from '@/lib/space/horizons';
import type { SpaceSelection } from '@/lib/space/selection';
import { LANDING_SITES } from '@/lib/space/craft/landing-sites';
import type { SkyKey } from '@/lib/space/sky';
import type { SpaceFocus } from '@/lib/space/worlds';
import { isSpaceFocus } from '@/lib/space/worlds';
import { craftView, deepView, DEFAULT_MAP_LINK, FOCUS_DISTANCE_KM, focusAnchor, focusDirection, focusForView, globeEntry, mapEntry } from '@/lib/space/scene/camera/focus';
import type { SatellitePoint } from '@/lib/space/scene/earth';
import type { SpaceScene } from '@/lib/space/scene/space-scene';
import type { SpaceLayers } from '@/lib/space/scene/types';
import type { MapTarget } from '@/lib/space/scene/camera/zoom-anchor';
import { ReplayModel } from '@/lib/space/replay/model';
import FlightReplayBar, { type ReplayControls } from '@/components/panels/space/replay/flight-replay-bar';
import { useFlightHistory } from '@/components/panels/space/replay/use-flight-history';
import SpaceCard from './space-card';
import SpacePanelLeft from './space-panel-left';
import { useNow } from '@/components/panels/space/use-space-data';
import { useSpaceScene } from './use-space-scene';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';

/**
 * TAKIP — the space view: the scene, its left panel and its inspect card.
 * Mounted over the Earth map, which stays alive underneath so leaving space
 * puts the operator back exactly where they were.
 */

export interface SpaceRequest {
  focus: SpaceFocus;
  select?: SpaceSelection;
  /** The map's centre and zoom when space was entered from it: the camera starts there. */
  entry?: { lat: number; lng: number; zoom: number };
  /** 'zoom': the operator zoomed out past the globe, so the camera carries on outward from it. */
  via?: 'zoom';
  /** The map globe's exact view at that moment, for opening on the same picture. */
  globe?: GlobeView;
  /** A spacecraft whose flight to play back on arrival. */
  replay?: number;
  ts: number;
}

/** Longest the view waits, hidden, for Earth's texture before showing anyway. */
const READY_WAIT_MS = 1500;
/** The space view fading over the map, held on its camera; a plain fade when the map is off somewhere else. */
const FADE_MS = 600;
const CUT_MS = 350;
/** Flying home, a map nearer than this above its floor is first put back on the whole globe, then flown down again. */
const HOME_ABOVE_FLOOR = 0.6;
const BACK_DOWN_MS = 1800;

/**
 * The way back to the map: 'home' flies to the map's globe, 'fade' fades out
 * held on the map's camera, 'cut' just fades (the map is flying elsewhere).
 */
type Leaving = 'home' | 'fade' | 'cut';

const DEFAULT_LAYERS: SpaceLayers = { satellites: true, fleet: true, orbits: true, surface: true, labels: true, illustrations: true, constellations: true, exoplanets: true };

export default function SpaceShell({ request, satellites, map, onFocus, onExit }: {
  request: SpaceRequest;
  satellites?: SatellitePoint[];
  /** The live Earth map underneath, met exactly on the way back. */
  map?: GlobeLink | null;
  onFocus: (f: SpaceFocus) => void;
  /** `to` is the map view to land on, when the operator zoomed back down into Earth and there is no `map` to move. */
  onExit: (to?: MapTarget) => void;
}) {
  const t = useT();
  const [isPresent, safeToRemove] = usePresence();
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<SpaceLayers>(DEFAULT_LAYERS);
  const [selection, setSelection] = useState<SpaceSelection | null>(request.select ?? null);
  // A new request with something to select replaces the selection as it arrives.
  const [seenRequest, setSeenRequest] = useState(request.ts);
  const [replayId, setReplayId] = useState<number | null>(request.replay ?? null);
  if (seenRequest !== request.ts) {
    setSeenRequest(request.ts);
    if (request.select) setSelection(request.select);
    if (request.replay) setReplayId(request.replay);
  }
  const wants = useMemo(() => ({
    outer: request.select?.kind === 'outer',
    stars: request.select?.kind === 'star' || request.select?.kind === 'exohost' || request.focus === 'stars' || request.focus === 'galaxy',
  }), [request]);
  const pick = useCallback((sel: SpaceSelection | null) => { if (!leaving) setSelection(sel); }, [leaving]);
  // Zoomed back down into Earth: the map takes the same view at once, and the space view fades out over it held there.
  const sceneRef = useRef<SpaceScene | null>(null);
  const land = useCallback((to: MapTarget) => {
    const s = sceneRef.current;
    if (!s || !map) return onExit(to);
    map.jump(to);
    s.holdOnMap(() => map.view());
    setLeaving('fade');
    // Now, not on the next render: the wheel still turning goes straight on to the map.
    root.current?.setAttribute('inert', '');
    onExit();
  }, [map, onExit]);
  const { mount, scene, camera, replay, sky, fleet, moon, mars, outer, exoplanets, catalog } = useSpaceScene({ satellites, layers, selection, onSelect: pick, onSurface: land, wants });
  useEffect(() => { sceneRef.current = scene; }, [scene]);
  const flight = useFlightHistory(replayId);
  // The flight starts playing back as soon as its history is in.
  useEffect(() => {
    if (!scene || !flight.history || flight.history.id !== replayId || scene.replay?.state.craftId === replayId) return;
    scene.startReplay(new ReplayModel(flight.history), flight.history.id);
    scene.replay?.play();
  }, [scene, flight.history, replayId]);
  const closeReplay = useCallback(() => {
    scene?.stopReplay();
    setReplayId(null);
  }, [scene]);
  const controls = useMemo<ReplayControls>(() => ({
    play: () => scene?.replay?.play(),
    pause: () => scene?.replay?.pause(),
    seek: jd => scene?.replay?.seek(jd),
    setRate: days => scene?.replay?.setRate(days),
    follow: on => scene?.followReplay(on),
    close: closeReplay,
  }), [scene, closeReplay]);
  const now = useNow(1000, selection !== null);
  const handled = useRef(0);
  // Shown once the camera is placed and Earth has its texture, so the map never cuts to a blank frame.
  const [shown, setShown] = useState(false);
  const reveal = useRef<ReturnType<typeof setInterval> | null>(null);
  const carryOn = useRef(false);
  const revealWhenReady = useCallback((s: SpaceScene) => {
    if (reveal.current) return;
    const t0 = Date.now();
    reveal.current = setInterval(() => {
      if (!s.earth.textured() && Date.now() - t0 < READY_WAIT_MS) return;
      clearInterval(reveal.current!);
      // Free for the next request: zooming out again after the way back was called off carries on outward too.
      reveal.current = null;
      setShown(true);
      // Only now, as it fades in, does the hand-over carry on outward.
      if (carryOn.current) {
        carryOn.current = false;
        s.nudge(1.35, 900);
      }
    }, 40);
  }, []);
  useEffect(() => () => { if (reveal.current) clearInterval(reveal.current); }, []);

  // The page has left space, or called it back on the way out: choose the way back to the map here, run it below.
  const [wasPresent, setWasPresent] = useState(isPresent);
  if (wasPresent !== isPresent) {
    setWasPresent(isPresent);
    if (isPresent) setLeaving(null);
    // A search or an alert is already flying the map somewhere else, or the map is flat: there is no globe to meet.
    else if (!leaving && scene && map && shown && !map.moving() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLeaving('home');
      // Flying home ends the replay; called back, the view is live.
      setReplayId(null);
    } else if (!leaving) setLeaving('cut');
  }

  const fly = useCallback((sel: SpaceSelection) => {
    const s = scene;
    if (!s) return;
    const jd = jdFromMs(Date.now());
    if (sel.kind === 'body') {
      const f: SpaceFocus | null = isSpaceFocus(sel.key) ? sel.key : null;
      s.setAnchor({ kind: 'body', key: sel.key as SkyKey }, { distance: f ? FOCUS_DISTANCE_KM[f] : bodyDistance(s.planets.get(sel.key)?.def.radiusKm), direction: f ? focusDirection(s, f, jd) : undefined });
      if (f) onFocus(f);
    } else if (sel.kind === 'craft') {
      const c = fleet?.craft.find(k => k.id === sel.id);
      // Earth-orbit craft are the satellite layer's; the fleet's six-hour-old state cannot place them.
      if (c?.region === 'earth-orbit') {
        s.setAnchor(focusAnchor('earth'), { distance: FOCUS_DISTANCE_KM.earth });
        onFocus('earth');
      } else if (c && (c.region === 'moon' || c.region === 'mars') && !s.anchorState({ kind: 'craft', id: c.id })) {
        // A lander, or an orbiter Horizons cannot track over the surface: go to its body.
        s.setAnchor(focusAnchor(c.region), { distance: FOCUS_DISTANCE_KM[c.region], direction: focusDirection(s, c.region, jd) });
        onFocus(c.region);
      } else if (c) s.setAnchor({ kind: 'craft', id: c.id }, craftView(c));
    } else if (sel.kind === 'site' || sel.kind === 'rover' || sel.kind === 'orbiter') {
      const world = sel.kind === 'rover' ? 'mars' : sel.world;
      const target = sel.kind === 'site' ? LANDING_SITES[world].find(x => x.id === sel.id) : null;
      s.setAnchor({ kind: 'body', key: world }, { distance: FOCUS_DISTANCE_KM[world] * 0.6, direction: target ? surfaceDirection(s, world, target.lat, target.lng) : undefined });
      onFocus(world);
    } else {
      const v = deepView(sel, a => s.anchorState(a)?.position);
      if (v) s.setAnchor(v.anchor, v);
    }
  }, [scene, fleet, onFocus]);

  // Requests from the switcher, the dock or a map popup; each waits for the data it needs.
  useEffect(() => {
    const s = scene;
    if (!s || !sky || handled.current === request.ts) return;
    const sel = request.select;
    // A running replay has placed its own camera; before its history is in, the view opens as usual.
    if (request.replay && s.replay?.state.craftId === request.replay) {
      handled.current = request.ts;
      revealWhenReady(s);
      return;
    }
    if (sel?.kind === 'craft' && !fleet?.craft.some(c => c.id === sel.id)) return;
    if ((sel?.kind === 'star' && !catalog) || (sel?.kind === 'exohost' && !exoplanets) || (sel?.kind === 'outer' && !outer)) return;
    handled.current = request.ts;
    revealWhenReady(s);
    const jd = jdFromMs(Date.now());
    const g = request.globe;
    const drawn = g ?? map?.view();
    // The map comes back at its resting tilt unless it was left from the globe at another.
    if (drawn) s.setMapLink({ pitch: g?.pitch ?? DEFAULT_MAP_LINK.pitch, fov: drawn.fov, height: drawn.height || s.renderer.domElement.clientHeight || DEFAULT_MAP_LINK.height, minZoom: drawn.minZoom ?? DEFAULT_MAP_LINK.minZoom });
    const e = g && request.via === 'zoom' ? globeEntry(jd, g, { fov: s.camera.fov, height: s.renderer.domElement.clientHeight || g.height }) : null;
    if (g && e && Number.isFinite(e.distance) && e.distance > 6371) {
      // Earth exactly as the globe drew it, then on outward a little: one motion, not a cut.
      s.setAnchor(focusAnchor('earth'), { distance: e.distance, direction: e.direction, instant: true });
      carryOn.current = true;
      return;
    }
    if (request.entry) {
      const e = mapEntry(jd, request.entry.lat, request.entry.lng, request.entry.zoom);
      s.setAnchor(focusAnchor('earth'), { distance: e.distance, direction: e.direction, instant: true });
      if (request.focus === 'earth' && !sel) {
        s.setAnchor(focusAnchor('earth'), { distance: FOCUS_DISTANCE_KM.earth, direction: e.direction });
        return;
      }
    }
    if (sel) {
      fly(sel);
      return;
    }
    s.setAnchor(focusAnchor(request.focus), { distance: FOCUS_DISTANCE_KM[request.focus], direction: focusDirection(s, request.focus, jd) });
  }, [sky, fleet, catalog, exoplanets, outer, request, scene, fly, revealWhenReady, map]);

  // Fly home onto the map's own globe; arrived, the view fades out held on the map's camera.
  const back = useRef<MapPose | null>(null);
  useEffect(() => {
    if (leaving !== 'home' || !scene || !map) return;
    const v = map.view();
    const floor = floorZoom(v.minZoom ?? DEFAULT_MAP_LINK.minZoom, v.lat);
    const deep = v.zoom > floor + HOME_ABOVE_FLOOR;
    if (deep || v.bearing) {
      back.current = deep ? { lat: v.lat, lng: v.lng, zoom: v.zoom, pitch: v.pitch, bearing: v.bearing } : null;
      map.jump({ lat: v.lat, lng: v.lng, zoom: deep ? floor + HOME_ABOVE_FLOOR : v.zoom, pitch: deep ? DEFAULT_MAP_LINK.pitch : v.pitch, bearing: 0 });
    }
    const ms = scene.flyHome(() => map.view(), () => setLeaving('fade'));
    // rAF stops in a hidden tab; the way out must not.
    const late = setTimeout(() => {
      scene.holdOnMap(() => map.view());
      setLeaving('fade');
    }, ms + 1500);
    return () => clearTimeout(late);
  }, [leaving, scene, map]);

  // Called back into space on the way out: the camera is the operator's again.
  useEffect(() => {
    if (leaving) return;
    scene?.release();
    root.current?.removeAttribute('inert');
    back.current = null;
  }, [leaving, scene]);

  useEffect(() => {
    if (leaving !== 'fade' && leaving !== 'cut') return;
    root.current?.setAttribute('inert', '');
    // Held on the map's camera, the space view goes along with the map flying back down.
    if (leaving === 'fade' && back.current && map) map.fly(back.current, BACK_DOWN_MS);
    back.current = null;
    const done = setTimeout(() => safeToRemove?.(), leaving === 'fade' ? FADE_MS : CUT_MS);
    return () => clearTimeout(done);
  }, [leaving, map, safeToRemove]);

  // The switcher follows the wheel: zooming out past the planets lights up Stars, then Galaxy.
  const followed = useRef<SpaceFocus | null>(null);
  useEffect(() => {
    if (!scene || !camera || scene.rig.flying()) return;
    const f = focusForView(scene.anchor, camera.sunKm);
    if (f && f !== followed.current) {
      followed.current = f;
      onFocus(f);
    }
  }, [scene, camera, onFocus]);

  // On the shared Escape stack, so a panel or popover opened over space closes first, and alone.
  useEscape(() => {
    if (selection) setSelection(null);
    else if (replayId !== null) closeReplay();
    else onExit();
  }, isPresent && !leaving);

  const surfaces = useMemo(() => ({ moon, mars }), [moon, mars]);

  return (
    <motion.div ref={root} data-space-view initial={{ opacity: 0 }} animate={{ opacity: shown && leaving !== 'fade' && leaving !== 'cut' ? 1 : 0 }}
      transition={leaving === 'fade' || leaving === 'cut' ? { duration: (leaving === 'fade' ? FADE_MS : CUT_MS) / 1000, ease: 'easeInOut' } : { duration: request.via === 'zoom' ? 0.5 : 0.25 }}
      className={`absolute inset-0 z-[150] bg-black ${shown ? '' : 'pointer-events-none'}`}>
      <div ref={mount} className="absolute inset-0" />
      <div data-hud inert={!!leaving} className={`pointer-events-none absolute top-16 bottom-[96px] z-[205] hidden flex-col transition-opacity duration-150 ease-out md:flex ${leaving ? 'opacity-0' : ''}`} style={{ left: 'calc(var(--shell-left, 72px) + 12px)' }}>
        <SpacePanelLeft camera={camera} layers={layers} setLayers={setLayers} fleet={fleet} satelliteCount={satellites?.length ?? 0} deep={{ outer, exoplanets, catalog }} />
      </div>
      {/* Where the map's inspect card opens, so a picked thing reads the same in space. */}
      {selection && !leaving && (
        <div data-hud className="pointer-events-none absolute top-3 right-3 bottom-[96px] z-[205] hidden flex-col items-end md:flex">
          <SpaceCard selection={selection} now={now} sky={sky} fleet={fleet} surfaces={surfaces} scene={scene}
            onClose={() => setSelection(null)} onFly={() => fly(selection)}
            onReplay={selection.kind === 'craft' && fleet?.craft.find(c => c.id === selection.id)?.region !== 'earth-orbit' ? () => setReplayId(selection.id) : undefined} />
        </div>
      )}
      {replayId !== null && !leaving && (
        <div className="pointer-events-none absolute bottom-[88px] z-[206] flex justify-center" style={{ left: 'var(--shell-left, 72px)', right: 0 }}>
          <FlightReplayBar name={fleet?.craft.find(c => c.id === replayId)?.name ?? t('Spacecraft')}
            model={scene?.replay?.state.craftId === replayId ? scene.replay.model : null} state={replay} error={flight.error} controls={controls} />
        </div>
      )}
    </motion.div>
  );
}

function bodyDistance(radiusKm = 6371): number {
  return radiusKm * 6;
}

/** Straight above a surface point, so "fly here" on a landing site lands over it. */
function surfaceDirection(s: SpaceScene, world: 'moon' | 'mars', lat: number, lng: number): Vector3 | undefined {
  const planet = s.planets.get(world);
  return planet ? new Vector3(...bodyDirection(lat, lng)).transformDirection(planet.spin.matrix) : undefined;
}
