/**
 * TAKIP OI on the globe.
 *
 * While a run thinks, its analysis draws itself on the map: the actors land
 * where they act, their relations rise as arcs through the sky, evidence from
 * the live feed strikes in, and once the simulation starts every move an actor
 * makes against another fires a new arc, in the colour of its stance, while
 * the events of the simulated worlds land where they happen. Actors deciding
 * their next move ripple; each takes the colour of the way it pushes.
 * Every arc and every point can be hovered and clicked: a click selects that
 * piece of the research, lights it and what it touches, and dims the rest.
 *
 * The arcs are a WebGL custom layer: ribbons of constant pixel width lifted
 * along great circles through MapLibre's own projectTileFor3D, so they curve
 * with the globe and flatten with the 2D map. That function does not clip
 * against the horizon the way MapLibre's surface layers do, so each point is
 * tested here against the planet itself: the camera is recovered from the
 * horizon plane MapLibre hands every custom layer, and a point is hidden when
 * the line of sight to it passes through the Earth. The same vertex shader
 * drives an offscreen picking pass, so what can be clicked is exactly what is
 * drawn. Nodes and labels are ordinary GeoJSON layers.
 */
import type {
  GeoJSONSource, Map as MlMap, MapMouseEvent, PaddingOptions,
} from 'maplibre-gl';
import { mercator, rgb, type ArcSpec, type LngLat } from './arcs';
import { createDirector } from './camera';
import { shortAnswer } from './forecast';
import { clock, createArcLayer, OI_ARCS, type Ping } from './globe-arc-layer';
import { actorTint, DEFAULT_TONES, leanColor, lift, type ToneColors } from './globe-colors';
import { EMPTY, ensureNodeLayers, LAYERS, NODES } from './globe-layers';
import { brief, relatedLinks } from './research';
import type { RunState } from './state';
import type { Link, Move } from './types';

export { OI_ARCS } from './globe-arc-layer';
export { actorTint, DEFAULT_TONES, leanColor, type ToneColors } from './globe-colors';

/** Quotes are not drawn on the globe (the graph follows them); they would share evidence's look if they were. */
const KIND: Record<Link['kind'], number> = { relation: 0, evidence: 1, move: 2, cite: 1 };
const TONE: Record<Link['tone'], number> = { support: 0, oppose: 1, neutral: 2 };

export interface OiHover {
  key: string;
  title: string;
  detail: string;
  /** Pointer position, CSS pixels from the map's top left. */
  x: number;
  y: number;
}

export interface OiGlobe {
  /** Draws a run (or clears the globe for null). Cheap to call on every event. */
  update(state: RunState | null): void;
  /** Lights a piece of the research and what it touches; null clears. */
  select(key: string | null): void;
  /** The arcs' three tones, from the Style Studio. */
  setColors(colors: ToneColors): void;
  /** Keeps the globe centred in the space panels leave free; null gives the whole map back. */
  setInsets(padding: PaddingOptions | null): void;
  /** Let the camera follow the run (the default), or leave it where the person puts it. */
  follow(on: boolean): void;
  /** The piece of the run under a point on the map, if any, so other layers can leave that click to OI. */
  hit(point: { x: number; y: number }): string | null;
  /** Re-adds what a style change removed. */
  ensure(): void;
  destroy(): void;
}

export interface OiGlobeOptions {
  onSelect?: (key: string | null) => void;
  onHover?: (hover: OiHover | null) => void;
  /** The camera stopped following the run (a person moved the map), or started again. */
  onFollowChange?: (following: boolean) => void;
}

type Feature = GeoJSON.Feature<GeoJSON.Point, Record<string, string | number | boolean>>;

