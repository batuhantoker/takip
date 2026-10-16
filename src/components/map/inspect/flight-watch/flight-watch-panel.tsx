'use client';

import { useEffect, useState } from 'react';
import { Plane, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { WindowFoldButton } from '@/components/map/windows';
import { ListRow } from '@/components/ui/list-row';
import {
  formatAlt,
  resolveEndpoints,
  type AircraftDetail,
  type FlightTelemetry,
  type ScheduledRoute,
  type WatchedFlight,
} from '@/lib/feeds/aviation/flight-watch';

interface FlightWatchPanelProps {
  watched: WatchedFlight[];
  /** Current telemetry keyed by icao24, from the live feed. */
  telemetry: Record<string, FlightTelemetry>;
  onRemove: (icao24: string) => void;
  onSelect: (flight: WatchedFlight, telem: FlightTelemetry | undefined) => void;
  /** Resolved identity + flown track, so the map can draw each path. */
  onDetail: (icao24: string, detail: AircraftDetail | null) => void;
  selectedId?: string | null;
}

const code = (ap?: { iata?: string; icao: string } | null) => (ap ? ap.iata || ap.icao : null);

function Row({ flight, telem, selected, onRemove, onSelect, onDetail }: {
  flight: WatchedFlight;
  telem?: FlightTelemetry;
  selected: boolean;
  onRemove: (icao24: string) => void;
  onSelect: FlightWatchPanelProps['onSelect'];
  onDetail: (icao24: string, d: AircraftDetail | null) => void;
}) {
  const [detail, setDetail] = useState<AircraftDetail | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const cs = (flight.callsign || '').replace(/\s+/g, '');
    // The trace files know the airframe and its track; the route lookup knows the booked airports.
    Promise.all([
      fetch(`/api/v1/aircraft?icao24=${flight.icao24}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      cs
        ? fetch(`/api/v1/flight-route?callsign=${encodeURIComponent(cs)}&icao24=${flight.icao24}`)
            .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null),
    ]).then(([ac, route]) => {
      if (cancelled) return;
      const base = ac && !ac.error ? (ac as AircraftDetail) : null;
      const merged: AircraftDetail | null = base ? { ...base, ...resolveEndpoints(base, route as ScheduledRoute | null) } : null;
      setDetail(merged);
      onDetail(flight.icao24, merged);
    });
    return () => { cancelled = true; };
  }, [flight.icao24, flight.callsign, onDetail]);

  const from = code(detail?.origin);
  const to = code(detail?.destination);
  const route = from || to ? `${from ?? '—'} → ${to ?? '—'}` : null;
  const model = detail === undefined ? 'Identifying…' : detail?.model || detail?.typeCode || 'Type unknown';

  return (
    <ListRow
      compact
      flush
      selected={selected}
      leading={<Plane className="size-4" strokeWidth={1.75} />}
      title={flight.callsign?.trim() || flight.icao24.toUpperCase()}
      subtitle={telem ? [model, route].filter(Boolean).join(' · ') : 'No longer in the live feed'}
      onClick={() => onSelect(flight, telem)}
      trailing={<>
        <span className="font-mono text-[12px] text-ink-2 tabular-nums">{telem ? formatAlt(telem.alt, telem.grounded) : '—'}</span>
        <IconButton label="Stop watching" icon={X} size="sm" onClick={() => onRemove(flight.icao24)} tooltipSide="left" />
      </>}
    />
  );
}

/** The aircraft being watched, in a window of its own. */
export default function FlightWatchPanel({ watched, telemetry, onRemove, onSelect, onDetail, selectedId }: FlightWatchPanelProps) {
  if (watched.length === 0) return null;
  return (
    <section aria-label="Watched aircraft" className="pointer-events-auto flex flex-col overflow-hidden rounded-float border border-line bg-surface-1 shadow-float">
      <header className="flex h-9 shrink-0 items-center pr-1 pl-4">
        <h3 className="flex-1 text-[11px]/[14px] font-medium text-ink-3">Watching · {watched.length}</h3>
        <WindowFoldButton size="sm" />
      </header>
      <div className="min-h-0 overflow-y-auto px-2 pb-1.5">
        {watched.map((f) => (
          <Row key={f.icao24} flight={f} telem={telemetry[f.icao24]} selected={selectedId === f.icao24}
            onRemove={onRemove} onSelect={onSelect} onDetail={onDetail} />
        ))}
      </div>
    </section>
  );
}
