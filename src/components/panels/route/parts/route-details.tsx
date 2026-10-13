'use client';

import { Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import {
  arrivalTime, elevationPath, formatDistance, formatDuration, segmentBetween, viaRoad,
  type nextManeuver, type Place, type RouteResult,
} from '@/lib/route/plan';
import { StepIcon } from './route-marks';

const mono = 'font-mono tabular-nums';

export default function RouteDetails({
  route, routes, chosen, guidance, via, to, activeStep, setActiveStep, chooseRoute, onLocate, onActiveSegment, onStartNavigation, guiding, onEndNavigation,
}: {
  route: RouteResult;
  routes: RouteResult[];
  chosen: number;
  guidance: ReturnType<typeof nextManeuver>;
  via: string | null;
  to: Place | null;
  activeStep: number | null;
  setActiveStep: (i: number) => void;
  chooseRoute: (i: number) => void;
  onLocate?: (lat: number, lng: number, zoom?: number) => void;
  onActiveSegment?: (seg: [number, number][] | null) => void;
  onStartNavigation?: (route: RouteResult, destinationLabel: string) => void;
  guiding?: boolean;
  onEndNavigation?: () => void;
}) {
  const fastest = Math.max(1, Math.round(routes[0]?.duration / 60));
  return (
    <>
      {/* Stays in view while the steps scroll under it. */}
      <div className="sticky top-0 z-10 border-b border-line bg-surface-1 px-4 pt-4 pb-4">
        {guidance && (
          <div className="mb-4 flex items-center gap-3 rounded-card border border-line bg-surface-2 px-3 py-2.5">
            <StepIcon step={guidance.step} />
            <span className="min-w-0 flex-1 text-body text-ink-1">{guidance.step.instruction}</span>
            <span className={cx(mono, 'shrink-0 text-title text-ink-1')}>{formatDistance(guidance.distance)}</span>
          </div>
        )}
        <p className={cx(mono, 'text-display font-medium text-ink-1')}>{formatDuration(route.duration)}</p>
        <p className="mt-1 text-small text-ink-2">
          <span className={mono}>{formatDistance(route.distance)}</span> · arrive <span className={mono}>{arrivalTime(route.duration)}</span>
          {via && <span className="text-ink-3"> · via {via}</span>}
        </p>
        {(route.hasToll || route.hasHighway || route.hasFerry) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {route.hasToll && <Tag>Tolls</Tag>}
            {route.hasHighway && <Tag>Motorway</Tag>}
            {route.hasFerry && <Tag>Ferry</Tag>}
          </div>
        )}
        {guiding && onEndNavigation ? (
          <Button icon={X} className="mt-4 w-full" onClick={onEndNavigation}>End navigation</Button>
        ) : onStartNavigation && (
          <Button variant="primary" icon={Navigation} className="mt-4 w-full" onClick={() => onStartNavigation(route, to?.label || 'your destination')}>
            Start navigation
          </Button>
        )}
      </div>

      <div className="px-4 pt-5 pb-4">
        {routes.length > 1 && (
          <PanelSection title="Routes" hint={routes.length}>
            <div role="radiogroup" aria-label="Routes">
              {routes.map((r, i) => {
                // Compared in the whole minutes shown, so "14 min" beside "13 min" never reads "same time".
                const slower = Math.max(1, Math.round(r.duration / 60)) - fastest;
                const road = viaRoad(r.steps);
                return (
                  <ListRow key={i} selected={i === chosen} onClick={() => chooseRoute(i)} aria-label={`Route ${i + 1}, ${formatDuration(r.duration)}`}
                    title={<span className={mono}>{formatDuration(r.duration)}</span>}
                    subtitle={<span className="text-ink-3">{road ? `via ${road}` : 'Unnamed roads'}</span>}
                    trailing={(
                      <span className="flex flex-col items-end gap-1 leading-none">
                        <span className={cx(mono, 'text-small text-ink-2')}>{formatDistance(r.distance)}</span>
                        <span className="text-meta text-ink-3">{i === 0 ? 'Fastest' : slower > 0 ? <span className={mono}>+{slower} min</span> : 'Same time'}</span>
                      </span>
                    )} />
                );
              })}
            </div>
          </PanelSection>
        )}

        {route.elevation && route.elevation.length > 1 && (
          <PanelSection title="Elevation" hint={<span className={mono}>↑{route.ascent ?? 0} m ↓{route.descent ?? 0} m</span>}>
            <svg viewBox="0 0 300 40" className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
              <path d={`${elevationPath(route.elevation, 300, 38)} L300,40 L0,40 Z`} className="fill-surface-3" />
              <path d={elevationPath(route.elevation, 300, 38)} fill="none" className="stroke-ink-2" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
            </svg>
          </PanelSection>
        )}

        <PanelSection title="Turn by turn" hint={route.steps.length}>
          <ol>
            {route.steps.map((s, i) => {
              const on = activeStep === i;
              return (
                <li key={i}>
                  <button
                    type="button"
                    aria-current={on ? 'step' : undefined}
                    onClick={() => {
                      setActiveStep(i);
                      onLocate?.(s.location[1], s.location[0], 17);
                      onActiveSegment?.(segmentBetween(route.geometry.coordinates, s.location, route.steps[i + 1]?.location));
                    }}
                    className={cx(
                      '-mx-2 flex w-[calc(100%+16px)] items-start gap-3 rounded-control px-2 py-2 text-left',
                      on ? 'bg-surface-3' : 'hover:bg-surface-2',
                      FOCUS_RING, TRANSITION,
                    )}
                  >
                    <span className="flex h-[18px] w-4 shrink-0 items-center justify-center"><StepIcon step={s} /></span>
                    <span className="min-w-0 flex-1 text-body text-ink-1">{s.instruction}</span>
                    {s.distance > 0 && <span className={cx(mono, 'shrink-0 text-small leading-[18px] text-ink-3')}>{formatDistance(s.distance)}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </PanelSection>
      </div>
    </>
  );
}
