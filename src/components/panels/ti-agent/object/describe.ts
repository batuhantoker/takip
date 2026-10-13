import type { ReactNode } from 'react';
import type { Selection } from '@/lib/oi/research';
import type { RunState } from '@/lib/oi/state';
import type { LinkKind } from '@/lib/oi/types';
import type { Pick } from './parts';

/** What an object's view shows: who it is, its facts, and what it links to. */
export interface Described {
  type: string;
  subtype?: string;
  title: ReactNode;
  iconSub?: string;
  iconLink?: LinkKind;
  props: [string, ReactNode][];
  body: ReactNode;
  locate: { lat: number; lng: number; zoom: number } | null;
  inGraph: boolean;
}

export interface DescribeCtx {
  s: RunState;
  onSelect: Pick;
  onAsk: (actorId: string) => void;
}

export type Describer<T extends Selection['type']> = (sel: Extract<Selection, { type: T }>, ctx: DescribeCtx) => Described;

/** Where an actor, event or source sits on the map, if it does. */
export function placeOf(s: RunState, k: string): { lat: number; lng: number } | null {
  const [prefix, ...rest] = k.split(':');
  const id = rest.join(':');
  const n = prefix === 'a' ? s.actors.find(a => a.id === id) : prefix === 'e' ? s.events.find(e => e.id === id) : prefix === 'c' ? s.context.find(c => c.id === id) : null;
  return n && n.lat !== null && n.lng !== null ? { lat: n.lat, lng: n.lng } : null;
}
