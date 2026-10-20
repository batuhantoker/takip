'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, Route, Search, SearchX, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Kbd } from '@/components/ui/kbd';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { FLIGHT_LAYER_LABEL } from '@/components/map/inspect/live';
import { findReplayAircraft, pickReplay, replayEntity, replayFlightLayer, replayPosition, useReplayOn } from '@/components/map/replay/replay-pick';
import { useT } from '@/components/ui/use-t';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { FlightHit } from '@/lib/feeds/aviation/flight-search';
import type { ReplayEntity } from '@/lib/map/replay/track-sample';
import { forgetRecent, loadRecent, rememberPlace, type RecentPlace } from '@/lib/places/recent-places';
import { noteDeviceLocation } from '@/lib/platform/device-location';
import { countAction } from '@/lib/platform/usage-actions';
import { Key, kindGroup, PlaceRow, type PlaceLike } from './places';
import { groupHits, type Hit } from './search-groups';
import { FLIGHT_KIND, isFlightQuery, useFlightSearch } from './use-flight-search';
import { useGeoSearch, ZOOM_BY_KIND } from './use-geo-search';

interface SearchBarProps {
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  /** Where the map is looking. Results near it rank first, and each shows how far it is. */
  center?: { lat: number; lng: number } | null;
  /** Desktop: whether the results are showing. The field itself always is. */
  open?: boolean;
  onOpen?: () => void;
  /** Close the results: Esc on an empty box, a click elsewhere, or a pick. */
  onClose?: () => void;
  /** Hand a place to Directions as the destination. */
  onDirections?: (place: PlaceLike) => void;
  /** Find aircraft too, and follow the one picked. */
  onTrackFlight?: (flight: FlightHit) => void;
  /** Inside another container (the phone drawer): no frame of its own, always open. */
  embedded?: boolean;
  /** In a bottom corner: the field stays at the bottom and the results open above it. */
  upward?: boolean;
}

const TRY_COORDS = '35.6586, 139.7454';
const TRY = [msg('Eiffel Tower'), '10 Downing Street', TRY_COORDS];

/** An aircraft as a result row: its callsign, then who flies it, what it is and whether it has landed. */
const flightHit = (f: FlightHit, t: Translate): Hit => ({
  label: f.callsign ?? f.registration ?? f.icao24.toUpperCase(),
  context: [f.airline ?? t(FLIGHT_KIND[f.bucket].label), f.model, f.callsign && f.registration, f.grounded && t('On the ground')].filter(Boolean).join(' · '),
  lat: f.lat, lng: f.lng, kind: 'flight', zoom: 8, flight: f,
});

/** A replayed aircraft as a result row, where it is at the replay's time. */
function replayHit(e: ReplayEntity, t: Translate): Hit | null {
  const at = replayPosition(e);
  if (!at) return null;
  return {
    label: e.label, context: [t(FLIGHT_LAYER_LABEL[replayFlightLayer(e.category)]), t('Replay')].join(' · '),
    lat: at.lat, lng: at.lon, kind: 'flight', zoom: 8, replay: e.entity,
  };
}

/**
 * A place, an address, a landmark or a pair of coordinates, and the map flies
 * there; or an aircraft in the air, and the map follows it. Before anything is
 * typed it offers where you are and where you went last; each place can be
 * handed to Directions. Arrows and Enter choose, Shift+Enter routes, Esc clears
 * and then closes.
 */
