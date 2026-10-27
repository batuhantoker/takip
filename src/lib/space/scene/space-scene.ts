import * as THREE from 'three';
import { earthOrientation, mul } from '@/lib/space/frames';
import type { StarCatalog } from '@/lib/space/globe/sky-layer';
import type { ExoplanetPayload } from '@/lib/space/deep/exoplanets';
import type { FleetCraft, FleetPayload } from '@/lib/space/craft/fleet';
import { parseBasins, parseCosmicWeb } from '@/lib/space/deep/cosmic-web';
import { jdFromMs, type Vec3 } from '@/lib/space/horizons';
import { SpaceModel } from '@/lib/space/scene/model';
import type { NearbyStarCatalog } from '@/lib/space/deep/nearby-stars';
import { parseGalacticStars } from '@/lib/space/deep/galactic-stars';
import type { OuterPayload } from '@/lib/space/deep/outer';
import type { ReplayModel } from '@/lib/space/replay/model';
import { viewScale } from '@/lib/space/replay/pacing';
import type { SpaceSelection } from '@/lib/space/selection';
import { SKY_BODIES, type SkyKey, type SkyPayload } from '@/lib/space/sky';
import type { SurfacePayload } from '@/lib/space/bodies/surface';
import type { GlobeWorldId } from '@/lib/space/worlds';
import type { GlobeView } from '@/lib/space/globe-match';
import { createPlanet, createSun, SUN_RADIUS_KM, type Planet } from './bodies/planets';
import { createCosmicWeb, type Supercluster } from './deep/cosmic-web';
import { createCosmos } from './deep/cosmos';
import { createCraftLayer } from './craft/layer';
import { createCraftModel } from './craft/model';
import { createEarth, EARTH_RADIUS_KM, type SatellitePoint } from './earth';
import { createFlightReplay, type FlightReplay } from './craft/flight-replay';
import { createOrigin } from './floating-origin';
import { createHeliosphere } from './deep/heliosphere';
import { createLabels, type LabelItem, type Occluder } from './hud/labels';
import { anchorName, anchorState, type AnchorState } from './camera/anchors';
import { createGroundCamera, overGround } from './craft/landed';
import { craftPosition, placeCraft } from './craft/placement';
import { createDeepSky } from './deep/deep-sky';
import { createLocalGroup } from './deep/local-group';
import { createMilkyWay } from './deep/milky-way';
import { createNearbyStars } from './deep/nearby-stars';
import { createGalacticStars } from './deep/galactic-stars';
import { createOort } from './deep/oort';
import { createOrbits } from './bodies/orbits';
import { createOuterBodies } from './deep/outer-bodies';
import { createRig } from './camera/rig';
import { v3 } from './shared';
import { labelItems, pickAt } from './hud/targets';
import { createStars } from './stars';
import { createSurfaceMarks } from './bodies/surface-marks';
import { ramp, tierFades, type TierFades } from './tiers';
import { globePose, picturedUp, type MapLink } from './camera/focus';
import { createZoomAnchoring } from './camera/zoom-anchor';
import { fitToDistance, placeBodies } from './frame-passes';
import { type Anchor, DEFAULT_SPACE_LAYERS, type SpaceLayers, type SpaceSceneEvents } from './types';

/**
 * TAKIP — the space view: the Sun, planets, Moon and every craft Horizons
 * tracks, at true scale and true positions, in one heliocentric scene that the
 * camera can leave Earth for and fly anywhere in — out past the heliopause,
 * through the nearest stars to the Milky Way and its neighbours.
 */

