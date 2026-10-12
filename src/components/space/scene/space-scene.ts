import * as THREE from 'three';
import type { StarCatalog } from '@/lib/space/earth-sky-layer';
import type { FleetCraft, FleetPayload } from '@/lib/space/fleet';
import { jdFromMs } from '@/lib/space/horizons';
import { SpaceModel } from '@/lib/space/model';
import type { SpaceSelection } from '@/lib/space/selection';
import { SKY_BODIES, type SkyKey, type SkyPayload } from '@/lib/space/sky';
import type { SurfacePayload } from '@/lib/space/surface';
import type { GlobeWorldId } from '@/lib/space/worlds';
import { createPlanet, createSun, SUN_RADIUS_KM, type Planet } from './bodies';
import { createCraftLayer } from './craft';
import { createEarth, EARTH_RADIUS_KM, type SatellitePoint } from './earth';
import { createLabels, type LabelItem, type Occluder } from './labels';
import { createOrbits } from './orbits';
import { createRig } from './rig';
import { rotation, v3 } from './shared';
import { pickAt, labelItems } from './scene-hud';
import { createStars } from './stars';
import { createSurfaceMarks } from './surface-marks';

/**
 * TAKIP — the space view: the Sun, planets, Moon and every craft Horizons
 * tracks, at true scale and true positions, in one heliocentric scene that the
 * camera can leave Earth for and fly anywhere in.
 */

export type Anchor = { kind: 'body'; key: SkyKey } | { kind: 'craft'; id: number } | { kind: 'system' };

export interface SpaceLayers { satellites: boolean; fleet: boolean; orbits: boolean; surface: boolean; labels: boolean }

export interface SpaceSceneEvents {
  onSelect: (sel: SpaceSelection | null) => void;
  onCamera: (info: { anchorName: string; distanceKm: number }) => void;
}

const TEXTURED: Partial<Record<SkyKey, string>> = { moon: '/api/space/texture/moon', mars: '/api/space/texture/mars' };

