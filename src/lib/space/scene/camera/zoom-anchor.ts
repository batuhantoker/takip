import { AU_KM, LY_KM } from '@/lib/space/astro';
import { jdFromMs } from '@/lib/space/horizons';
import type { SpaceSelection } from '@/lib/space/selection';
import type { MapPose } from '@/lib/space/globe-match';
import { deepView, DEFAULT_MAP_LINK, mapReturn, mapReturnDropPx, mapReturnKm, picturedUp, type MapLink } from './focus';
import { pickAt } from '../hud/targets';
import type { SpaceScene } from '../space-scene';
import type { Anchor } from '../types';
import { ramp } from '../tiers';

/**
 * The wheel alone carries the camera from Earth to the edge of the universe
 * and back. Zooming in over something re-centres on it; zooming far out from
 * a body hands the camera to the Sun, and from the Sun to the galactic
 * centre; zooming back in retraces that chain to Earth, and into the map.
 */

/** Past this from a planet, moon or craft, the Sun is the better pivot. */
const TO_SUN_KM = 4e7;
const TO_GALAXY_KM = 9_000 * LY_KM;
/** Zooming in, nearer than these the pivot goes back down the chain toward Earth. */
const BACK_TO_SUN_KM = 60_000 * LY_KM;
const BACK_TO_EARTH_KM = 1.5 * AU_KM;
const RETARGET_MS = 700;
/** Pointer this near the middle of the view (fraction of its shorter side) zooms along the chain, not onto what is under it. */
const CENTRE_ZONE = 0.12;
const HANDOFF_MS = 1400;

export type MapTarget = Required<MapPose>;

function anchorFor(sel: SpaceSelection): Anchor | null {
  if (sel.kind === 'body') return sel.key === 'sun' ? { kind: 'system' } : { kind: 'body', key: sel.key };
  if (sel.kind === 'craft') return { kind: 'craft', id: sel.id };
  if (sel.kind === 'site' || sel.kind === 'orbiter') return { kind: 'body', key: sel.world };
  if (sel.kind === 'rover') return { kind: 'body', key: 'mars' };
  if (sel.kind === 'star') return { kind: 'star', index: sel.index };
  if (sel.kind === 'exohost') return { kind: 'exohost', name: sel.name };
  if (sel.kind === 'outer') return { kind: 'outer', key: sel.key };
  // Landmarks (Sgr A*, galaxies, the model shells) sit where the zoom is headed anyway; they are flown to from their cards.
  return null;
}

const same = (a: Anchor, b: Anchor) => JSON.stringify(a) === JSON.stringify(b);

/** Where zooming in heads when nothing is under the cursor: one step back down the chain toward Earth. */
function homeward(anchor: Anchor, d: number): Anchor | null {
  if (anchor.kind === 'galaxy' && d < BACK_TO_SUN_KM) return { kind: 'system' };
  if (anchor.kind === 'system' && d < BACK_TO_EARTH_KM) return { kind: 'body', key: 'earth' };
  return null;
}

export function createZoomAnchoring(scene: SpaceScene, root: HTMLElement, onSurface: (to: MapTarget) => void) {
  const dom = scene.renderer.domElement;
  let armed = false;
  let anchorSeen = '';
  /** Where the view settled for this anchor: hand-offs wait until the operator has zoomed well past it. */
  let settled: number | null = null;
  let link: MapLink = DEFAULT_MAP_LINK;

  // Every wheel event in the view, labels included, lands here first; OrbitControls never sees it.
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // On the way back to the map the camera is the hand-over's.
    if (scene.leaving()) return;
    if (e.deltaY < 0 && !scene.rig.flying() && !scene.rig.swinging()) zoomingIn(e);
    scene.rig.wheel(e);
  };
  root.addEventListener('wheel', onWheel, { passive: false, capture: true });

  function zoomingIn(e: WheelEvent) {
    const rect = dom.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    // The middle of the view is where the zoom is going; pointing off it at something is asking to go there instead.
    const aimed = Math.hypot(x - rect.width / 2, y - rect.height / 2) > CENTRE_ZONE * Math.min(rect.width, rect.height);
    const sel = aimed ? pickAt(scene, x, y, rect.width, rect.height) : null;
    // A picture is only seen face on, from Earth's side: zooming at one flies round to it, as its card does.
    if (sel?.kind === 'feature' && (picturedUp(sel.id) || sel.id.startsWith('void:') || sel.id.startsWith('scl:')) && !same({ kind: 'feature', id: sel.id }, scene.anchor)) {
      const v = deepView(sel, a => scene.anchorState(a)?.position, a => scene.anchorState(a)?.radius);
      if (v) scene.setAnchor(v.anchor, v);
      return;
    }
    const next = sel && anchorFor(sel);
    if (next && !same(next, scene.anchor)) {
      const st = scene.anchorState(next);
      if (st && scene.camera.position.distanceTo(st.position) > st.radius * 4) scene.retarget(next, RETARGET_MS);
      return;
    }
    const a = scene.anchorState(scene.anchor);
    const back = a && homeward(scene.anchor, scene.camera.position.distanceTo(a.position));
    if (back) scene.retarget(back, HANDOFF_MS);
  }

  function update() {
    const key = JSON.stringify(scene.anchor);
    if (key !== anchorSeen) { anchorSeen = key; armed = false; settled = null; }
    if (scene.rig.flying()) scene.setScreenDrop(0);
    if (scene.rig.flying() || scene.rig.swinging()) return;
    const a = scene.anchorState(scene.anchor);
    if (!a) return;
    const cam = scene.camera.position;
    const d = cam.distanceTo(a.position);
    settled ??= d;
    const anchor = scene.anchor;

    // A replay's Earth is decades from the map's; it does not hand back to it.
    if (anchor.kind === 'body' && anchor.key === 'earth' && !scene.replay) {
      const jd = jdFromMs(Date.now());
      const fromEarth = cam.clone().sub(a.position);
      const view = { fov: scene.camera.fov, height: dom.clientHeight || link.height };
      const returnKm = mapReturnKm(link, view);
      // Near the map's own zoom, Earth sits as low as the tilted map draws its globe; it centres as the camera pulls away.
      const drop = mapReturnDropPx(link) * (view.height / link.height);
      scene.setScreenDrop(drop * (1 - ramp(d, returnKm * 1.1, returnKm * 2.2)));
      if (d > returnKm * 1.04) armed = true;
      else if (armed && d < returnKm) {
        armed = false;
        onSurface(mapReturn(jd, fromEarth, link, view));
        return;
      }
    }
    else scene.setScreenDrop(0);
    // A following replay camera sets its own distance; the hand-offs would take it off the craft.
    if (scene.replay?.state.follow) return;
    const far = anchor.kind === 'body' || anchor.kind === 'craft' ? TO_SUN_KM : anchor.kind === 'outer' ? 20 * TO_SUN_KM : anchor.kind === 'star' || anchor.kind === 'exohost' ? 2 * LY_KM : Infinity;
    if (d > Math.max(far, settled * 3)) scene.retarget({ kind: 'system' }, HANDOFF_MS);
    else if (anchor.kind === 'system' && d > Math.max(TO_GALAXY_KM, settled * 3)) scene.retarget({ kind: 'galaxy' }, HANDOFF_MS);
  }

  /** How the map draws its globe, from the view space was entered from. */
  const setMapLink = (l: MapLink) => { link = l; };

  return { update, setMapLink, dispose: () => root.removeEventListener('wheel', onWheel, { capture: true }) };
}
