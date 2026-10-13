'use client';

import { ArrowUpDown, Bike, Car, Footprints, Plus, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { Button, IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { nextManeuver, viaRoad, type Place, type RouteResult } from '@/lib/route/plan';
import { useRoutePlanner, type RoutePlannerCallbacks } from './use-route-planner';
import PlaceInput from '@/components/panels/route/parts/place-input';
import DirectionsActions, { LiveMark } from '@/components/panels/route/parts/directions-header';
import RouteOptions from '@/components/panels/route/parts/route-options';
import RouteDetails from '@/components/panels/route/parts/route-details';
import { RouteError, RouteLoading, RouteStart } from '@/components/panels/route/parts/route-status';
import { EndMark, RailRow, StartMark, StopMark } from '@/components/panels/route/parts/route-marks';

export {
  formatDistance, haversine, nextManeuver, elevationPath, arrivalTime, segmentBetween, formatDuration, viaRoad,
} from '@/lib/route/plan';
export type { RouteStep, RouteResult, LiveLocation } from '@/lib/route/plan';

/**
 * Turn-by-turn routing over /api/v1/directions (Valhalla + OSRM): a start, any
 * stops and a destination on one rail; the fastest route and its alternatives,
 * each with the road it takes; the steps; and a hand-off to live navigation.
 * Places it is given or picks are remembered for next time.
 */

interface DirectionsBarProps extends RoutePlannerCallbacks {
  onClose?: () => void;
  /** Current map centre — biases search toward what the operator is looking at. */
  center?: { lat: number; lng: number } | null;
  /** Hand the chosen route to the parent to drive live navigation. */
  onStartNavigation?: (route: RouteResult, destinationLabel: string) => void;
  /** A destination to open with, handed over from Search ("Directions to here"). */
  initialTo?: Place | null;
  /** Guidance is running on this route. */
  guiding?: boolean;
  onEndNavigation?: () => void;
}

type Mode = 'auto' | 'pedestrian' | 'bicycle';

const PROVIDER: Record<string, string> = { valhalla: 'Valhalla', osrm: 'OSRM' };

const MODES: SegmentedOption<Mode>[] = [
  { value: 'auto', label: 'Drive', icon: Car },
  { value: 'pedestrian', label: 'Walk', icon: Footprints },
  { value: 'bicycle', label: 'Bike', icon: Bike },
];

export default function DirectionsBar({ onRoute, onLocate, onClose, center = null, onLiveLocation, onActiveSegment, onFollowChange, onStartNavigation, initialTo = null, guiding = false, onEndNavigation }: DirectionsBarProps) {
  const {
    fromText, setFromText, toText, setToText, from, to, mode, route, loading, error, activeStep, setActiveStep,
    locating, locateError, live, tracking, follow, setFollow, routes, chosen, vias, setVias, avoid,
    recent, toggleTracking, useMyLocation,
    pickFrom, pickTo, pickMode, pickRecent, clearEnd, pickVia, removeVia, toggleAvoid, swap, chooseRoute,
  } = useRoutePlanner({ onRoute, onLocate, onLiveLocation, onActiveSegment, onFollowChange }, initialTo);
  const mobile = useIsMobile();

  const via = route ? viaRoad(route.steps) : null;
  const ready = Boolean(from && to);
  // While tracking, the useful thing is the turn you are approaching, not the
  // whole list — recomputed from each position update.
  const guidance = live && route
    ? nextManeuver(route.steps, route.geometry.coordinates, live.lat, live.lng)
    : null;
  const bias = { biasLat: center?.lat, biasLng: center?.lng };

  return (
    // The dock closes the panel on Escape; this stays mounted while hidden, so it must not listen too.
    <Panel title="Route" bare docked={!mobile} closeOnEscape={false} onClose={onClose}
      meta={tracking ? <LiveMark /> : undefined}
      className={mobile ? 'max-h-[min(72vh,640px)]' : undefined}
      actions={<DirectionsActions tracking={tracking} follow={follow} setFollow={setFollow} onFollowChange={onFollowChange} toggleTracking={toggleTracking} />}
      footer={route && !loading ? (
        <span className="truncate">
          Routing by {PROVIDER[route.provider] ?? route.provider} ·{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-ink-1">© OpenStreetMap</a>
        </span>
      ) : undefined}>

      {/* start, stops, destination */}
      <div className="shrink-0 px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
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
                  trailing={<IconButton size="sm" icon={Trash2} label={`Remove stop ${i + 1}`} onClick={() => removeVia(i)} />}
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
          <IconButton icon={ArrowUpDown} label="Swap start and destination" tooltipSide="left" onClick={swap} />
        </div>

        <div className="mt-2 flex items-center pl-7">
          <Button variant="ghost" size="sm" icon={Plus} className="-ml-2.5" onClick={() => setVias((v) => [...v, { place: null, text: '' }])}>Add stop</Button>
          <span className="ml-auto"><RouteOptions avoid={avoid} toggleAvoid={toggleAvoid} /></span>
        </div>

        <Segmented<Mode> label="Travel mode" className="mt-3" full value={mode as Mode} onChange={pickMode} options={MODES} />
      </div>

      {/* result */}
      <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-line">
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
            guiding={guiding} onEndNavigation={onEndNavigation}
          />
        )}
      </div>
    </Panel>
  );
}