export function attachOi(map: MlMap, options: OiGlobeOptions = {}): OiGlobe {
  const layer = createArcLayer();
  const director = createDirector(map, options.onFollowChange);
  let state: RunState | null = null;
  let selected: string | null = null;
  let palette: ToneColors = { ...DEFAULT_TONES };
  /** The links drawn, in the order the layer indexes them, for turning a pick back into a link. */
  let drawn: Link[] = [];
  /** When each link (by id and version) started drawing, on the layer's clock. */
  const births = new Map<string, number>();
  const nodeBirths = new Map<string, number>();
  /** When each actor started deciding, so its ripple keeps its rhythm across updates. */
  const thinkingSince = new Map<string, number>();
  let focusSince = 0;
  let hoverKey: string | null = null;

  const ensure = () => {
    if (!map.getStyle()) return;
    if (!map.getLayer(OI_ARCS)) map.addLayer(layer);
    ensureNodeLayers(map);
  };

  /* Pointer: points come from MapLibre's own hit-testing; arcs from the picking pass. */
  const nodeAt = (p: { x: number; y: number }): string | null => {
    if (!map.getLayer('oi-node-core')) return null;
    const f = map.queryRenderedFeatures([p.x, p.y], { layers: ['oi-node-core'] })[0];
    const key = f?.properties?.key;
    return typeof key === 'string' && key !== 'focus' ? key : null;
  };
  const arcAt = (p: { x: number; y: number }): string | null => {
    if (!drawn.length) return null;
    const i = layer.pick(p.x, p.y);
    return i === null ? null : `link:${drawn[i].id}`;
  };

  const onClick = (e: MapMouseEvent) => {
    if (!state) return;
    const key = nodeAt(e.point) ?? arcAt(e.point);
    if (key) options.onSelect?.(key);
    else if (selected) options.onSelect?.(null);
  };

  let lastMove = 0;
  let moveTimer: ReturnType<typeof setTimeout> | null = null;
  const onMove = (e: MapMouseEvent) => {
    if (!state || (!drawn.length && !state.actors.length)) return;
    const run = () => {
      lastMove = performance.now();
      const key = nodeAt(e.point) ?? arcAt(e.point);
      const arcIndex = key?.startsWith('link:') ? drawn.findIndex(l => `link:${l.id}` === key) : -1;
      layer.setHover(arcIndex);
      map.getCanvas().style.cursor = key ? 'pointer' : '';
      if (key === hoverKey && !key) return;
      hoverKey = key;
      const b = key && state ? brief(state, key) : null;
      options.onHover?.(b && key ? { key, ...b, x: e.point.x, y: e.point.y } : null);
    };
    // Picking reads pixels back from the GPU: at most every 70 ms, and always the latest position.
    if (moveTimer) clearTimeout(moveTimer);
    const wait = 70 - (performance.now() - lastMove);
    if (wait <= 0) run();
    else moveTimer = setTimeout(run, wait);
  };
  const onLeave = () => {
    if (moveTimer) clearTimeout(moveTimer);
    layer.setHover(-1);
    if (hoverKey) { hoverKey = null; options.onHover?.(null); }
  };

  map.on('click', onClick);
  map.on('mousemove', onMove);
  map.on('mouseout', onLeave);
  const onStyle = () => { ensure(); if (state) draw(state); };
  map.on('style.load', onStyle);

  function draw(s: RunState) {
    const now = clock();
    const pos = new Map<string, LngLat>();
    for (const a of s.actors) if (a.lat !== null && a.lng !== null) pos.set(`a:${a.id}`, [a.lng, a.lat]);
    for (const c of s.context) if (c.lat !== null && c.lng !== null) pos.set(`c:${c.id}`, [c.lng, c.lat]);

    const lit = relatedLinks(s, selected);
    const dimOthers = lit.size > 0;

    // New arcs are staggered, so a burst (a replayed run, a world model) draws in sequence rather than at once.
    const version = (l: Link) => `${l.id}|${l.round}|${l.tone}`;
    // A quote's thread runs to a headline or a passage, most of them nowhere on Earth: the graph draws those.
    const shown = s.links.filter(l => l.kind !== 'cite');
    const fresh = shown.filter(l => !births.has(version(l)));
    const gap = fresh.length > 1 ? Math.min(0.14, 3 / fresh.length) : 0;
    fresh.forEach((l, i) => births.set(version(l), now + i * gap));
    const arcs: ArcSpec[] = [];
    drawn = [];
    for (const l of shown) {
      const from = pos.get(l.from);
      const to = pos.get(l.to);
      if (!from || !to || (from[0] === to[0] && from[1] === to[1])) continue;
      arcs.push({
        from, to, tone: TONE[l.tone], id: drawn.length, highlight: lit.has(l.id) ? 1 : 0,
        strength: l.strength, birth: births.get(version(l))!, kind: KIND[l.kind],
      });
      drawn.push(l);
    }
    layer.setArcs(arcs, dimOthers);
    layer.setLive(s.status === 'running');

    // Nodes. With a selection, the ones it touches stay lit and the rest dim.
    const touching = new Set<string>();
    if (selected) {
      touching.add(selected);
      for (const l of s.links) if (lit.has(l.id)) { touching.add(l.from); touching.add(l.to); }
    }
    const dimNode = (key: string) => (selected && touching.size > 1 && !touching.has(key) ? 1 : 0);
    // Each cast actor's latest move, across the worlds.
    const latest = new Map<string, Move>();
    for (const m of s.moves) latest.set(m.actor, m);
    const features: Feature[] = [];
    const point = (lng: number, lat: number, props: Record<string, string | number | boolean>): Feature =>
      ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: props });
    for (const c of s.context) {
      if (c.lat === null || c.lng === null) continue;
      const key = `c:${c.id}`;
      features.push(point(c.lng, c.lat, { key, kind: 'context', label: '', color: '#9A93B8', radius: 2.6, halo: 6, sel: key === selected ? 1 : 0, dim: dimNode(key) }));
    }
    for (const a of s.actors) {
      if (a.lat === null || a.lng === null) continue;
      const key = `a:${a.id}`;
      const color = a.persona ? actorTint(s, latest.get(a.id)) : lift(palette.support, 0.35);
      features.push(point(a.lng, a.lat, { key, kind: 'actor', label: a.name, color, radius: key === selected ? 6.5 : a.persona ? 5.5 : 4.2, halo: a.persona ? 18 : 12, sel: key === selected ? 1 : 0, dim: dimNode(key) }));
    }
    // What happened in the simulated worlds, where it happened.
    for (const e of s.events) {
      if (e.lat === null || e.lng === null) continue;
      const key = `e:${e.id}`;
      features.push(point(e.lng, e.lat, {
        key, kind: 'event', label: `${e.world} · ${e.title.length > 36 ? `${e.title.slice(0, 35)}…` : e.title}`,
        color: leanColor(e.push === 'yes' ? 0.88 : e.push === 'no' ? 0.12 : 0.5), radius: key === selected ? 4.5 : e.kind === 'shock' ? 3.6 : 2.8, halo: 8,
        sel: key === selected ? 1 : 0, dim: dimNode(key),
      }));
    }
    if (s.report) {
      s.report.scenarios.forEach((sc, i) => {
        if (sc.lat === null || sc.lng === null) return;
        const key = `s:${i}`;
        features.push(point(sc.lng, sc.lat, {
          key, kind: 'scenario', label: `${sc.name} · ${Math.round(sc.probability * 100)}%`,
          color: lift(palette.support, 0.6), radius: 3 + 8 * sc.probability, halo: 10 + 24 * sc.probability, sel: key === selected ? 1 : 0, dim: dimNode(key),
        }));
      });
      s.report.signposts.forEach((sp, i) => {
        if (sp.lat === null || sp.lng === null) return;
        const key = `p:${i}`;
        features.push(point(sp.lng, sp.lat, {
          key, kind: 'signpost', label: sp.text.length > 40 ? `${sp.text.slice(0, 39)}…` : sp.text,
          color: leanColor(sp.means === 'yes' ? 0.9 : 0.1), radius: 3, halo: 8, sel: key === selected ? 1 : 0, dim: dimNode(key),
        }));
      });
    }
    const focus = s.frame?.focus;
    const figure = shortAnswer(s.frame, s.report, s.rounds[s.rounds.length - 1] ?? null);
    if (focus && focus.lat !== null && focus.lng !== null && figure) {
      features.push(point(focus.lng, focus.lat, { key: 'focus', kind: 'focus', label: s.report ? figure : `${figure} …`, color: '#FFFFFF', radius: 0, halo: 0, sel: 0, dim: 0 }));
    }
    (map.getSource(NODES) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });

    // Ripples: a node's arrival, an actor deciding, and the prediction's home while the run is live.
    const pings: Ping[] = [];
    const base = rgb(palette.support);
    for (const f of features) {
      const key = String(f.properties.key);
      if (f.properties.kind === 'context' || f.properties.kind === 'focus') continue;
      if (!nodeBirths.has(key)) nodeBirths.set(key, now + (nodeBirths.size % 12) * 0.05);
      const [lng, lat] = f.geometry.coordinates as LngLat;
      pings.push({ pos: mercator([lng, lat]), color: f.properties.kind === 'actor' ? base : rgb(String(f.properties.color)), size: 26, start: nodeBirths.get(key)!, period: 1.5, once: true });
    }
    // An actor deciding its next move, in any world, ripples.
    const deciding = new Set(Object.keys(s.thinking).map(k => k.split(':')[1]));
    for (const id of [...thinkingSince.keys()]) if (!deciding.has(id)) thinkingSince.delete(id);
    for (const a of s.actors) {
      if (!deciding.has(a.id) || a.lat === null || a.lng === null) continue;
      if (!thinkingSince.has(a.id)) thinkingSince.set(a.id, now);
      pings.push({ pos: mercator([a.lng, a.lat]), color: rgb(lift(palette.support, 0.4)), size: 30, start: thinkingSince.get(a.id)!, period: 1.1, once: false });
    }
    if (s.status === 'running' && focus && focus.lat !== null && focus.lng !== null) {
      focusSince ||= now;
      pings.push({ pos: mercator([focus.lng, focus.lat]), color: base, size: 70, start: focusSince, period: 2.8, once: false });
    }
    layer.setPings(pings);
  }

  const reset = () => {
    births.clear();
    nodeBirths.clear();
    thinkingSince.clear();
    focusSince = 0;
  };

  ensure();

  return {
    update(next) {
      if (next && state && next.startedAt !== state.startedAt) reset();
      state = next;
      ensure();
      if (!next) {
        director.update(null);
        reset();
        drawn = [];
        layer.setArcs([], false);
        layer.setPings([]);
        layer.setLive(false);
        (map.getSource(NODES) as GeoJSONSource | undefined)?.setData(EMPTY);
        return;
      }
      draw(next);
      director.update(next);
    },
    select(key) {
      if (key === selected) return;
      selected = key;
      if (state) draw(state);
    },
    setColors(colors) {
      const valid = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex);
      if (![colors.support, colors.oppose, colors.neutral].every(valid)) return;
      if (colors.support === palette.support && colors.oppose === palette.oppose && colors.neutral === palette.neutral) return;
      palette = { ...colors };
      layer.setTones([palette.support, palette.oppose, palette.neutral].map(rgb));
      if (state) draw(state);
    },
    setInsets(padding) {
      map.easeTo({ padding: padding ?? { top: 0, right: 0, bottom: 0, left: 0 }, duration: 650 });
    },
    follow(on) {
      director.follow(on);
    },
    ensure,
    hit(point) {
      return state ? nodeAt(point) ?? arcAt(point) : null;
    },
    destroy() {
      director.destroy();
      map.off('click', onClick);
      map.off('mousemove', onMove);
      map.off('mouseout', onLeave);
      map.off('style.load', onStyle);
      if (moveTimer) clearTimeout(moveTimer);
      if (!map.getStyle()) return;
      for (const id of [...LAYERS, OI_ARCS]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(NODES)) map.removeSource(NODES);
    },
  };
}

export { frameRun } from './camera';