const TEXTURED: Partial<Record<SkyKey, string>> = { moon: '/api/space/texture/moon', mars: '/api/space/texture/mars' };
const ECLIPTIC_NORTH = new THREE.Vector3(0, 0, 1);

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
  readonly galactic = createGalacticStars();
  readonly milkyWay = createMilkyWay();
  readonly localGroup = createLocalGroup();
  readonly deepSky = createDeepSky();
  readonly cosmos = createCosmos();
  readonly web = createCosmicWeb();
  /** The 3D model of whichever craft is in focus. */
  readonly craftModel = createCraftModel();
  private readonly zoom;
  /** Where vertex buffers holding scene coordinates are drawn from; it follows the camera. */
  private readonly origin = createOrigin();
  private readonly groundCamera = createGroundCamera(this);
  backdrop: ReturnType<typeof createStars> | null = null;
  /** A spacecraft's flight being played back: the scene runs on its clock, not today's. */
  replay: FlightReplay | null = null;
  fleet: FleetCraft[] = [];
  anchor: Anchor = { kind: 'body', key: 'earth' };
  selection: SpaceSelection | null = null;
  layers: SpaceLayers = DEFAULT_SPACE_LAYERS;
  /** Camera distance from the Sun, km, and what that makes visible. */
  sunKm = 0;
  fades: TierFades = tierFades(0, false);

  private raf = 0;
  private lastCameraEvent = 0;
  private lastReplayEvent = 0;
  private resize: ResizeObserver;
  private downAt: [number, number] | null = null;
  private scratch = new THREE.Vector3();
  private drop = 0;
  /** The view scale a following replay camera last matched; the wheel's own zoom rides on top of it. */
  private followScale = 0;
  private dropped = false;
  /** On the way back to the map: flying home to its globe, then held on its camera while the view fades. */
  private homing: { view: () => GlobeView; from: number; drop: number; done: () => void } | null = null;
  private held: (() => GlobeView) | null = null;

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
    this.scene.add(this.cosmos.group, this.web.group, this.milkyWay.sky, this.milkyWay.galaxy, this.localGroup.group, this.deepSky.group, this.galactic.group, this.nearby.group, this.oort.group, this.heliosphere.group, this.heliosphere.marks, this.outer.group);
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
    if (process.env.NODE_ENV === 'development') (window as unknown as { __spaceDebug?: SpaceScene }).__spaceDebug = this;
  }

  setSky(p: SkyPayload) {
    this.model.setSky(p);
    this.orbits.setBodies(p.bodies);
  }

  setFleet(p: FleetPayload) {
    this.fleet = p.craft;
    this.model.fleetEpochJd = jdFromMs(Date.parse(p.epoch));
    this.craft.setFleet(p.craft);
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
  setGalacticStars(buf: ArrayBuffer) { this.galactic.setStars(parseGalacticStars(buf)); }
  setExoplanets(p: ExoplanetPayload) { this.nearby.setHosts(p.hosts); }
  setCosmicWeb(buf: ArrayBuffer) { this.web.setWeb(parseCosmicWeb(buf)); }
  setSuperclusters(rows: Supercluster[]) { this.web.setSuperclusters(rows); }
  setBasins(buf: ArrayBuffer) {
    const { meshes, flows } = parseBasins(buf);
    this.web.setBasins(meshes, flows);
  }
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
    this.deepSky.group.visible = l.deepSky;
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
    this.followReplay(true);
    this.events.onReplay?.(this.replay.state);
  }

  stopReplay() {
    if (!this.replay) return;
    this.scene.remove(this.replay.group);
    this.replay.dispose();
    this.replay = null;
    this.applyReplayLayers();
    // Back to now the craft is somewhere else entirely; fly there rather than jump.
    if (this.anchor.kind === 'craft') this.setAnchor(this.anchor, { distance: this.camera.position.distanceTo(this.rig.controls.target) });
    this.events.onReplay?.(null);
  }

  /**
   * Follows the replayed craft, standing back as far as the moment calls for
   * (see replay-pacing's viewScale), or lets go to take in its whole path.
   */
  followReplay(on: boolean) {
    const r = this.replay;
    if (!r) return;
    r.setFollow(on);
    this.followScale = 0;
    if (on) {
      const scale = viewScale(r.model, r.state.jd);
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
  anchorState(anchor: Anchor, jd = jdFromMs(this.timeMs())): AnchorState | null {
    return anchorState(this, anchor, jd);
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
    // A craft on or by the ground is seen from above it, or the body could stand between.
    const over = overGround(this, anchor, jdFromMs(this.timeMs())) && (() => overGround(this, anchor, jdFromMs(this.timeMs())));
    this.rig.setAnchor(() => this.anchorState(anchor), opts.distance, over || opts.direction, opts.instant, opts.ms);
  }

  /** Carries the camera `factor` times further out over `ms`, as momentum the wheel can add to. */
  nudge(factor: number, ms: number) { this.rig.nudge(factor, ms); }

  /** Swings the pivot to `anchor` without moving the camera, so the wheel keeps working through it. */
  retarget(anchor: Anchor, ms: number) {
    this.releaseFollow(anchor);
    this.anchor = anchor;
    this.rig.retarget(() => this.anchorState(anchor), ms);
  }

  /**
   * Flies back to Earth onto the map's own view of its globe, then holds there
   * (see holdOnMap) and calls `done`. Returns the flight's length, ms.
   */
  flyHome(view: () => GlobeView, done: () => void): number {
    this.stopReplay();
    this.anchor = { kind: 'body', key: 'earth' };
    const pose = globePose(jdFromMs(Date.now()), view(), this.viewSize());
    const ms = this.rig.flyArc(() => this.anchorState(this.anchor), pose.distance, pose.direction);
    this.homing = { view, from: this.drop, drop: pose.drop, done };
    this.rig.controls.enabled = false;
    return ms;
  }

  /** Puts the camera on the map's camera every frame, so the two Earths stay one while the view fades over the map. */
  holdOnMap(view: () => GlobeView) {
    this.rig.halt();
    this.homing = null;
    this.held = view;
    this.rig.controls.enabled = false;
  }

  /** Back to the operator's own camera: the way out was called off. */
  release() {
    this.homing = null;
    this.held = null;
    this.rig.controls.enabled = true;
  }

  leaving(): boolean { return this.homing !== null || this.held !== null; }

  private viewSize() { return { fov: this.camera.fov, height: this.container.clientHeight || 800 }; }

  private placeOnMap(jd: number) {
    const earth = this.planets.get('earth')!.group.position;
    const pose = globePose(jd, this.held!(), this.viewSize());
    this.rig.controls.target.copy(earth);
    this.camera.position.copy(earth).addScaledVector(pose.direction, pose.distance);
    this.rig.setUp(pose.up);
    this.camera.lookAt(earth);
    this.drop = pose.drop;
  }

  /** Close to a pictured object, up turns to the picture's own up, so it reads as published. */
  private pictureUp(north: THREE.Vector3) {
    const up = this.anchor.kind === 'feature' ? picturedUp(this.anchor.id) : null;
    const a = up && this.anchorState(this.anchor);
    if (!up || !a) return;
    const k = ramp(this.camera.position.distanceTo(a.position), a.radius * 80, a.radius * 8);
    const blended = north.clone().lerp(up, k);
    if (blended.lengthSq() > 1e-4) north.copy(blended.normalize());
  }

  setSelection(sel: SpaceSelection | null) { this.selection = sel; }

  /** A click on a label or a mark: the owner decides what selecting means. */
  select(sel: SpaceSelection | null) { this.events.onSelect(sel); }

  dispose() {
    cancelAnimationFrame(this.raf);
    const w = window as unknown as { __spaceDebug?: SpaceScene };
    if (w.__spaceDebug === this) delete w.__spaceDebug;
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
    if (this.leaving() || !this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 4) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.events.onSelect(pickAt(this, e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height));
  };

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    this.replay?.tick(performance.now());
    const ms = this.timeMs();
    const jd = jdFromMs(ms);
    const earthPos = placeBodies(this, jd, ms);
    const wall = performance.now();
    if (this.replay && wall - this.lastReplayEvent > 100) {
      this.lastReplayEvent = wall;
      this.events.onReplay?.({ ...this.replay.state });
    }

    if (this.replay?.state.follow && this.followScale && !this.rig.flying()) {
      const scale = viewScale(this.replay.model, jd);
      this.rig.scaleDistance(scale / this.followScale);
      this.followScale = scale;
    }
    // Everything has moved to this moment; only now does the camera follow, so nothing below sees last frame's camera.
    if (this.held) this.placeOnMap(jd);
    else {
      this.rig.update();
      // Near Earth, Earth's north is up, as on the map; out among the planets, the ecliptic's.
      const toEarth = earthPos ? this.camera.position.distanceTo(v3(earthPos, this.scratch)) : Infinity;
      const north = this.scratch.set(...mul(earthOrientation(jd), [0, 0, 1])).lerp(ECLIPTIC_NORTH, ramp(toEarth, 2e6, 6e7)).normalize();
      this.pictureUp(north);
      if (this.rig.setUp(north)) this.camera.lookAt(this.rig.controls.target);
      this.groundCamera.update(jd, wall);
    }
    if (this.homing) {
      // Earth eases down to where the tilted map draws its globe as the camera arrives.
      this.drop = this.homing.from + (this.homing.drop - this.homing.from) * this.rig.progress();
      if (!this.rig.flying()) {
        const { view, done } = this.homing;
        this.holdOnMap(view);
        done();
      }
    }
    this.applyDrop();
    if (!this.leaving()) this.zoom.update();
    placeCraft(this, jd, ms, earthPos, this.container.clientHeight);
    const cam = this.camera.position;
    const sunDist = cam.length();
    this.sunKm = sunDist;
    const f = this.fades = tierFades(sunDist, this.nearby.catalog() !== null);
    fitToDistance(this, jd, sunDist, f, this.container.clientHeight);
    const origin = this.origin.update(cam, cam.distanceTo(this.rig.controls.target));
    this.craft.rebase(origin);
    this.orbits.rebase(origin);
    this.outer.rebase(origin);
    this.nearby.rebase(origin);
    this.galactic.rebase(origin);
    this.replay?.rebase(origin);
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

  craftPosition(c: FleetCraft, jd: number, ms: number): [number, number, number] | null {
    return craftPosition(this, c, jd, ms);
  }

  anchorName(): string {
    return anchorName(this);
  }

  /** Earth's radius, for the camera placement that opens the view over a map location. */
  static readonly EARTH_RADIUS_KM = EARTH_RADIUS_KM;
}
