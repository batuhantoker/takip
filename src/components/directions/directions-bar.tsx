'use client';

import { Car, Footprints, Bike, ArrowUpDown, Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { nextManeuver, viaRoad, type Place, type RouteResult } from '@/lib/route-plan';
import { useRoutePlanner, type RoutePlannerCallbacks } from './use-route-planner';
import PlaceInput from './place-input';
import DirectionsHeader from './directions-header';
import RouteDetails from './route-details';
import { RouteError, RouteLoading, RouteStart } from './route-status';
import { EndMark, RailRow, StartMark, StopMark } from './route-marks';

export {
  formatDistance, haversine, nextManeuver, elevationPath, arrivalTime, segmentBetween, formatDuration, viaRoad,
} from '@/lib/route-plan';
export type { RouteStep, RouteResult, LiveLocation } from '@/lib/route-plan';

/* ═══════════════════════════════════════════════════════════════
   TAKIP — Directions
   Turn-by-turn routing over /api/v1/directions (Valhalla + OSRM): a start, any
   stops and a destination on one rail; the fastest route and its
   alternatives, each with the road it takes; the steps; and a hand-off to
   live navigation. Places it is given or picks are remembered for next time.
   ═══════════════════════════════════════════════════════════════ */

interface DirectionsBarProps extends RoutePlannerCallbacks {
  onClose?: () => void;
  /** Current map centre — biases search toward what the operator is looking at. */
  center?: { lat: number; lng: number } | null;
  /** Hand the chosen route to the parent to drive live navigation. */
  onStartNavigation?: (route: RouteResult, destinationLabel: string) => void;
  /** A destination to open with, handed over from Search ("Directions to here"). */
  initialTo?: Place | null;
}

const MODES = [
  { id: 'auto', label: 'Drive', Icon: Car },
  { id: 'pedestrian', label: 'Walk', Icon: Footprints },
  { id: 'bicycle', label: 'Bike', Icon: Bike },
] as const;

export default function DirectionsBar({ onRoute, onLocate, onClose, center = null, onLiveLocation, onActiveSegment, onFollowChange, onStartNavigation, initialTo = null }: DirectionsBarProps) {
  const {
    fromText, setFromText, toText, setToText, from, to, mode, route, loading, error, activeStep, setActiveStep,
    locating, locateError, live, tracking, follow, setFollow, routes, chosen, vias, setVias, avoid,
    showOptions, setShowOptions, recent, toggleTracking, useMyLocation,
    pickFrom, pickTo, pickMode, pickRecent, clearEnd, pickVia, removeVia, toggleAvoid, swap, chooseRoute,
  } = useRoutePlanner({ onRoute, onLocate, onLiveLocation, onActiveSegment, onFollowChange }, initialTo);

  const via = route ? viaRoad(route.steps) : null;
  const ready = Boolean(from && to);
  const avoiding = Object.values(avoid).filter(Boolean).length;
  // While tracking, the useful thing is the turn you are approaching, not the
  // whole list — recomputed from each position update.
  const guidance = live && route
    ? nextManeuver(route.steps, route.geometry.coordinates, live.lat, live.lng)
    : null;
  const bias = { biasLat: center?.lat, biasLng: center?.lng };

  return (
    <div className="glass-panel tool-glass relative overflow-hidden flex flex-col max-h-[min(80vh,720px)]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px z-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--gold-rgb),0.7) 30%, rgba(var(--gold-rgb),0.7) 70%, transparent)' }} />

      <DirectionsHeader tracking={tracking} follow={follow} setFollow={setFollow} onFollowChange={onFollowChange} toggleTracking={toggleTracking} onClose={onClose} />

      {/* ── start, stops, destination ── */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <RailRow mark={<StartMark />}>
            <PlaceInput
              value={fromText} onChange={setFromText} onPick={pickFrom} onClear={() => clearEnd('from')}
              placeholder="Choose a start" autoFocus={!initialTo} {...bias}
              onLocate={useMyLocation} locating={locating} liveFix={live} recent={recent}
            />
          </RailRow>
          {vias.map((v, i) => (
            <RailRow key={i} mark={<StopMark />}>
              <PlaceInput
                value={v.text}
                onChange={(t) => setVias((prev) => prev.map((x, j) => (j === i ? { ...x, text: t } : x)))}
                onPick={(p) => pickVia(i, p)}
                placeholder={`Stop ${i + 1}`} {...bias} liveFix={live} recent={recent}
                trailing={(
                  <button type="button" onClick={() => removeVia(i)} aria-label={`Remove stop ${i + 1}`}
                    className="w-8 h-8 mr-0.5 rounded-md flex items-center justify-center flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--alert-red)] hover:bg-[rgba(255,61,61,0.08)] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              />
            </RailRow>
          ))}
          <RailRow mark={<EndMark />} last>
            <PlaceInput
              value={toText} onChange={setToText} onPick={pickTo} onClear={() => clearEnd('to')}
              placeholder="Choose a destination" {...bias} liveFix={live} recent={recent}
            />
          </RailRow>
        </div>
        <button onClick={swap} aria-label="Swap start and destination" title="Swap start and destination"
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-[var(--border-secondary)] bg-black/40 text-[var(--text-secondary)] hover:text-[var(--gold-light)] hover:border-[var(--border-active)] transition-colors">
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 pb-2.5 flex items-center gap-1 flex-shrink-0">
        <button onClick={() => setVias((v) => [...v, { place: null, text: '' }])}
          className="h-7 pl-1.5 pr-2.5 rounded-md flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--gold-light)] hover:bg-white/[0.04] transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add stop
        </button>
        <button onClick={() => setShowOptions((o) => !o)} aria-expanded={showOptions}
          className={`ml-auto h-7 px-2.5 rounded-md flex items-center gap-1.5 text-[11.5px] transition-colors ${showOptions || avoiding ? 'text-[var(--gold-light)] bg-[rgba(var(--gold-rgb),0.08)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-white/[0.04]'}`}>
          <SlidersHorizontal className="w-3.5 h-3.5" /> Options{avoiding ? ` · ${avoiding}` : ''}
        </button>
      </div>

      {/* ── how ── */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div role="tablist" aria-label="Travel mode" className="flex gap-[2px] p-[3px] rounded-lg border border-[var(--border-secondary)] bg-black/45">
          {MODES.map(({ id, label, Icon }) => {
            const on = mode === id;
            return (
              <button key={id} role="tab" aria-selected={on} onClick={() => pickMode(id)}
                className={`relative flex-1 h-8 flex items-center justify-center gap-1.5 rounded-md text-[10.5px] font-mono tracking-[0.12em] uppercase transition-colors ${on ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'}`}
                style={on ? { background: 'rgba(var(--gold-rgb),0.12)', boxShadow: 'inset 0 0 0 1px rgba(var(--gold-rgb),0.32)' } : undefined}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        {showOptions && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-[var(--text-muted)] mr-0.5">Avoid</span>
            {([['tolls', 'Tolls'], ['highways', 'Motorways'], ['ferries', 'Ferries']] as const).map(([k, word]) => (
              <button key={k} onClick={() => toggleAvoid(k)} aria-pressed={avoid[k]}
                className={`flex-1 h-7 rounded-full border text-[11px] transition-colors ${avoid[k] ? 'border-[var(--border-active)] bg-[rgba(var(--gold-rgb),0.12)] text-[var(--gold-light)]' : 'border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'}`}>
                {word}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── result region ── */}
      <div className="min-h-0 flex-1 overflow-y-auto styled-scrollbar border-t border-[var(--border-secondary)]">
        {loading && <RouteLoading />}

        {!loading && error && <RouteError error={error} />}

        {!loading && !error && !route && (
          <RouteStart
            ready={ready} from={from} to={to} useMyLocation={useMyLocation} locating={locating}
            locateError={locateError} recent={recent} pickRecent={pickRecent} center={center}
          />
        )}

        {!loading && route && (
          <RouteDetails
            route={route} routes={routes} chosen={chosen} guidance={guidance} via={via} to={to}
            activeStep={activeStep} setActiveStep={setActiveStep} chooseRoute={chooseRoute}
            onLocate={onLocate} onActiveSegment={onActiveSegment} onStartNavigation={onStartNavigation}
          />
        )}
      </div>
    </div>
  );
}
