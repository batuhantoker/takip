'use client';
/**
 * Places, as Search and Directions both list them: one row wherever a place
 * appears. A kind icon, the name with what was typed picked out, where it is,
 * and how far it is from where the map is looking. Built like ListRow, with
 * option semantics so a search box can drive it from the keyboard.
 */
import { createElement, type ReactNode } from 'react';
import {
  Building2, Clock, Globe2, Home, Landmark, LocateFixed, Map as MapIcon, MapPin, Signpost, type LucideIcon,
} from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { cx, TRANSITION } from '@/components/ui/class-names';
import { haversine } from '@/lib/core/geodesic';

export interface PlaceLike {
  label: string;
  context?: string;
  lat: number;
  lng: number;
  kind?: string;
}

const KIND: Record<string, { icon: LucideIcon; label: string; group: string }> = {
  poi: { icon: Landmark, label: 'Place', group: 'Places' },
  address: { icon: Home, label: 'Address', group: 'Addresses' },
  street: { icon: Signpost, label: 'Street', group: 'Streets' },
  city: { icon: Building2, label: 'City', group: 'Cities and towns' },
  region: { icon: MapIcon, label: 'Region', group: 'Regions' },
  country: { icon: Globe2, label: 'Country', group: 'Countries' },
  coordinate: { icon: MapPin, label: 'Coordinates', group: 'Coordinates' },
  current: { icon: LocateFixed, label: 'You', group: 'You' },
  recent: { icon: Clock, label: 'Recent', group: 'Recent' },
};

export const kindIcon = (kind?: string): LucideIcon => KIND[kind ?? '']?.icon ?? MapPin;
export const kindLabel = (kind?: string): string => KIND[kind ?? '']?.label ?? 'Place';
/** The heading a kind of result is listed under. */
export const kindGroup = (kind?: string): string => KIND[kind ?? '']?.group ?? 'Places';

/** How far a place is from a point, rounded the way a person says it. */
export function distanceText(from: { lat: number; lng: number } | null | undefined, to: { lat: number; lng: number }): string {
  if (!from) return '';
  const m = haversine([from.lng, from.lat], [to.lng, to.lat]) * 1000;
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 100_000) return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
  return `${Math.round(m / 1000).toLocaleString('en-US')} km`;
}

/** A name with the first match of what was typed set heavier. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="font-semibold text-ink-1">{text.slice(at, at + q.length)}</span>
      {text.slice(at + q.length)}
    </>
  );
}

/** The kind icon, 16 px, as a row's leading glyph. */
export function KindTile({ kind, on = false, icon }: { kind?: string; on?: boolean; size?: number; icon?: LucideIcon }) {
  return (
    <span aria-hidden className={cx('flex size-4 shrink-0 items-center justify-center', on ? 'text-ink-1' : 'text-ink-3')}>
      {createElement(icon ?? kindIcon(kind), { className: 'size-4', strokeWidth: 1.75 })}
    </span>
  );
}

/**
 * A place in a list. `onPick` is the row; `trailing` sits beside it (an
 * action such as Directions), outside the row's own button.
 */
export function PlaceRow({ place, query = '', on, onPick, onHover, from, trailing, kindOverride, id }: {
  place: PlaceLike;
  query?: string;
  /** The row the keyboard or pointer is on. */
  on: boolean;
  onPick: () => void;
  onHover?: () => void;
  /** Where the map is looking, for the distance. */
  from?: { lat: number; lng: number } | null;
  trailing?: ReactNode;
  /** Show this kind's icon instead of the place's own (e.g. recent). */
  kindOverride?: string;
  id?: string;
}) {
  const kind = kindOverride ?? place.kind;
  const far = place.kind === 'current' ? '' : distanceText(from, place);
  return (
    <div id={id} role="option" aria-selected={on} onMouseMove={onHover}
      className={cx('group/row relative flex min-h-10 items-center gap-3 rounded-control px-2 py-1.5', on ? 'bg-surface-2' : 'hover:bg-surface-2', TRANSITION)}>
      <KindTile kind={kind} on={on} />
      <button type="button" onClick={onPick} tabIndex={-1}
        className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-control">
        <span className={cx('block truncate text-body text-ink-1', place.kind === 'coordinate' && 'font-mono tabular-nums')}>
          <Highlight text={place.label} query={query} />
        </span>
        {place.context && <span className="block truncate text-small text-ink-3">{place.context}</span>}
      </button>
      {far && <span className="shrink-0 font-mono text-small text-ink-3 tabular-nums">{far}</span>}
      {trailing && <span className="relative z-[1] -mr-1 flex shrink-0 items-center">{trailing}</span>}
    </div>
  );
}

/** A keyboard key, for hints. */
export function Key({ children }: { children: ReactNode }) {
  return <Kbd size="sm">{children}</Kbd>;
}
