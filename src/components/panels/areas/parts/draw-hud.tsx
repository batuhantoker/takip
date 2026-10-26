'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Check, Circle, Earth, Pentagon, Spline, Square, Undo2, X, type LucideIcon } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { useT, type RichTranslate } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { DOCK_WIDTH, NAV_WIDTH } from '@/components/shell/sidebar/dock';
import type { DrawMode, DrawProgress, RegionProgress } from '@/lib/places/areas/draw';
import { LEVELS, type BoundaryLevel } from '@/lib/places/areas/boundaries';
import { formatArea, formatDistance } from '@/lib/core/geodesic';
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

const POINT_AT: Record<BoundaryLevel, string> = {
  country: msg('Point at a country'), admin1: msg('Point at a state'), admin2: msg('Point at a district'), admin3: msg('Point at a sub-district'),
};
const LOADING: Record<BoundaryLevel, string> = {
  country: msg('Loading countries…'), admin1: msg('Loading states and provinces…'), admin2: msg('Loading districts…'), admin3: msg('Loading sub-districts…'),
};
const NONE_HERE: Record<BoundaryLevel, string> = {
  country: msg('No countries on file here'), admin1: msg('No states and provinces on file here'),
  admin2: msg('No districts on file here'), admin3: msg('No sub-districts on file here'),
};
const ZOOM_IN: Record<BoundaryLevel, string> = {
  country: msg('Zoom in for countries'), admin1: msg('Zoom in for states and provinces'),
  admin2: msg('Zoom in for districts'), admin3: msg('Zoom in for sub-districts'),
};
const FIRST_CLICK: Record<Exclude<DrawMode, 'region'>, string> = {
  polygon: msg('Click the first corner'), rectangle: msg('Click one corner'), circle: msg('Click the centre'), line: msg('Click where the path starts'),
};
const rank = (l: BoundaryLevel) => LEVELS.findIndex(x => x.level === l);

const kbd = (name: string) => <Kbd size="sm">{name}</Kbd>;

function regionStep(r: RegionProgress | undefined, t: RichTranslate): string {
  if (r?.failed) return t('The outlines didn’t load; check the connection');
  // A click waits for the finer outline, so naming the coarser one now would be a promise it breaks.
  if (r?.loading && !r.wholeCountry) return t(LOADING[r.level]);
  if (r?.hover) return t('Click to pick {place}', { place: r.hover.name });
  if (!r) return t('Loading outlines…');
  return t(POINT_AT[r.wholeCountry ? 'country' : r.level]);
}

function regionKeys(r: RegionProgress | undefined, t: RichTranslate): ReactNode {
  if (!r) return null;
  if (r.wholeCountry) return t.rich('Holding {key} picks the whole country', { key: kbd('Shift') });
  const country = t.rich('{key} click for the country', { key: kbd('Shift') });
  if (r.hover && !r.loading && rank(r.hover.level) < rank(r.level)) return <>{t(NONE_HERE[r.level])} · {country}</>;
  const finer = LEVELS[rank(r.level) + 1];
  if (r.level === 'country') return <>{t('Zoom in for states and districts')} · {t.rich('{key} to cancel', { key: kbd('Esc') })}</>;
  return <>{finer ? t(ZOOM_IN[finer.level]) : t('Zoom out for larger areas')} · {country}</>;
}

function step(mode: Exclude<DrawMode, 'region'>, vertices: number, t: RichTranslate): string {
  if (vertices === 0) return t(FIRST_CLICK[mode]);
  switch (mode) {
    case 'rectangle': return t('Click the opposite corner');
    case 'circle': return t('Click to set the radius');
    case 'polygon': return vertices < 3 ? t('{n, plural, one {Click # more corner} other {Click # more corners}}', { n: 3 - vertices }) : t('Click to add corners');
    case 'line': return t('Click to add points');
  }
}

function keys(mode: Exclude<DrawMode, 'region'>, vertices: number, t: RichTranslate): ReactNode {
  const cancel = t.rich('{key} to cancel', { key: kbd('Esc') });
  if (mode === 'rectangle' || mode === 'circle') return cancel;
  return (
    <>
      {t.rich('{key} to finish', { key: kbd('Enter') })}{vertices > 0 && <> · {t.rich('{key} to undo', { key: kbd('⌫') })}</>} · {cancel}
    </>
  );
}

export default function DrawHud({ mode, progress, onUndo, onFinish, onCancel, left = NAV_WIDTH + DOCK_WIDTH }: DrawHudProps) {
  const t = useT();
  const vertices = progress?.vertices ?? 0;
  const region = mode === 'region' ? progress?.region : undefined;
  // Two-click shapes and regions complete themselves, so a Finish button would never do anything.
  const multiPoint = mode === 'polygon' || mode === 'line';
  const Icon = ICON[mode];

  const measurement = progress && (
    progress.radiusKm ? formatDistance(progress.radiusKm, t.intl)
      : progress.areaKm2 > 0 ? formatArea(progress.areaKm2, t.intl)
        : progress.lengthKm > 0 ? formatDistance(progress.lengthKm, t.intl) : null
  );
  const settled = region?.hover && !(region.loading && !region.wholeCountry);
  const regionSize = settled && region?.hover?.areaKm2 ? formatArea(region.hover.areaKm2, t.intl) : null;
  // While a finer level loads, the size on hand belongs to the coarser outline the click won't pick.
  const figure = mode === 'region' ? regionSize : measurement;

  return (
    <div className="pointer-events-none absolute top-3 right-3 left-(--hud-left) z-[500] flex justify-center max-md:top-[calc(12px+env(safe-area-inset-top))] max-md:left-3"
      style={{ '--hud-left': `${left + 12}px` } as CSSProperties}>
      <div role="group" aria-label={t('Drawing')}
        className="pointer-events-auto flex min-h-14 max-w-full items-center gap-3 rounded-float border border-line bg-surface-1 py-2 pr-2 pl-3 shadow-float">
        <Icon aria-hidden className="size-4 shrink-0 text-ink-2" strokeWidth={1.75} />
        <div className="flex min-w-0 flex-col">
          <p className="flex min-w-0 items-baseline gap-2 text-body font-medium text-ink-1">
            <span role="status" className="truncate">{mode === 'region' ? regionStep(region, t) : step(mode, vertices, t)}</span>
            {figure && (
              <span className="shrink-0 font-normal text-ink-2">
                {progress?.radiusKm ? t.rich('radius {size}', { size: <Figure>{figure}</Figure> }) : <Figure>{figure}</Figure>}
              </span>
            )}
          </p>
          <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-meta text-ink-3">
            {mode === 'region' ? regionKeys(region, t) : keys(mode, vertices, t)}
          </p>
          {/* Most of these licences require the credit wherever the outlines are shown. */}
          {region?.hover?.source && <p className="truncate text-meta text-ink-3">{t('Outlines: {source}', { source: region.hover.source })}</p>}
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {multiPoint && (
            <>
              <Button size="sm" variant="ghost" icon={Undo2} disabled={vertices === 0} onClick={onUndo}>{t('Undo')}</Button>
              <Button size="sm" variant="primary" icon={Check} disabled={!progress?.closable} onClick={onFinish}>{t('Finish')}</Button>
            </>
          )}
          <IconButton size="sm" icon={X} label={t('Cancel')} kbd="Esc" onClick={onCancel} />
        </div>
      </div>
    </div>
  );
}
