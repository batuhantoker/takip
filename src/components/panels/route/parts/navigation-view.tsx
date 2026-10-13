'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Flag, LoaderCircle, LocateFixed, TriangleAlert, Volume2, VolumeX, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import {
  cumulativeDistances, stepPositions, computeProgress, shouldAnnounce, announcementText,
  type NavStep, type NavFix, type NavProgress,
} from '@/lib/route/navigation';
import { ManeuverIcon } from './route-marks';

/** Turn-by-turn guidance, driven by the device's own position feed. */

export interface NavRoute {
  distance: number;
  duration: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  steps: NavStep[];
}

interface NavigationViewProps {
  route: NavRoute;
  destinationLabel: string;
  /** Position feed; the parent owns the geolocation watch. */
  fix: NavFix | null;
  onExit: () => void;
  /** Ask the parent to recompute the route from the current position. */
  onReroute: (from: { lat: number; lng: number }) => void;
  /** Snapped position + progress, so the map can follow and draw. */
  onProgress?: (p: NavProgress | null) => void;
  /** Whether the map is currently locked to the driver. */
  following?: boolean;
  /** Re-lock the camera after the operator has looked around. */
  onRecenter?: () => void;
}

/** Guidance distances read better rounded than exact. */
export function navDistance(m: number): string {
  if (m < 20) return 'Now';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return m < 10_000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 1000)} km`;
}

export function navDuration(s: number): string {
  const mins = Math.max(1, Math.round(s / 60));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

export default function NavigationView({
  route, destinationLabel, fix, onExit, onReroute, onProgress, following, onRecenter,
}: NavigationViewProps) {
  const [muted, setMuted] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  // Coarse clock for the arrival time — reading Date.now() during render is
  // impure, and the ETA does not need to tick faster than this anyway.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const spoken = useRef<Record<number, number>>({});
  const offRouteSince = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  // Derived once per route rather than on every position update. The parent
  // keys this component by route, so a recalculated route remounts it and the
  // spoken/off-route bookkeeping resets without a state write in an effect.
  const geometry = route.geometry.coordinates;
  const cumulative = useMemo(() => cumulativeDistances(geometry), [geometry]);
  const stepAlong = useMemo(
    () => stepPositions(geometry, route.steps, cumulative),
    [geometry, route.steps, cumulative],
  );

  // Progress is derived from the current fix, not stored — deriving it keeps
  // the render a pure function of props and avoids a state write per fix.
  const progress = useMemo<NavProgress | null>(
    () => (fix && geometry.length
      ? computeProgress(geometry, route.steps, stepAlong, route.duration, fix, cumulative)
      : null),
    [fix, geometry, route.steps, stepAlong, route.duration, cumulative],
  );

  const speak = useCallback((text: string) => {
    if (muted || typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
  }, [muted]);

  // ── the guidance loop: side effects only ──
  useEffect(() => {
    const p = progress;
    if (!p || !fix) return;

    onProgress?.(p);

    if (p.arrived) {
      if (!spoken.current[-1]) {
        spoken.current[-1] = 1;
        speak('You have arrived at your destination.');
      }
      return;
    }

    // Only reroute once the driver has been off-line for a few seconds — a
    // single noisy fix beside a building should not tear up the route.
    if (p.offRoute) {
      if (offRouteSince.current === null) offRouteSince.current = Date.now();
      else if (Date.now() - offRouteSince.current > 6000 && !rerouting) {
        setRerouting(true);
        speak('Recalculating.');
        onReroute({ lat: fix.lat, lng: fix.lng });
      }
      return;
    }
    offRouteSince.current = null;

    const step = route.steps[p.stepIndex];
    if (!step) return;
    const band = shouldAnnounce(p.stepIndex, p.distanceToStep, spoken.current);
    if (band !== null) {
      spoken.current[p.stepIndex] = band;
      speak(announcementText(step.instruction, band));
    }
  }, [progress, fix, route.steps, speak, onReroute, onProgress, rerouting]);

  // Keep the display awake — a navigation view that sleeps mid-junction is useless.
  useEffect(() => {
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } };
    nav.wakeLock?.request('screen').then((s) => {
      if (cancelled) { s.release().catch(() => {}); return; }
      wakeLock.current = s;
    }).catch(() => {});
    return () => {
      cancelled = true;
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, []);

  // Never leave a half-spoken instruction behind on exit.
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const step = progress ? route.steps[progress.stepIndex] : route.steps[0];
  const arrived = progress?.arrived ?? false;
  const next = progress && !arrived ? route.steps[progress.stepIndex + 1] : undefined;
  // Until the first fix arrives, the whole route is what is left.
  const left = progress
    ? { seconds: progress.durationRemaining, metres: progress.distanceRemaining }
    : { seconds: route.duration, metres: route.distance };
  const toTurn = progress ? navDistance(progress.distanceToStep) : null;

  return (
    <div className="overflow-hidden rounded-float border border-line bg-surface-1 shadow-float">
      {/* The turn, big enough to read at a glance from the road. */}
      <div className="flex items-center gap-4 py-3.5 pr-2 pl-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-card bg-surface-2 text-ink-1">
          {arrived ? <Flag aria-hidden className="size-8" strokeWidth={1.75} /> : <ManeuverIcon step={step ?? { type: 'straight' }} className="size-8" />}
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          {!arrived && toTurn && (
            <p className={cx('text-display font-medium text-ink-1', toTurn !== 'Now' && 'font-mono tabular-nums')}>{toTurn}</p>
          )}
          <p className={cx('text-title', arrived || !progress ? 'font-semibold text-ink-1' : 'text-ink-2')}>
            {arrived ? `You have arrived at ${destinationLabel}` : step?.instruction ?? 'Starting…'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-0.5 self-start">
          <IconButton icon={X} label="End navigation" tooltipSide="left" onClick={onExit} />
          <IconButton icon={muted ? VolumeX : Volume2} active={muted} tooltipSide="left"
            label={muted ? 'Turn voice guidance on' : 'Mute voice guidance'}
            onClick={() => { setMuted((m) => !m); window.speechSynthesis?.cancel(); }} />
          {/* Only once the camera has been taken off the driver; while following it would do nothing. */}
          {onRecenter && !following && <IconButton icon={LocateFixed} label="Back to me, and follow" tooltipSide="left" onClick={onRecenter} />}
        </div>
      </div>

      <div className="h-0.5 bg-surface-3" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${Math.round((progress?.fraction ?? 0) * 100)}%` }} />
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5">
        {rerouting ? (
          <span className="flex items-center gap-2 text-small text-amber"><LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.75} /> Finding a new route…</span>
        ) : progress?.offRoute ? (
          <span className="flex items-center gap-2 text-small text-amber"><TriangleAlert aria-hidden className="size-3.5" strokeWidth={1.75} /> Off route</span>
        ) : (
          <span className="truncate text-small text-ink-2">To {destinationLabel}</span>
        )}
        {!arrived && (
          <span className="flex shrink-0 items-baseline gap-2.5 font-mono tabular-nums">
            <span className="text-body font-medium text-ink-1">{navDuration(left.seconds)}</span>
            <span className="text-small text-ink-2">{navDistance(left.metres)}</span>
            <span className="font-sans text-small text-ink-3">
              arrive <span className="font-mono tabular-nums">{new Date(now + left.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
          </span>
        )}
      </div>

      {next && (
        <div className="flex min-h-10 items-center gap-3 border-t border-line px-4 py-2">
          <span className="text-meta font-medium text-ink-3">Then</span>
          <ManeuverIcon step={next} className="size-4 shrink-0 text-ink-2" />
          <span className="truncate text-small text-ink-2">{next.instruction}</span>
        </div>
      )}

      {!fix && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-small text-ink-2">
          <LoaderCircle aria-hidden className="size-3.5 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none" strokeWidth={1.75} />
          {typeof window !== 'undefined' && !window.isSecureContext
            ? 'Your browser only shares your position over a secure (https) connection.'
            : 'Waiting for your position…'}
        </div>
      )}
    </div>
  );
}
