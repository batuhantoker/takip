'use client';

import { Clock, Mountain, Navigation, Play } from 'lucide-react';
import {
  arrivalTime, elevationPath, formatDistance, formatDuration, segmentBetween, viaRoad,
  type nextManeuver, type Place, type RouteResult,
} from '@/lib/route-plan';
import { StepIcon } from './route-marks';

export default function RouteDetails({
  route, routes, chosen, guidance, via, to, activeStep, setActiveStep, chooseRoute, onLocate, onActiveSegment, onStartNavigation,
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
}) {
  return (
    <>
      {guidance && (
        <div className="mx-3 mt-3 rounded-lg border px-3 py-2.5" style={{ borderColor: 'rgba(var(--gold-rgb),0.3)', background: 'rgba(var(--gold-rgb),0.06)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Navigation className="w-3 h-3 text-[var(--gold-light)]" />
            <span className="text-[9.5px] font-mono tracking-[0.14em] uppercase text-[var(--gold-light)]">Next</span>
          </div>
          <div className="flex items-center gap-3">
            <StepIcon type={guidance.step.type} on />
            <span className="flex-1 min-w-0 text-[13px] text-[var(--text-heading)] leading-snug">{guidance.step.instruction}</span>
            <span className="text-[15px] font-mono text-[var(--gold-light)] tabular-nums flex-shrink-0">{formatDistance(guidance.distance)}</span>
          </div>
        </div>
      )}

      {/* summary — sticky so time, distance and arrival stay in view while the steps scroll under it */}
      <div className="sticky top-0 z-10 px-4 pt-3.5 pb-3 border-b border-[var(--border-secondary)]" style={{ background: 'var(--oi-solid)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] leading-none font-mono font-light tabular-nums text-[var(--text-heading)]" style={{ textShadow: '0 0 20px rgba(var(--gold-rgb),0.2)' }}>
                {formatDuration(route.duration)}
              </span>
              {chosen === 0 && routes.length > 1 && <span className="text-[9.5px] font-mono tracking-[0.12em] uppercase text-[var(--gold-light)]">Fastest</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)] tabular-nums">
              <span>{formatDistance(route.distance)}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <Clock className="w-3 h-3 text-[var(--text-muted)]" />
              <span>Arrive {arrivalTime(route.duration)}</span>
            </div>
            {via && <div className="mt-0.5 text-[11.5px] text-[var(--text-muted)] truncate">via {via}</div>}
          </div>
          {(route.hasToll || route.hasHighway || route.hasFerry) && (
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {route.hasToll && <span className="h-5 px-1.5 rounded flex items-center text-[9px] font-mono tracking-[0.1em] uppercase border border-[rgba(var(--gold-rgb),0.35)] text-[var(--gold-light)]">Toll</span>}
              {route.hasHighway && <span className="h-5 px-1.5 rounded flex items-center text-[9px] font-mono tracking-[0.1em] uppercase border border-[var(--border-secondary)] text-[var(--text-secondary)]">Motorway</span>}
              {route.hasFerry && <span className="h-5 px-1.5 rounded flex items-center text-[9px] font-mono tracking-[0.1em] uppercase border border-[var(--border-secondary)] text-[var(--text-secondary)]">Ferry</span>}
            </div>
          )}
        </div>

        {onStartNavigation && (
          <button onClick={() => onStartNavigation(route, to?.label || 'your destination')} className="tool-btn-primary w-full mt-3">
            <Play className="w-4 h-4" fill="currentColor" /> Start navigation
          </button>
        )}
      </div>

      {routes.length > 1 && (
        <div className="px-3 pt-3">
          <span className="block px-1 pb-1.5 text-[9.5px] font-mono tracking-[0.14em] uppercase text-[var(--text-muted)]">Routes · {routes.length}</span>
          <div role="radiogroup" aria-label="Routes" className="flex flex-col gap-1">
            {routes.map((r, i) => {
              const on = i === chosen;
              // Compared in the whole minutes shown, so "14 min" beside "13 min" never reads "same time".
              const slower = Math.max(1, Math.round(r.duration / 60)) - Math.max(1, Math.round(routes[0].duration / 60));
              const road = viaRoad(r.steps);
              return (
                <button key={i} role="radio" aria-checked={on} onClick={() => chooseRoute(i)}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${on ? 'border-[rgba(var(--gold-rgb),0.45)] bg-[rgba(var(--gold-rgb),0.08)]' : 'border-[var(--border-secondary)] hover:bg-white/[0.03] hover:border-[var(--border-primary)]'}`}>
                  <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 border" style={{ borderColor: on ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                    {on && <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)]" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[12.5px] font-mono tabular-nums ${on ? 'text-[var(--gold-light)]' : 'text-[var(--text-heading)]'}`}>{formatDuration(r.duration)}</span>
                    <span className="block text-[11px] text-[var(--text-muted)] truncate">{road ? `via ${road}` : formatDistance(r.distance)}</span>
                  </span>
                  <span className="flex flex-col items-end flex-shrink-0 text-[10.5px] font-mono tabular-nums">
                    <span className="text-[var(--text-secondary)]">{formatDistance(r.distance)}</span>
                    <span className={i === 0 ? 'text-[var(--gold-light)]' : 'text-[var(--text-muted)]'}>{i === 0 ? 'Fastest' : slower > 0 ? `+${slower} min` : 'Same time'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {route.elevation && route.elevation.length > 1 && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[9.5px] font-mono tracking-[0.14em] uppercase text-[var(--text-muted)]">
              <Mountain className="w-3 h-3" /> Elevation
            </span>
            <span className="text-[10.5px] font-mono text-[var(--text-secondary)] tabular-nums">↑{route.ascent ?? 0} m · ↓{route.descent ?? 0} m</span>
          </div>
          <svg viewBox="0 0 300 40" className="w-full h-10" preserveAspectRatio="none" aria-hidden="true">
            <path d={`${elevationPath(route.elevation, 300, 38)} L300,40 L0,40 Z`} fill="rgba(var(--gold-rgb),0.12)" />
            <path d={elevationPath(route.elevation, 300, 38)} fill="none" stroke="var(--gold-primary)" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      )}

      {/* steps */}
      <div className="px-3 pt-3 pb-2">
        <span className="block px-1 pb-1.5 text-[9.5px] font-mono tracking-[0.14em] uppercase text-[var(--text-muted)]">Turn by turn · {route.steps.length}</span>
        <ol className="flex flex-col gap-0.5">
          {route.steps.map((s, i) => {
            const on = activeStep === i;
            return (
              <li key={i}>
                <button
                  onClick={() => {
                    setActiveStep(i);
                    onLocate?.(s.location[1], s.location[0], 17);
                    onActiveSegment?.(segmentBetween(route.geometry.coordinates, s.location, route.steps[i + 1]?.location));
                  }}
                  className={`relative w-full text-left rounded-lg pl-3 pr-2.5 py-2 flex items-center gap-3 transition-colors ${on ? 'bg-[rgba(var(--gold-rgb),0.08)]' : 'hover:bg-white/[0.035]'}`}>
                  {on && <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-[var(--gold-primary)]" />}
                  <StepIcon type={s.type} on={on} />
                  <span className={`flex-1 min-w-0 text-[12.5px] leading-snug ${on ? 'text-[var(--text-heading)]' : 'text-[var(--text-primary)]'}`}>{s.instruction}</span>
                  {s.distance > 0 && (
                    <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums flex-shrink-0 text-right min-w-[44px]">{formatDistance(s.distance)}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="px-4 py-2.5 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] border-t border-[var(--border-secondary)]">
        Routing by {route.provider} ·{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--gold-light)]">© OpenStreetMap</a>
      </p>
    </>
  );
}
