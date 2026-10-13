import * as THREE from 'three';
import { AU_KM, LY_KM } from '@/lib/space/astro';
import { DEEP_FEATURES } from '@/lib/space/deep-features';
import { earthOrientation, mul } from '@/lib/space/frames';
import type { StarCatalog } from '@/lib/space/earth-sky-layer';
import type { ExoplanetPayload } from '@/lib/space/exoplanets';
import type { FleetCraft, FleetPayload } from '@/lib/space/fleet';
import { GALACTIC_CENTRE_KM } from '@/lib/space/galaxy';
import { jdFromMs, type Vec3 } from '@/lib/space/horizons';
import { SpaceModel } from '@/lib/space/model';
import type { NearbyStarCatalog } from '@/lib/space/nearby-stars';
import type { OuterPayload } from '@/lib/space/outer';
import type { ReplayModel } from '@/lib/space/replay-model';
import type { SpaceSelection } from '@/lib/space/selection';
import { SKY_BODIES, type SkyKey, type SkyPayload } from '@/lib/space/sky';
import type { SurfacePayload } from '@/lib/space/surface';
import type { GlobeWorldId } from '@/lib/space/worlds';
import { createPlanet, createSun, SUN_RADIUS_KM, type Planet } from './bodies';
import { createCosmos } from './cosmos';
import { CRAFT_MODELS } from '@/lib/space/craft-models';
import { createCraftLayer } from './craft';
import { createCraftModel } from './craft-model';
import { createEarth, EARTH_RADIUS_KM, type SatellitePoint } from './earth';
import { createFlightReplay, type FlightReplay, type ReplayState } from './flight-replay';
import { createHeliosphere } from './heliosphere';
import { createLabels, type LabelItem, type Occluder } from './labels';
import { createLocalGroup } from './local-group';
import { createMilkyWay } from './milky-way';
import { createNearbyStars } from './nearby-stars';
import { createOort } from './oort';
import { createOrbits } from './orbits';
import { createOuterBodies } from './outer-bodies';
import { createRig } from './rig';
import { rotation, v3 } from './shared';
import { labelItems, pickAt } from './scene-hud';
import { createStars } from './stars';
import { createSurfaceMarks } from './surface-marks';
import { ramp, tierFades, type TierFades } from './tiers';
import type { MapLink } from './focus-camera';
import { createZoomAnchoring, type MapTarget } from './zoom-anchor';

/**
 * TAKIP — the space view: the Sun, planets, Moon and every craft Horizons
 * tracks, at true scale and true positions, in one heliocentric scene that the
 * camera can leave Earth for and fly anywhere in — out past the heliopause,
 * through the nearest stars to the Milky Way and its neighbours.
 */

export type Anchor =
  | { kind: 'body'; key: SkyKey }
  | { kind: 'craft'; id: number }
  | { kind: 'system' }
  | { kind: 'galaxy' }
  | { kind: 'star'; index: number }
  | { kind: 'exohost'; name: string }
  | { kind: 'outer'; key: string }
  | { kind: 'feature'; id: string };

export interface SpaceLayers {
  satellites: boolean; fleet: boolean; orbits: boolean; surface: boolean; labels: boolean;
  /** Model shapes: the heliosphere, the Oort cloud, the Milky Way's disc. */
  illustrations: boolean;
  constellations: boolean;
  exoplanets: boolean;
}

export interface CameraInfo { anchorName: string; distanceKm: number; sunKm: number }

export interface SpaceSceneEvents {
  onSelect: (sel: SpaceSelection | null) => void;
  onCamera: (info: CameraInfo) => void;
  /** Zoomed into Earth far enough to hand back to the map. */
  onSurface?: (to: MapTarget) => void;
  /** A flight replay's clock, a few times a second while one runs. */
  onReplay?: (state: ReplayState | null) => void;
}

const TEXTURED: Partial<Record<SkyKey, string>> = { moon: '/api/space/texture/moon', mars: '/api/space/texture/mars' };
const ECLIPTIC_NORTH = new THREE.Vector3(0, 0, 1);
/** Larger NASA models (Europa Clipper's is 36 MB) wait for a lighter version or an explicit choice. */
const MAX_MODEL_BYTES = 15e6;
/** A star or host is a point; this is how close the camera may come. */
const STAR_RADIUS_KM = 5e8;

