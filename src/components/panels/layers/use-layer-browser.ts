'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { SHIP_CLASSES } from '@/lib/feeds/maritime/ship-filter';
import { LAYER_GROUPS, primary, type LayerDef, type LayerGroupDef } from './layer-groups';
import { layerCount } from '@/components/panels/layers/lib/layer-count';
import { layerName } from '@/components/panels/layers/parts/layer-row';
import { filterSections, groupSections, type LayerSection } from '@/components/panels/layers/lib/layer-sections';
import type { OnMapItem } from '@/components/panels/layers/parts/layers-on-map';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the page's live data and layer state are untyped
type Loose = any;

const OPEN_KEY = 'takip.layers.open';
const SHIP_TYPE_OF: Record<string, string> = Object.fromEntries(SHIP_CLASSES.map(c => [c.key, c.type]));
const UNDO_FOR_MS = 8000;

export interface LayerUndo {
  keys: string[];
  text: string;
}

function loadOpen(): Record<string, boolean> | null {
  try {
    const raw = window.localStorage.getItem(OPEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const anyOn = (section: LayerSection, active: Record<string, boolean>) =>
  primary(section.groups.flatMap(g => g.layers)).some(l => active[l.key]);

/** Search, grouping, counts and the open groups, shared by the docked panel and the phone's list. */
export function useLayerBrowser({ data, activeLayers, setActiveLayers, capabilities, extraGroups = [], beforeTurnOn }: {
  data: Loose;
  activeLayers: Record<string, boolean>;
  setActiveLayers: Dispatch<SetStateAction<Loose>>;
  capabilities: Record<string, boolean>;
  /** Groups the sections leave out but this list wants, such as Display on a phone. */
  extraGroups?: LayerSection[];
  /** Runs before any layer turns on, with the keys about to turn on. */
  beforeTurnOn?: (keys: string[]) => void;
}) {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const allowed = (g: LayerGroupDef) => ({ ...g, layers: g.layers.filter(l => !l.requires || capabilities[l.requires]) });
    const base = groupSections(LAYER_GROUPS.map(allowed).filter(g => g.layers.length > 0));
    return [...base, ...extraGroups.map(s => ({ ...s, groups: s.groups.map(allowed) }))];
  }, [capabilities, extraGroups]);

  // Remembered between visits; on a first visit, the groups with something on start open.
  const [open, setOpenState] = useState<Record<string, boolean>>(() =>
    (typeof window !== 'undefined' && loadOpen()) || Object.fromEntries(sections.map(s => [s.id, anyOn(s, activeLayers)])));
  const setOpen = useCallback((id: string, value: boolean) => {
    setOpenState(prev => {
      const next = { ...prev, [id]: value };
      try { window.localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  }, []);
  const searching = query.trim().length > 0;
  const shown = useMemo(() => filterSections(sections, query), [sections, query]);

  // Results open in full; folding one lasts only as long as that query.
  const [folded, setFolded] = useState<{ query: string; ids: Set<string> }>({ query: '', ids: new Set() });
  const foldedNow = folded.query === query ? folded.ids : null;
  const setOpenAny = useCallback((id: string, value: boolean) => {
    if (!searching) { setOpen(id, value); return; }
    setFolded(prev => {
      const ids = new Set(prev.query === query ? prev.ids : []);
      if (value) ids.delete(id); else ids.add(id);
      return { query, ids };
    });
  }, [searching, query, setOpen]);
  const isOpen = (id: string) => (searching ? !foldedNow?.has(id) : !!open[id]);

  const collapseAll = useCallback(() => {
    if (searching) { setFolded({ query, ids: new Set(shown.map(s => s.id)) }); return; }
    setOpenState(() => {
      const next = Object.fromEntries(sections.map(s => [s.id, false]));
      try { window.localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  }, [searching, query, shown, sections]);
  // Ships by type, as the map colours them: a ship with no type yet is drawn as other.
  const maritime: unknown = data?.maritime_ships;
  const shipTypes = useMemo(() => {
    const ships: { type?: string }[] = Array.isArray(maritime) ? maritime : [];
    const n = new Map<string, number>();
    for (const s of ships) n.set(s.type || 'other', (n.get(s.type || 'other') ?? 0) + 1);
    return ships.length ? n : null;
  }, [maritime]);
  const countOf = useCallback((l: LayerDef) => {
    const ship = SHIP_TYPE_OF[l.key];
    if (ship) return shipTypes ? shipTypes.get(ship) ?? 0 : null;
    return layerCount(data, l.dataKey, l.catKey);
  }, [data, shipTypes]);

  const onMap: OnMapItem[] = sections
    .flatMap(s => s.groups.flatMap(g => primary(g.layers)))
    .filter(l => activeLayers[l.key])
    .map(l => ({ key: l.key, label: layerName(l), count: countOf(l) }));

  const setMany = useCallback((keys: string[], on: boolean) => {
    if (on) beforeTurnOn?.(keys.filter(k => !activeLayers[k]));
    setActiveLayers((prev: Record<string, boolean>) => ({ ...prev, ...Object.fromEntries(keys.map(k => [k, on])) }));
  }, [activeLayers, beforeTurnOn, setActiveLayers]);
  const toggle = useCallback((key: string) => setMany([key], !activeLayers[key]), [activeLayers, setMany]);

  // Kept here, not in the On the map list, so typing a search does not drop a pending undo.
  const [undo, setUndo] = useState<LayerUndo | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_FOR_MS);
    return () => clearTimeout(t);
  }, [undo]);
  const turnOff = useCallback((gone: OnMapItem[]) => {
    if (!gone.length) return;
    setMany(gone.map(i => i.key), false);
    setUndo({ keys: gone.map(i => i.key), text: gone.length === 1 ? `${gone[0].label} turned off` : `${gone.length} layers turned off` });
  }, [setMany]);
  const restore = useCallback(() => {
    if (undo) setMany(undo.keys, true);
    setUndo(null);
  }, [undo, setMany]);

  const countLayers = (list: LayerSection[]) => list.reduce((n, s) => n + primary(s.groups.flatMap(g => g.layers)).length, 0);
  const layerTotal = countLayers(sections);
  const matchCount = searching ? countLayers(shown) : layerTotal;
  const anyOpen = shown.some(s => isOpen(s.id));

  return {
    query, setQuery, searching, sections, shown, isOpen, setOpen: setOpenAny, collapseAll, anyOpen,
    countOf, onMap, setMany, toggle, layerTotal, matchCount, undo, turnOff, restore,
  };
}