export default function SearchBar({ onLocate, center = null, open = true, onOpen, onClose, onDirections, onTrackFlight, embedded = false, upward = false }: SearchBarProps) {
  const t = useT();
  const { value, results, loading, answered, search } = useGeoSearch(center);
  const flights = useFlightSearch(center);
  const replayOn = useReplayOn();
  const [replayFound, setReplayFound] = useState<{ q: string; hits: ReplayEntity[] }>({ q: '', hits: [] });
  const findsFlights = !!onTrackFlight || replayOn;
  const [selected, setSelected] = useState(0);
  const [recent, setRecent] = useState<RecentPlace[]>(() => (typeof window === 'undefined' ? [] : loadRecent()));
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const showing = embedded || open;

  // Opened by a key (/ or ⌘K): into the field. Closed: out of it.
  useEffect(() => {
    if (open && !embedded && document.activeElement !== inputRef.current) inputRef.current?.focus();
    if (!open && document.activeElement === inputRef.current) inputRef.current?.blur();
  }, [open, embedded]);
  useEffect(() => { if (embedded) setTimeout(() => inputRef.current?.focus(), 50); }, [embedded]);

  // Ctrl+F / ⌘F while open: back to the box, with what is in it selected.
  useEffect(() => {
    if (!showing) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [showing]);

  // A press anywhere else closes the results.
  useEffect(() => {
    if (!open || !onClose || embedded) return;
    const handler = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open, onClose, embedded]);

  const typing = value.trim().length > 0;
  const you: Hit = { label: t('Your location'), context: locateNote || t('Fly to where you are'), lat: 0, lng: 0, kind: 'current', zoom: 14 };
  const recentHits: Hit[] = recent.map(r => ({ ...r, zoom: ZOOM_BY_KIND[r.kind ?? ''] ?? 13, recent: true }));
  const replayHits = replayOn && replayFound.q === value ? replayFound.hits.map(e => replayHit(e, t)).filter(h => !!h) : [];
  const flightHits = [...replayHits, ...(onTrackFlight && flights.answer.q === value ? flights.answer.hits.map(f => flightHit(f, t)) : [])];
  const flightsPending = !!onTrackFlight && isFlightQuery(value) && flights.answer.q !== value;
  const squashed = value.toUpperCase().replace(/[\s-]/g, '');
  // Flights lead only when one is exactly what was typed; an airline's fleet goes under the places.
  const flightSection = flightHits.length ? [{ title: kindGroup('flight'), items: flightHits }] : [];
  const placeSections = groupHits(results, flightHits.length > 0);
  const sections = typing
    ? (flightHits.some(h => h.flight?.exact || (h.replay != null && h.label.toUpperCase().replace(/\s/g, '') === squashed)) ? [...flightSection, ...placeSections] : [...placeSections, ...flightSection])
    : [{ title: '', items: [you] }, ...(recent.length ? [{ title: 'Recent', items: recentHits }] : [])];
  const items = sections.flatMap(s => s.items);
  const active = Math.min(selected, Math.max(0, items.length - 1));

  const type = (q: string) => {
    search(q);
    if (onTrackFlight) flights.search(q);
    if (replayOn) setReplayFound({ q, hits: findReplayAircraft(q) });
    setSelected(0);
  };

  /** Where you are: the browser's fix when it will give one, else the network's rough idea. */
  const locate = useCallback(async () => {
    setLocating(true);
    setLocateNote('');
    const fix = await new Promise<GeolocationPosition | null>(resolve => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
    });
    if (fix) {
      noteDeviceLocation(fix.coords);
      onLocate(fix.coords.latitude, fix.coords.longitude, 15);
      setLocating(false);
      onClose?.();
      return;
    }
    try {
      const d = await (await fetch('/api/geo')).json();
      if (d?.lat && d?.lon) {
        onLocate(d.lat, d.lon, 11);
        setLocating(false);
        onClose?.();
        return;
      }
    } catch { /* fall through to the note */ }
    setLocateNote(t('Location unavailable: allow it in the browser, or search instead'));
    setLocating(false);
  }, [onLocate, onClose, t]);

  const remember = (h: Hit) => setRecent(rememberPlace({ label: h.label, context: h.context, lat: h.lat, lng: h.lng, kind: h.kind }));

  const go = (h: Hit) => {
    if (h.kind === 'current') { void locate(); return; }
    countAction('search.pick');
    if (h.flight || h.replay != null) {
      if (h.flight) onTrackFlight?.(h.flight);
      else pickReplay(replayEntity(h.replay!), { follow: true });
      type('');
      onClose?.();
      return;
    }
    onLocate(h.lat, h.lng, h.zoom);
    remember(h);
    type('');
    onClose?.();
  };

  const directions = (h: Hit) => {
    if (!onDirections || h.kind === 'current' || h.kind === 'flight') return;
    remember(h);
    onDirections({ label: h.label, context: h.context, lat: h.lat, lng: h.lng, kind: h.kind });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (value) type('');
      else { inputRef.current?.blur(); onClose?.(); }
      return;
    }
    if (!showing) { if (e.key === 'ArrowDown') onOpen?.(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(Math.min(active + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(Math.max(active - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const h = items[active];
      if (!h) return;
      if (e.shiftKey) directions(h); else go(h);
    }
  };

  const noResults = typing && !loading && !flightsPending && answered === value && value.trim().length >= 2 && results.length === 0 && flightHits.length === 0;
  let index = 0;

  return (
    <div ref={boxRef} className={embedded ? 'flex flex-col' : cx('pointer-events-auto flex max-h-[min(72vh,600px)] overflow-hidden rounded-float border border-line bg-surface-1 shadow-float', upward ? 'flex-col-reverse' : 'flex-col')}>
      <div className={cx(
        'relative flex shrink-0 items-center gap-2.5',
        embedded ? 'h-10 rounded-card border border-line-strong bg-surface-2 px-3 focus-within:border-accent' : 'h-[38px] px-3',
      )}>
        <Search aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
        <input
          ref={inputRef}
          value={value}
          onChange={e => { type(e.target.value); onOpen?.(); }}
          onKeyDown={onKeyDown}
          onFocus={() => { setFocused(true); onOpen?.(); }}
          onBlur={() => setFocused(false)}
          placeholder={findsFlights ? t('Search places, flights, coordinates') : t('Search places, addresses, coordinates')}
          aria-label={t('Search places')}
          role="combobox"
          aria-expanded={showing && items.length > 0}
          aria-controls={listId}
          aria-activedescendant={showing && items.length ? `${listId}-${active}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink-1 outline-none placeholder:text-ink-3"
          autoComplete="off"
          spellCheck={false}
        />
        {(loading || flightsPending) && <LoaderCircle aria-label={t('Searching')} className="size-4 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none" strokeWidth={1.75} />}
        {value ? (
          <button type="button" onClick={() => { type(''); inputRef.current?.focus(); }} aria-label={t('Clear the search')}
            className={cx('-mr-1 flex size-6 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-surface-3 hover:text-ink-1', FOCUS_RING)}>
            <X aria-hidden className="size-3.5" strokeWidth={2} />
          </button>
        ) : !embedded && !focused && <Kbd>/</Kbd>}
      </div>

      {showing && (
        <>
          <div className={cx('min-h-0 overflow-y-auto styled-scrollbar', embedded ? 'pt-3' : cx('border-line p-1.5', upward ? 'border-b' : 'border-t'))}>
            <div id={listId} role="listbox" aria-label={typing ? t('Places found') : t('Suggestions')}>
              {sections.map(s => (
                <div key={s.title || 'top'} role="group" aria-label={s.title ? t(s.title) : undefined} className="not-first:mt-2">
                  {s.title && (
                    <div className="flex h-7 items-center justify-between px-2">
                      <span className="text-meta font-medium text-ink-3">{t(s.title)}</span>
                      {!typing && s.title === 'Recent' && (
                        <Button variant="ghost" size="sm" className="-mr-1.5 h-6" onClick={() => { forgetRecent(); setRecent([]); setSelected(0); }}>{t('Clear')}</Button>
                      )}
                    </div>
                  )}
                  {s.items.map(h => {
                    const i = index++;
                    return (
                      <PlaceRow key={`${h.kind}-${h.label}-${h.lat}-${i}`} id={`${listId}-${i}`} place={h} query={typing ? value : ''} on={i === active}
                        onPick={() => go(h)} onHover={() => setSelected(i)} from={center} kindOverride={h.recent ? 'recent' : undefined}
                        trailing={h.kind === 'current'
                          ? (locating ? <LoaderCircle aria-label={t('Finding you')} className="mr-1 size-4 animate-spin text-ink-3" strokeWidth={1.75} /> : undefined)
                          : onDirections && h.kind !== 'flight' && (
                            <span className={cx(embedded || i === active ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100')}>
                              <IconButton label={t('Directions to {place}', { place: h.label })} kbd="⇧↵" icon={Route} size="sm" tooltipSide="left" onClick={() => directions(h)} />
                            </span>
                          )} />
                    );
                  })}
                </div>
              ))}
            </div>

            {!typing && recent.length === 0 && (
              <p className="mt-1 px-2 pb-1 text-small text-ink-3">
                {t('Try')}{' '}
                {TRY.map((example, i) => {
                  const text = example === TRY_COORDS ? example : t(example);
                  return (
                    <span key={example}>
                      {i > 0 && <span aria-hidden className="text-ink-4"> · </span>}
                      <button type="button" onClick={() => { type(text); inputRef.current?.focus(); }}
                        className={cx('rounded-[3px] text-ink-2 underline decoration-ink-4 underline-offset-2 hover:text-ink-1', example === TRY_COORDS && 'font-mono tabular-nums', FOCUS_RING)}>{text}</button>
                    </span>
                  );
                })}
              </p>
            )}

            {noResults && (
              <div role="status">
                {findsFlights
                  ? <EmptyState icon={SearchX} title={t('Nothing matches “{query}”', { query: value.trim() })} body={t('Try a city, a street, a landmark, a flight number such as {flight}, or coordinates such as {example}.', { flight: 'TK1', example: '48.8584, 2.2945' })} className="py-6" />
                  : <EmptyState icon={SearchX} title={t('No places match “{query}”', { query: value.trim() })} body={t('Try a city, a street, a landmark, or coordinates such as {example}.', { example: '48.8584, 2.2945' })} className="py-6" />}
              </div>
            )}

            {typing && loading && results.length === 0 && (
              <div aria-hidden className="flex flex-col">
                {[62, 48, 54].map(w => (
                  <div key={w} className="flex h-10 items-center gap-3 px-2">
                    <span className="size-4 rounded-[4px] bg-surface-2" />
                    <span className="h-2.5 rounded-full bg-surface-2" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cx('flex shrink-0 items-center gap-3 text-meta text-ink-3', embedded ? 'pt-2' : cx('h-8 border-line px-3', upward ? 'border-b' : 'border-t'))}>
            {!embedded && (
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><Key>↑</Key><Key>↓</Key> {t('move')}</span>
                <span className="flex items-center gap-1"><Key>↵</Key> {t('go')}</span>
                {onDirections && <span className="flex items-center gap-1"><Key>⇧</Key><Key>↵</Key> {t('directions')}</span>}
              </span>
            )}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="ml-auto hover:text-ink-1">© OpenStreetMap</a>
          </div>
        </>
      )}
    </div>
  );
}
