'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Vector3 } from 'three';
import { bodyDirection } from '@/lib/space/frames';
import type { GlobeView } from '@/lib/space/globe-match';
import { jdFromMs } from '@/lib/space/horizons';
import type { SpaceSelection } from '@/lib/space/selection';
import { LANDING_SITES } from '@/lib/space/landing-sites';
import type { SkyKey } from '@/lib/space/sky';
import type { SpaceFocus } from '@/lib/space/worlds';
import { isSpaceFocus } from '@/lib/space/worlds';
import { craftView, deepView, DEFAULT_MAP_LINK, FOCUS_DISTANCE_KM, focusAnchor, focusDirection, focusForView, globeEntry, mapEntry } from './scene/focus-camera';
import type { SatellitePoint } from './scene/earth';
import type { SpaceLayers, SpaceScene } from './scene/space-scene';
import type { MapTarget } from './scene/zoom-anchor';
import { ReplayModel } from '@/lib/space/replay-model';
import FlightReplayBar, { type ReplayControls } from './replay/flight-replay-bar';
import { useFlightHistory } from './replay/use-flight-history';
import SpaceCard from './space-card';
import SpacePanelLeft from './space-panel-left';
import { useNow } from './use-space-data';
import { useSpaceScene } from './use-space-scene';

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

const DEFAULT_LAYERS: SpaceLayers = { satellites: true, fleet: true, orbits: true, surface: true, labels: true, illustrations: true, constellations: true, exoplanets: true };

export default function SpaceShell({ request, satellites, onFocus, onExit }: {
  request: SpaceRequest;
  satellites?: SatellitePoint[];
  onFocus: (f: SpaceFocus) => void;
  /** `to` is the map view to land on, when the operator zoomed back down into Earth. */
  onExit: (to?: MapTarget) => void;
}) {
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
  const { mount, scene, camera, replay, sky, fleet, moon, mars, outer, exoplanets, catalog } = useSpaceScene({ satellites, layers, selection, onSelect: setSelection, onSurface: onExit, wants });
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
      setShown(true);
      // Only now, as it fades in, does the hand-over carry on outward.
      if (carryOn.current) {
        carryOn.current = false;
        s.nudge(1.35, 900);
      }
    }, 40);
  }, []);
  useEffect(() => () => { if (reveal.current) clearInterval(reveal.current); }, []);

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
    if (g) s.setMapLink({ pitch: g.pitch, fov: g.fov, height: g.height || s.renderer.domElement.clientHeight || DEFAULT_MAP_LINK.height, minZoom: g.minZoom ?? DEFAULT_MAP_LINK.minZoom });
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
  }, [sky, fleet, catalog, exoplanets, outer, request, scene, fly, revealWhenReady]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (selection) setSelection(null);
      else if (replayId !== null) closeReplay();
      else onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, onExit, replayId, closeReplay]);

  const surfaces = useMemo(() => ({ moon, mars }), [moon, mars]);

  return (
    <motion.div data-space-view initial={{ opacity: 0 }} animate={{ opacity: shown ? 1 : 0 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: request.via === 'zoom' ? 0.5 : 0.25 }}
      className={`absolute inset-0 z-[150] bg-[#020206] ${shown ? '' : 'pointer-events-none'}`}>
      <div ref={mount} className="absolute inset-0" />
      <div data-hud className="pointer-events-none absolute top-16 bottom-[96px] z-[205] hidden flex-col gap-2 overflow-y-auto md:flex" style={{ left: 'calc(var(--shell-left, 72px) + 12px)' }}>
        <SpacePanelLeft camera={camera} layers={layers} setLayers={setLayers} fleet={fleet} satelliteCount={satellites?.length ?? 0} deep={{ outer, exoplanets, catalog }} />
        {selection && (
          <SpaceCard selection={selection} now={now} sky={sky} fleet={fleet} surfaces={surfaces} scene={scene}
            onClose={() => setSelection(null)} onFly={() => fly(selection)}
            onReplay={selection.kind === 'craft' && fleet?.craft.find(c => c.id === selection.id)?.region !== 'earth-orbit' ? () => setReplayId(selection.id) : undefined} />
        )}
      </div>
      {replayId !== null && (
        <div className="pointer-events-none absolute bottom-[88px] z-[206] flex justify-center" style={{ left: 'var(--shell-left, 72px)', right: 0 }}>
          <FlightReplayBar name={fleet?.craft.find(c => c.id === replayId)?.name ?? 'Spacecraft'}
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
