'use client';

import type { ReactNode } from 'react';
import { ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, Flag, MapPin, Merge, RotateCw, Ship, Undo2, type LucideIcon } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { maneuverKind, type ManeuverKind } from '@/lib/route/maneuver';

/** The start: a hollow ring, as on the map. */
export function StartMark({ className }: { className?: string }) {
  return <span aria-hidden className={cx('size-3 shrink-0 rounded-full border-2 border-ink-1 bg-surface-1', className)} />;
}

/** The destination: a filled pin. */
export function EndMark({ className = 'size-4' }: { className?: string }) {
  return <MapPin aria-hidden strokeWidth={2} className={cx('shrink-0 fill-accent/25 text-accent', className)} />;
}

/** A stop on the way: a small square. */
export function StopMark() {
  return <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-ink-2" />;
}

const ICON: Record<ManeuverKind, LucideIcon> = {
  depart: ArrowUp, arrive: Flag, straight: ArrowUp, left: CornerUpLeft, right: CornerUpRight,
  'slight-left': ArrowUpLeft, 'slight-right': ArrowUpRight, uturn: Undo2, roundabout: RotateCw, merge: Merge, ferry: Ship,
};

export type StepLike = { type: string; instruction?: string };

/** A step's manoeuvre as a bare icon, at whatever size the caller sets: turn arrows, a roundabout, a flag at the end. */
export function ManeuverIcon({ step, className }: { step: StepLike; className?: string }) {
  const Icon = ICON[maneuverKind(step)];
  return <Icon aria-hidden strokeWidth={1.75} className={className} />;
}

/** A step's manoeuvre, 16 px, for a list row; turns read stronger than carrying straight on. */
export function StepIcon({ step }: { step: StepLike }) {
  const kind = maneuverKind(step);
  if (kind === 'depart') return <StartMark className="size-2.5" />;
  if (kind === 'arrive') return <EndMark />;
  const Icon = ICON[kind];
  return <Icon aria-hidden strokeWidth={1.75} className={cx('size-4', kind === 'straight' ? 'text-ink-3' : 'text-ink-1')} />;
}

/** One place on the route rail: its mark, and the dotted line down to the next. */
export function RailRow({ mark, last = false, children }: { mark: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <div className="relative flex items-center gap-3">
      <span aria-hidden className="relative flex w-4 shrink-0 items-center justify-center self-stretch">
        {mark}
        {!last && <span className="absolute top-[calc(50%+9px)] left-1/2 h-[calc(100%-10px)] w-0 -translate-x-1/2 border-l border-dashed border-ink-4" />}
      </span>
      {children}
    </div>
  );
}