export class SpaceScene {
  readonly model = new SpaceModel();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 1, 1e25);
  readonly rig;
  readonly sun = createSun();
  readonly earth = createEarth();
  readonly planets = new Map<SkyKey, Planet>();
  readonly orbits = createOrbits();
  readonly craft = createCraftLayer();
  readonly surfaces: Record<GlobeWorldId, ReturnType<typeof createSurfaceMarks>>;
  readonly labels;
  readonly heliosphere = createHeliosphere();
  readonly outer = createOuterBodies();
  readonly oort = createOort();
  readonly nearby = createNearbyStars();
  readonly milkyWay = createMilkyWay();
  readonly localGroup = createLocalGroup();
  readonly cosmos = createCosmos();
  /** The 3D model of whichever craft is in focus. */
  readonly craftModel = createCraftModel();
  private readonly zoom;
  backdrop: ReturnType<typeof createStars> | null = null;
  /** A spacecraft's flight being played back: the scene runs on its clock, not today's. */
  replay: FlightReplay | null = null;
  fleet: FleetCraft[] = [];
  anchor: Anchor = { kind: 'body', key: 'earth' };
  selection: SpaceSelection | null = null;
  layers: SpaceLayers = { satellites: true, fleet: true, orbits: true, surface: true, labels: true, illustrations: true, constellations: true, exoplanets: true };
  /** Camera distance from the Sun, km, and what that makes visible. */
  sunKm = 0;
  fades: TierFades = tierFades(0, false);

  private raf = 0;
  private lastCraftUpdate = 0;
  private lastCameraEvent = 0;
  private lastReplayEvent = 0;
  private resize: ResizeObserver;
  private downAt: [number, number] | null = null;
  private scratch = new THREE.Vector3();
  private drop = 0;
  /** The view scale a following replay camera last matched; the wheel's own zoom rides on top of it. */
  private followScale = 0;
  private dropped = false;

  constructor(private container: HTMLElement, private events: SpaceSceneEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x020206, 1);
    this.renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.rig = createRig(this.camera, this.renderer.domElement);
    this.labels = createLabels(container);
    this.zoom = createZoomAnchoring(this, container, to => this.events.onSurface?.(to));

    // A point light with no falloff: every body is lit from the Sun's real direction.
    this.scene.add(new THREE.PointLight(0xffffff, 3.2, 0, 0), new THREE.AmbientLight(0xffffff, 0.035));
    this.scene.add(this.cosmos.group, this.milkyWay.sky, this.milkyWay.galaxy, this.localGroup.group, this.nearby.group, this.oort.group, this.heliosphere.group, this.heliosphere.marks, this.outer.group);
    this.scene.add(this.sun.group, this.orbits.planets, this.orbits.moonFrame, this.craft.trails, this.craft.points, this.craftModel.holder);

    for (const def of SKY_BODIES) {
      if (def.key === 'sun') continue;
      const p = createPlanet(def, TEXTURED[def.key]);
      if (def.key === 'earth') {
        p.spin.remove(p.mesh);
        p.spin.add(this.earth.spin);
      }
      p.spin.matrixAutoUpdate = false;
      this.planets.set(def.key, p);
      this.scene.add(p.group);
    }
    this.surfaces = {
      moon: createSurfaceMarks('moon', SKY_BODIES.find(b => b.key === 'moon')!.radiusKm),
      mars: createSurfaceMarks('mars', SKY_BODIES.find(b => b.key === 'mars')!.radiusKm),
    };
    this.planets.get('moon')!.spin.add(this.surfaces.moon.group);
    this.planets.get('mars')!.spin.add(this.surfaces.mars.group);

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(container);
    this.fit();
    this.renderer.domElement.addEventListener('pointerdown', this.onDown);
    this.renderer.domElement.addEventListener('pointerup', this.onUp);
    this.raf = requestAnimationFrame(this.frame);
  }

  setSky(p: SkyPayload) {
    this.model.setSky(p);
    this.orbits.setBodies(p.bodies);
  }

  setFleet(p: FleetPayload) {
    this.fleet = p.craft;
    this.model.fleetEpochJd = jdFromMs(Date.parse(p.epoch));
    this.craft.setFleet(p.craft);
    this.lastCraftUpdate = 0;
    const v1 = p.craft.find(c => c.id === -31), v2 = p.craft.find(c => c.id === -32);
    if (v1 && v2) this.heliosphere.setVoyagers({ [-31]: v1.helio, [-32]: v2.helio });
  }

  setSurface(p: SurfacePayload) {
    this.model.setSurface(p);
    this.surfaces[p.body].setSurface(p);
  }

  setSatellites(rows: SatellitePoint[]) { this.earth.setSatellites(rows); }
  setStars(c: StarCatalog) {
    this.backdrop = createStars(c);
    this.scene.add(this.backdrop.points);
  }
  setNearbyStars(c: NearbyStarCatalog) { this.nearby.setCatalog(c); }
  setExoplanets(p: ExoplanetPayload) { this.nearby.setHosts(p.hosts); }
  setOuter(p: OuterPayload) { this.outer.setOuter(p, jdFromMs(Date.parse(p.epoch))); }
  setSunFrame(url: string | null) { this.sun.setFrame(url); }
  setMapLink(l: MapLink) { this.zoom.setMapLink(l); }

  /** Draws the anchor `px` below centre, where the tilted map draws its globe. */
  setScreenDrop(px: number) { this.drop = px; }

  setLayers(l: SpaceLayers) {
    this.layers = l;
    this.craft.trails.visible = l.fleet && l.orbits;
    this.orbits.planets.visible = l.orbits;
    this.orbits.moonFrame.visible = l.orbits;
    this.outer.group.visible = l.fleet || l.orbits;
    this.applyReplayLayers();
  }

  /** The scene's moment: today, or wherever a replay's clock stands. */
  timeMs(): number {
    return this.replay ? this.replay.ms() : Date.now();
  }

  /** A body's position: Horizons around today, the replay model during a replay. */
  bodyPos(key: SkyKey, jd: number): Vec3 | null {
    return this.replay ? this.replay.model.bodyAt(key, jd) : this.model.bodyPos(key, jd);
  }

  /** Plays back one spacecraft's flight, the camera following it from launch. */
  startReplay(model: ReplayModel, craftId: number) {
    this.stopReplay();
    this.replay = createFlightReplay(model, craftId);
    this.scene.add(this.replay.group);
    this.applyReplayLayers();
    this.lastCraftUpdate = 0;
    this.followReplay(true);
    this.events.onReplay?.(this.replay.state);
  }

  stopReplay() {
    if (!this.replay) return;
    this.scene.remove(this.replay.group);
    this.replay.dispose();
    this.replay = null;
    this.applyReplayLayers();
    this.lastCraftUpdate = 0;
    // Back to now the craft is somewhere else entirely; fly there rather than jump.
    if (this.anchor.kind === 'craft') this.setAnchor(this.anchor, { distance: this.camera.position.distanceTo(this.rig.controls.target) });
    this.events.onReplay?.(null);
  }

  /**
   * Follows the replayed craft, standing back as far as the moment calls for
   * (see ReplayModel.viewScale), or lets go to take in its whole path.
   */
  followReplay(on: boolean) {
    const r = this.replay;
    if (!r) return;
    r.setFollow(on);
    this.followScale = 0;
    if (on) {
      const scale = r.model.viewScale(r.state.jd);
      this.setAnchor({ kind: 'craft', id: r.state.craftId }, { distance: scale, direction: new THREE.Vector3(0.2, -0.6, 0.75).normalize(), ms: 1200 });
      this.followScale = scale;
      return;
    }
    const { pos } = r.model.path();
    let far = 0;
    for (let i = 0; i < pos.length; i += 3) far = Math.max(far, Math.hypot(pos[i], pos[i + 1], pos[i + 2]));
    this.setAnchor({ kind: 'system' }, { distance: Math.max(far * 2.6, 4e8), direction: new THREE.Vector3(0.25, -0.55, 1).normalize() });
  }

  /** Live-only layers (today's satellites, landing sites, the past half-year's trails) stand aside in a replay. */
  private applyReplayLayers() {
    const l = this.layers, live = !this.replay;
    this.earth.satellites.visible = l.satellites && live;
    this.surfaces.moon.group.visible = l.surface && live;
    this.surfaces.mars.group.visible = l.surface && live;
  }

  /** Where `anchor` is now and how big it is; null until its data has arrived. */
  anchorState(anchor: Anchor, jd = jdFromMs(this.timeMs())): { position: THREE.Vector3; radius: number } | null {
    switch (anchor.kind) {
      case 'system': return { position: new THREE.Vector3(), radius: SUN_RADIUS_KM };
      case 'galaxy': return { position: v3(GALACTIC_CENTRE_KM), radius: 2_000 * LY_KM };
      case 'body': {
        const p = this.bodyPos(anchor.key, jd);
        const r = anchor.key === 'sun' ? SUN_RADIUS_KM : SKY_BODIES.find(b => b.key === anchor.key)!.radiusKm;
        return p ? { position: v3(p), radius: r } : null;
      }
      case 'craft': {
        const c = this.fleet.find(k => k.id === anchor.id);
        const p = c && this.craftPosition(c, jd, this.timeMs());
        return p ? { position: v3(p), radius: 1 } : null;
      }
      case 'star': {
        const p = this.nearby.position(anchor.index);
        return p ? { position: p.clone(), radius: STAR_RADIUS_KM } : null;
      }
      case 'exohost': {
        const i = this.nearby.hosts().findIndex(h => h.name === anchor.name);
        return i >= 0 ? { position: this.nearby.hostPosition(i).clone(), radius: STAR_RADIUS_KM } : null;
      }
      case 'outer': {
        const b = this.outer.bodies().find(x => x.key === anchor.key);
        const p = b && this.outer.positionOf(b, jd);
        return b && p ? { position: new THREE.Vector3(...p), radius: Math.max(b.radiusKm, 1) } : null;
      }
      case 'feature': {
        const f = DEEP_FEATURES[anchor.id];
        if (f?.position) return { position: v3(f.position), radius: f.radiusKm ?? LY_KM };
        const s = anchor.id.startsWith('cosmos:') ? this.cosmos.labels().find(l => l.id === anchor.id) : null;
        return s ? { position: s.position, radius: 5e6 * LY_KM } : null;
      }
    }
  }

  /** A following replay camera lets go once the view is anchored on anything but its craft. */
  private releaseFollow(anchor: Anchor) {
    const r = this.replay;
    if (r?.state.follow && !(anchor.kind === 'craft' && anchor.id === r.state.craftId)) {
      r.setFollow(false);
      this.followScale = 0;
    }
  }

  /** Flies to `anchor`; `instant` places the camera at once, for the jump out of the map. */
  setAnchor(anchor: Anchor, opts: { distance: number; direction?: THREE.Vector3; instant?: boolean; ms?: number }) {
    this.releaseFollow(anchor);
    this.anchor = anchor;
    this.rig.setAnchor(() => this.anchorState(anchor), opts.distance, opts.direction, opts.instant, opts.ms);
  }

  /** Carries the camera `factor` times further out over `ms`, as momentum the wheel can add to. */
  nudge(factor: number, ms: number) { this.rig.nudge(factor, ms); }

  /** Swings the pivot to `anchor` without moving the camera, so the wheel keeps working through it. */
  retarget(anchor: Anchor, ms: number) {
    this.releaseFollow(anchor);
    this.anchor = anchor;
    this.rig.retarget(() => this.anchorState(anchor), ms);
  }

  setSelection(sel: SpaceSelection | null) { this.selection = sel; }

  /** A click on a label or a mark: the owner decides what selecting means. */
  select(sel: SpaceSelection | null) { this.events.onSelect(sel); }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.replay?.dispose();
    this.resize.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onUp);
    this.zoom.dispose();
    this.rig.dispose();
    this.labels.dispose();
    this.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach(m => { (m as THREE.MeshBasicMaterial).map?.dispose(); m.dispose(); });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private fit() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private applyDrop() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (this.drop > 0.5 && w && h) {
      this.camera.setViewOffset(w, h, 0, -this.drop, w, h);
      this.dropped = true;
    } else if (this.dropped) {
      this.camera.clearViewOffset();
      this.dropped = false;
    }
  }

  private onDown = (e: PointerEvent) => { this.downAt = [e.clientX, e.clientY]; };

  private onUp = (e: PointerEvent) => {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 4) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.events.onSelect(pickAt(this, e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height));
  };

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    this.replay?.tick(performance.now());
    const ms = this.timeMs();
    const jd = jdFromMs(ms);
    const earthPos = this.bodyPos('earth', jd);

    for (const [key, p] of this.planets) {
      const pos = this.bodyPos(key, jd);
      p.group.visible = !!pos;
      if (!pos) continue;
      p.group.position.set(pos[0], pos[1], pos[2]);
      // Live, the Moon and Mars turn by today's lighting tables; a replay uses the IAU rotation model, as its landers do.
      const o = this.replay ? this.replay.model.orientation(key, jd) : this.model.orientation(key, jd, ms);
      if (o) rotation(o, p.spin.matrix);
      p.spin.matrixWorldNeedsUpdate = true;
    }
    if (earthPos) {
      this.earth.sunDir.set(-earthPos[0], -earthPos[1], -earthPos[2]).normalize();
      this.orbits.moonFrame.position.set(earthPos[0], earthPos[1], earthPos[2]);
    }
    if (!this.replay) {
      this.surfaces.moon.update(ms);
      this.surfaces.mars.update(ms);
    }
    // A replay moves its craft every frame; the live fleet a few times a second is plenty.
    const wall = performance.now();
    const focus = this.focusCraft();
    if (this.replay || wall - this.lastCraftUpdate > 250) {
      // Once its model is in, the craft in focus is drawn by the model rather than a dot.
      const modelled = focus && this.craftModel.ready() ? focus.id : null;
      this.craft.update(c => (c.id === modelled ? null : this.craftPosition(c, jd, ms)));
      this.lastCraftUpdate = wall;
    }
    this.craftModel.show(focus ? String(focus.id) : null, focus ? CRAFT_MODELS[focus.id] ?? null : null);
    const focusAt = focus ? this.craftPosition(focus, jd, ms) : null;
    const earthAt = this.bodyPos('earth', jd);
    this.craftModel.update(focusAt ? new THREE.Vector3(...focusAt) : null, earthAt ? v3(earthAt) : null, this.camera, this.container.clientHeight);
    if (this.replay && wall - this.lastReplayEvent > 100) {
      this.lastReplayEvent = wall;
      this.events.onReplay?.({ ...this.replay.state });
    }

    // Near Earth, Earth's north is up, as on the map; out among the planets, the ecliptic's.
    const toEarth = earthPos ? this.camera.position.distanceTo(v3(earthPos, this.scratch)) : Infinity;
    const north = this.scratch.set(...mul(earthOrientation(jd), [0, 0, 1])).lerp(ECLIPTIC_NORTH, ramp(toEarth, 2e6, 6e7)).normalize();
    this.rig.setUp(north);
    if (this.replay?.state.follow && this.followScale && !this.rig.flying()) {
      const scale = this.replay.model.viewScale(jd);
      this.rig.scaleDistance(scale / this.followScale);
      this.followScale = scale;
    }
    this.rig.update();
    this.applyDrop();
    this.zoom.update();
    const cam = this.camera.position;
    const sunDist = cam.length();
    this.sunKm = sunDist;
    const f = this.fades = tierFades(sunDist, this.nearby.catalog() !== null);
    // Orbits and trails fade in from ~100,000 km out to ~10 million: across the solar system they guide, beside a moon they clutter.
    const fade = Math.max(0.06, Math.min(1, (Math.log10(Math.max(1, cam.distanceTo(this.rig.controls.target))) - 5) / 2));
    this.orbits.fade(fade * f.planets);
    this.craft.fade(this.replay ? 0 : fade * f.craft);
    this.craft.points.visible = (this.layers.fleet || !!this.replay) && f.craft > 0.01;

    this.sun.showFrame(!this.replay);
    this.sun.sdo.quaternion.copy(this.camera.quaternion);
    this.sun.fit(sunDist);
    // From the outer planets the Sun must still read as the brightest thing in the sky;
    // up close the SDO frame carries the corona, and a full glow would wash it out.
    // Past the heliopause it shrinks to a star, and the 3D star field's Sun takes over.
    const glowAngle = sunDist < 1e10 ? 0.06 : Math.max(0.004, 0.06 * Math.pow(1e10 / sunDist, 0.4));
    this.sun.glow.scale.setScalar(Math.max(SUN_RADIUS_KM * 3, sunDist * glowAngle));
    (this.sun.glow.material as THREE.SpriteMaterial).opacity = Math.min(1, Math.max(0.3, sunDist / 3e7)) * (f.stars > 0 ? 1 - ramp(sunDist, 0.05 * LY_KM, 0.5 * LY_KM) : 1);
    const pxPerRad = this.container.clientHeight / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    for (const p of this.planets.values()) {
      const d = p.group.position.distanceTo(cam);
      // A planet's dot hides once it would sit on the Sun's, a few pixels from it.
      p.marker.visible = (p.def.radiusKm / d) * pxPerRad < 3 && (p.group.position.length() / sunDist) * pxPerRad > 4;
      if (p.def.key === 'earth') this.earth.scaleForDistance(d);
    }

    this.backdrop?.update(this.camera, f.backdrop);
    this.outer.update(jd, f.outer, f.belt, !!this.replay);
    this.heliosphere.update(f.heliosphere, this.layers.illustrations);
    this.oort.update(sunDist, f.oort, this.layers.illustrations);
    this.nearby.update(f.stars, f.starFloor, this.layers.constellations ? f.figures : 0, this.layers.exoplanets, 0.35 + 0.65 * ramp(sunDist, 2_000 * LY_KM, 300 * LY_KM));
    this.milkyWay.update(this.camera, f.milkyWaySky, f.disc, this.layers.illustrations);
    this.localGroup.update(f.localGroup);
    this.cosmos.update(f.localGalaxies, f.deepGalaxies, f.cmb, sunDist);
    this.renderer.render(this.scene, this.camera);

    const occluders: Occluder[] = [{ center: new THREE.Vector3(), radius: SUN_RADIUS_KM }];
    for (const p of this.planets.values()) if (p.group.visible) occluders.push({ center: p.group.position, radius: p.def.radiusKm });
    const items: LabelItem[] = this.layers.labels ? labelItems(this, jd, ms) : [];
    this.labels.update(items, this.camera, this.container.clientWidth, this.container.clientHeight, occluders);

    if (wall - this.lastCameraEvent > 250) {
      this.lastCameraEvent = wall;
      const a = this.anchorState(this.anchor, jd);
      this.events.onCamera({ anchorName: this.anchorName(), distanceKm: a ? cam.distanceTo(a.position) : NaN, sunKm: sunDist });
    }
  };

  /** The craft whose model to show: the one replayed, else followed, else selected; only those with a model of a sensible size. */
  private focusCraft(): FleetCraft | null {
    const id = this.replay?.state.craftId
      ?? (this.anchor.kind === 'craft' ? this.anchor.id : null)
      ?? (this.selection?.kind === 'craft' ? this.selection.id : null);
    const model = id !== null ? CRAFT_MODELS[id] : undefined;
    if (id === null || !model || model.bytes > MAX_MODEL_BYTES) return null;
    return this.fleet.find(c => c.id === id) ?? null;
  }

  /**
   * Moon and Mars craft come from their ground tracks; one without a track is a
   * lander (drawn as a surface mark) or cannot be placed, so it is not drawn.
   */
  craftPosition(c: FleetCraft, jd: number, ms: number): [number, number, number] | null {
    if (this.replay) return c.id === this.replay.state.craftId ? this.replay.model.craftAt(jd) : null;
    if (c.region !== 'moon' && c.region !== 'mars') return this.model.craftPos(c, jd);
    const marks = this.surfaces[c.region];
    const i = marks.orbiters().findIndex(o => o.id === c.id);
    const local = i >= 0 ? marks.orbiterPositions(ms)[i] : null;
    const planet = this.planets.get(c.region);
    if (!local || !planet) return null;
    const w = new THREE.Vector3(...local).applyMatrix4(planet.spin.matrix).add(planet.group.position);
    return [w.x, w.y, w.z];
  }

  anchorName(): string {
    const a = this.anchor;
    switch (a.kind) {
      case 'system': return this.sunKm < 2_000 * AU_KM ? 'Solar system' : 'Sun';
      case 'galaxy': return 'Milky Way';
      case 'body': return SKY_BODIES.find(b => b.key === a.key)!.name;
      case 'craft': return this.fleet.find(c => c.id === a.id)?.name ?? 'Spacecraft';
      case 'star': return this.nearby.catalog()?.names[a.index] ?? this.nearby.catalog()?.ids[a.index] ?? 'Star';
      case 'exohost': return a.name;
      case 'outer': return this.outer.bodies().find(b => b.key === a.key)?.name ?? 'Outer solar system';
      case 'feature': return DEEP_FEATURES[a.id]?.name ?? 'Deep space';
    }
  }

  /** Earth's radius, for the camera placement that opens the view over a map location. */
  static readonly EARTH_RADIUS_KM = EARTH_RADIUS_KM;
}
