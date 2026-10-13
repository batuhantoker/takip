'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Check, Circle, Earth, Pentagon, Spline, Square, Undo2, X, type LucideIcon } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { DOCK_WIDTH, NAV_WIDTH } from '@/components/shell/sidebar/dock';
import type { DrawMode, DrawProgress, RegionProgress } from '@/lib/areas/draw';
import { LEVELS, type BoundaryLevel } from '@/lib/areas/boundaries';
import { formatArea, formatDistance } from '@/lib/geo';
import { Figure } from '@/components/ui/figure';

/**
 * What to do next, said over the map where the clicking happens: the step in
 * plain words, the keys, the running measurement, and real Undo and Finish
 * buttons so nothing depends on knowing the keys.
 */

interface DrawHudProps {
  mode: DrawMode;
  progress: DrawProgress | null;
  onUndo: () => void;
  onFinish: () => void;
  onCancel: () => void;
  /** Where the map starts, right of the sidebar and any open panel; the pill centres over the map. */
  left?: number;
}

const ICON: Record<DrawMode, LucideIcon> = { polygon: Pentagon, rectangle: Square, circle: Circle, line: Spline, region: Earth };

const LEVEL: Record<BoundaryLevel, string> = { country: 'country', admin1: 'state', admin2: 'district', admin3: 'sub-district' };
const LEVELS_PLURAL: Record<BoundaryLevel, string> = {
  country: 'countries', admin1: 'states and provinces', admin2: 'districts', admin3: 'sub-districts',
};
const rank = (l: BoundaryLevel) => LEVELS.findIndex(x => x.level === l);

function regionStep(r: RegionProgress | undefined): string {
  if (r?.failed) return 'The outlines didn’t load; check the connection';
  // A click waits for the finer outline, so naming the coarser one now would be a promise it breaks.
  if (r?.loading && !r.wholeCountry) return `Loading ${LEVELS_PLURAL[r.level]}…`;
  if (r?.hover) return `Click to pick ${r.hover.name}`;
  if (!r) return 'Loading outlines…';
  return `Point at a ${LEVEL[r.wholeCountry ? 'country' : r.level]}`;
}

function regionKeys(r: RegionProgress | undefined): ReactNode {
  if (!r) return null;
  if (r.wholeCountry) return <>Holding <Kbd size="sm">Shift</Kbd> picks the whole country</>;
  if (r.hover && !r.loading && rank(r.hover.level) < rank(r.level)) {
    return <>No {LEVELS_PLURAL[r.level]} on file here · <Kbd size="sm">Shift</Kbd> click for the country</>;
  }
  const finer = LEVELS[rank(r.level) + 1];
  if (r.level === 'country') return <>Zoom in for states and districts · <Kbd size="sm">Esc</Kbd> to cancel</>;
  return <>{finer ? `Zoom in for ${LEVELS_PLURAL[finer.level]}` : 'Zoom out for larger areas'} · <Kbd size="sm">Shift</Kbd> click for the country</>;
}

function step(mode: Exclude<DrawMode, 'region'>, vertices: number): string {
  if (vertices === 0) {
    return { polygon: 'Click the first corner', rectangle: 'Click one corner', circle: 'Click the centre', line: 'Click where the path starts' }[mode];
  }
  switch (mode) {
    case 'rectangle': return 'Click the opposite corner';
    case 'circle': return 'Click to set the radius';
    case 'polygon': return vertices < 3 ? `Click ${3 - vertices} more ${3 - vertices === 1 ? 'corner' : 'corners'}` : 'Click to add corners';
    case 'line': return 'Click to add points';
  }
}

function keys(mode: Exclude<DrawMode, 'region'>, vertices: number): ReactNode {
  if (mode === 'rectangle' || mode === 'circle') return <><Kbd size="sm">Esc</Kbd> to cancel</>;
  return (
    <>
      <Kbd size="sm">Enter</Kbd> to finish{vertices > 0 && <> · <Kbd size="sm">⌫</Kbd> to undo</>} · <Kbd size="sm">Esc</Kbd> to cancel
    </>
  );
}

export default function DrawHud({ mode, progress, onUndo, onFinish, onCancel, left = NAV_WIDTH + DOCK_WIDTH }: DrawHudProps) {
  const vertices = progress?.vertices ?? 0;
  const region = mode === 'region' ? progress?.region : undefined;
  // Two-click shapes and regions complete themselves, so a Finish button would never do anything.
  const multiPoint = mode === 'polygon' || mode === 'line';
  const Icon = ICON[mode];

  const measurement = progress && (
    progress.radiusKm ? formatDistance(progress.radiusKm)
      : progress.areaKm2 > 0 ? formatArea(progress.areaKm2)
        : progress.lengthKm > 0 ? formatDistance(progress.lengthKm) : null
  );
  const settled = region?.hover && !(region.loading && !region.wholeCountry);
  const regionSize = settled && region?.hover?.areaKm2 ? formatArea(region.hover.areaKm2) : null;
  // While a finer level loads, the size on hand belongs to the coarser outline the click won't pick.
  const figure = mode === 'region' ? regionSize : measurement;

  return (
    <div className="pointer-events-none absolute top-3 right-3 left-(--hud-left) z-[500] flex justify-center max-md:left-3"
      style={{ '--hud-left': `${left + 12}px` } as CSSProperties}>
      <div role="group" aria-label="Drawing"
        className="pointer-events-auto flex min-h-14 max-w-full items-center gap-3 rounded-float border border-line bg-surface-1 py-2 pr-2 pl-3 shadow-float">
        <Icon aria-hidden className="size-4 shrink-0 text-ink-2" strokeWidth={1.75} />
        <div className="flex min-w-0 flex-col">
          <p className="flex min-w-0 items-baseline gap-2 text-body font-medium text-ink-1">
            <span role="status" className="truncate">{mode === 'region' ? regionStep(region) : step(mode, vertices)}</span>
            {figure && <span className="shrink-0 font-normal text-ink-2">{progress?.radiusKm ? 'radius ' : null}<Figure>{figure}</Figure></span>}
          </p>
          <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-meta text-ink-3">
            {mode === 'region' ? regionKeys(region) : keys(mode, vertices)}
          </p>
          {/* Most of these licences require the credit wherever the outlines are shown. */}
          {region?.hover?.source && <p className="truncate text-meta text-ink-3">Outlines: {region.hover.source}</p>}
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {multiPoint && (
            <>
              <Button size="sm" variant="ghost" icon={Undo2} disabled={vertices === 0} onClick={onUndo}>Undo</Button>
              <Button size="sm" variant="primary" icon={Check} disabled={!progress?.closable} onClick={onFinish}>Finish</Button>
            </>
          )}
          <IconButton size="sm" icon={X} label="Cancel" kbd="Esc" onClick={onCancel} />
        </div>
      </div>
    </div>
  );
}