export class SpaceScene {
  readonly model = new SpaceModel();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 1, 1e13);
  readonly rig;
  readonly sun = createSun();
  readonly earth = createEarth();
  readonly planets = new Map<SkyKey, Planet>();
  readonly orbits = createOrbits();
  readonly craft = createCraftLayer();
  readonly surfaces: Record<GlobeWorldId, ReturnType<typeof createSurfaceMarks>>;
  readonly labels;
  fleet: FleetCraft[] = [];
  anchor: Anchor = { kind: 'body', key: 'earth' };
  selection: SpaceSelection | null = null;
  layers: SpaceLayers = { satellites: true, fleet: true, orbits: true, surface: true, labels: true };

  private raf = 0;
  private lastCraftUpdate = 0;
  private lastCameraEvent = 0;
  private resize: ResizeObserver;
  private downAt: [number, number] | null = null;

  constructor(private container: HTMLElement, private events: SpaceSceneEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x020206, 1);
    this.renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.rig = createRig(this.camera, this.renderer.domElement);
    this.labels = createLabels(container);

    // A point light with no falloff: every body is lit from the Sun's real direction.
    this.scene.add(new THREE.PointLight(0xffffff, 3.2, 0, 0), new THREE.AmbientLight(0xffffff, 0.035));
    this.scene.add(this.sun.group, this.orbits.planets, this.orbits.moonFrame, this.craft.trails, this.craft.points);

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
  }

  setSurface(p: SurfacePayload) {
    this.model.setSurface(p);
    this.surfaces[p.body].setSurface(p);
  }

  setSatellites(rows: SatellitePoint[]) { this.earth.setSatellites(rows); }
  setStars(c: StarCatalog) { this.scene.add(createStars(c)); }
  setSunFrame(url: string | null) { this.sun.setFrame(url); }

  setLayers(l: SpaceLayers) {
    this.layers = l;
    this.earth.satellites.visible = l.satellites;
    this.craft.points.visible = l.fleet;
    this.craft.trails.visible = l.fleet && l.orbits;
    this.orbits.planets.visible = l.orbits;
    this.orbits.moonFrame.visible = l.orbits;
    this.surfaces.moon.group.visible = l.surface;
    this.surfaces.mars.group.visible = l.surface;
  }

  /** Where `anchor` is now and how big it is; null until its data has arrived. */
  anchorState(anchor: Anchor, jd = jdFromMs(Date.now())): { position: THREE.Vector3; radius: number } | null {
    if (anchor.kind === 'system') return { position: new THREE.Vector3(), radius: SUN_RADIUS_KM };
    if (anchor.kind === 'body') {
      const p = this.model.bodyPos(anchor.key, jd);
      const r = anchor.key === 'sun' ? SUN_RADIUS_KM : SKY_BODIES.find(b => b.key === anchor.key)!.radiusKm;
      return p ? { position: v3(p), radius: r } : null;
    }
    const c = this.fleet.find(k => k.id === anchor.id);
    const p = c && this.model.craftPos(c, jd);
    return p ? { position: v3(p), radius: 1 } : null;
  }

  /** Flies to `anchor`; `from` puts the camera over that Earth location first, for the jump out of the map. */
  setAnchor(anchor: Anchor, opts: { distance: number; direction?: THREE.Vector3; instant?: boolean }) {
    this.anchor = anchor;
    this.rig.setAnchor(() => this.anchorState(anchor), opts.distance, opts.direction, opts.instant);
  }

  setSelection(sel: SpaceSelection | null) { this.selection = sel; }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onUp);
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

  private onDown = (e: PointerEvent) => { this.downAt = [e.clientX, e.clientY]; };

  private onUp = (e: PointerEvent) => {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 4) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.events.onSelect(pickAt(this, e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height));
  };

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    const ms = Date.now();
    const jd = jdFromMs(ms);
    const earthPos = this.model.bodyPos('earth', jd);

    for (const [key, p] of this.planets) {
      const pos = this.model.bodyPos(key, jd);
      p.group.visible = !!pos;
      if (!pos) continue;
      p.group.position.set(pos[0], pos[1], pos[2]);
      const o = this.model.orientation(key, jd, ms);
      if (o) rotation(o, p.spin.matrix);
      p.spin.matrixWorldNeedsUpdate = true;
    }
    if (earthPos) {
      this.earth.sunDir.set(-earthPos[0], -earthPos[1], -earthPos[2]).normalize();
      this.orbits.moonFrame.position.set(earthPos[0], earthPos[1], earthPos[2]);
    }
    this.surfaces.moon.update(ms);
    this.surfaces.mars.update(ms);
    if (ms - this.lastCraftUpdate > 250) {
      this.craft.update(c => this.craftPosition(c, jd, ms));
      this.lastCraftUpdate = ms;
    }

    this.rig.update();
    const cam = this.camera.position;
    const sunDist = cam.length();
    this.sun.sdo.quaternion.copy(this.camera.quaternion);
    // From the outer planets the Sun must still read as the brightest thing in the sky.
    this.sun.glow.scale.setScalar(Math.max(SUN_RADIUS_KM * 9, sunDist * 0.06));
    const pxPerRad = this.container.clientHeight / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    for (const p of this.planets.values()) {
      const d = p.group.position.distanceTo(cam);
      p.marker.visible = (p.def.radiusKm / d) * pxPerRad < 3;
    }
    this.renderer.render(this.scene, this.camera);

    const occluders: Occluder[] = [{ center: new THREE.Vector3(), radius: SUN_RADIUS_KM }];
    for (const p of this.planets.values()) if (p.group.visible) occluders.push({ center: p.group.position, radius: p.def.radiusKm });
    const items: LabelItem[] = this.layers.labels ? labelItems(this, jd, ms) : [];
    this.labels.update(items, this.camera, this.container.clientWidth, this.container.clientHeight, occluders);

    if (ms - this.lastCameraEvent > 250) {
      this.lastCameraEvent = ms;
      const a = this.anchorState(this.anchor, jd);
      this.events.onCamera({ anchorName: this.anchorName(), distanceKm: a ? cam.distanceTo(a.position) : NaN });
    }
  };

  /** Moon and Mars orbiters come from their ground tracks; everything else from the fleet state. */
  craftPosition(c: FleetCraft, jd: number, ms: number): [number, number, number] | null {
    if (c.region === 'moon' || c.region === 'mars') {
      const marks = this.surfaces[c.region];
      const i = marks.orbiters().findIndex(o => o.id === c.id);
      const local = i >= 0 ? marks.orbiterPositions(ms)[i] : null;
      const planet = this.planets.get(c.region);
      if (local && planet) {
        const w = new THREE.Vector3(...local).applyMatrix4(planet.spin.matrix).add(planet.group.position);
        return [w.x, w.y, w.z];
      }
    }
    return this.model.craftPos(c, jd);
  }

  anchorName(): string {
    if (this.anchor.kind === 'system') return 'Solar system';
    if (this.anchor.kind === 'body') return SKY_BODIES.find(b => b.key === (this.anchor as { key: SkyKey }).key)!.name;
    const id = this.anchor.id;
    return this.fleet.find(c => c.id === id)?.name ?? 'Spacecraft';
  }

  /** Earth's radius, for the camera placement that opens the view over a map location. */
  static readonly EARTH_RADIUS_KM = EARTH_RADIUS_KM;
}
