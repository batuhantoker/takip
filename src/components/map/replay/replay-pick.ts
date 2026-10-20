'use client';

import { useSyncExternalStore } from 'react';
import type { FlightLayer } from '@/components/map/inspect/types';
import { followKey } from '@/components/map/inspect/use-follow';
import { sampleEntity, type ReplayEntity } from '@/lib/map/replay/track-sample';

/*
 * The replayed ship or aircraft picked on the map or found by Search. The replay layer registers how to
 * find what it draws; the click handler, hover tip, Search and the card ask here, since nothing else holds
 * replayed entities. Only what is loaded for the view is known: the layer loads chunks by viewport.
 */

export interface ReplayPicker {
  /** The drawn entity under a screen point, within `slop` px. */
  at(x: number, y: number, slop: number): ReplayEntity | null;
  /** Every entity drawn now. */
  drawn(): ReplayEntity[];
  /** The loaded entity with this id; a new chunk replaces the objects, so look it up again each time. */
  entity(id: number): ReplayEntity | null;
  select(id: number | null): void;
  /** The replay clock, epoch seconds. */
  time(): number;
}

export type ReplayPick = Pick<ReplayEntity, 'entity' | 'cls' | 'category' | 'label'>;

const FLIGHT_LAYER: Record<string, FlightLayer> = { commercial: 'fl-commercial', private: 'fl-private', jet: 'fl-jets', military: 'fl-military' };
/** The live layer a replayed aircraft's category matches, for its label. */
export const replayFlightLayer = (category: string): FlightLayer => FLIGHT_LAYER[category] ?? 'fl-commercial';

/** How far from a marker a pointer still counts as on it, in px. */
export const REPLAY_SLOP = 10;

/** The follow key for a replayed entity (use-follow.ts: one thing is followed at a time). */
export const replayFollowKey = (entity: number) => `replay:${entity}`;

let picker: ReplayPicker | null = null;
let picked: ReplayPick | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The replay layer, while it is on the map. Detaching drops the pick: it belongs to that replay. */
export function attachReplayPicker(p: ReplayPicker) {
  picker = p;
  p.select(picked?.entity ?? null);
  emit();
  return () => {
    if (picker !== p) return;
    picker = null;
    pickReplay(null);
  };
}

export function pickReplay(e: ReplayEntity | null, { follow = false } = {}) {
  picked = e ? { entity: e.entity, cls: e.cls, category: e.category, label: e.label } : null;
  picker?.select(picked?.entity ?? null);
  if (e && follow) followKey(replayFollowKey(e.entity));
  emit();
}

/** The entity drawn under a screen point, if Replay is on. */
export const replayAt = (x: number, y: number, slop: number) => picker?.at(x, y, slop) ?? null;

/** Picks whatever is drawn under a screen point; false when nothing is. */
export function pickReplayAt(x: number, y: number, slop: number): boolean {
  const e = replayAt(x, y, slop);
  if (e) pickReplay(e);
  return !!e;
}

export const replayEntity = (id: number) => picker?.entity(id) ?? null;

/** Where an entity is at the replay clock's time. */
export const replayPosition = (e: ReplayEntity) => (picker ? sampleEntity(e, picker.time()) : null);

const squash = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');

/** Aircraft drawn now whose callsign is or starts with the query, whole matches first. */
export function findReplayAircraft(query: string, limit = 5): ReplayEntity[] {
  const q = squash(query);
  if (!picker || q.length < 2) return [];
  return picker.drawn()
    .filter(e => e.cls === 'aircraft' && squash(e.label).startsWith(q))
    .sort((a, b) => Number(squash(b.label) === q) - Number(squash(a.label) === q) || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export const useReplayPick = () => useSyncExternalStore(subscribe, () => picked, () => null);

/** Whether Replay's layer is on the map, so there is something to pick. */
export const useReplayOn = () => useSyncExternalStore(subscribe, () => picker !== null, () => false);
