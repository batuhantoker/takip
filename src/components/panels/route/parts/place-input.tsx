'use client';

import { useState, useRef, useEffect, useCallback, useId, type ReactNode } from 'react';
import { LoaderCircle, LocateFixed, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { fieldBox, fieldInput } from '@/components/ui/field-shell';
import { ListRow } from '@/components/ui/list-row';
import type { RecentPlace } from '@/lib/places/recent-places';
import type { Place } from '@/lib/places/route/plan';
import { distanceText, kindIcon } from '@/components/shell/search/places';

interface GeoHit {
  name: string;
  context: string;
  lat: number;
  lng: number;
  kind: string;
}

/** Start, stop or destination: type a place, an address or coordinates, or pick a recent one. */
export default function PlaceInput({
  value, onChange, onPick, onClear, placeholder, autoFocus, biasLat, biasLng, onLocate, locating, liveFix, recent, trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Place) => void;
  /** Empty the field and forget its place. */
  onClear?: () => void;
  placeholder: string;
  autoFocus?: boolean;
  biasLat?: number;
  biasLng?: number;
  /** Present only on the start field: fills it with the operator's position. */
  onLocate?: () => void;
  locating?: boolean;
  /** When a live fix exists, every field offers it first. */
  liveFix?: { lat: number; lng: number } | null;
  /** Offered while the field is empty. */
  recent: RecentPlace[];
  trailing?: ReactNode;
}) {
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const focusOnMount = useRef(autoFocus);

  // Not the autoFocus attribute: on a phone it would throw the keyboard up the moment Route opens.
  useEffect(() => {
    const phone = window.innerWidth < 768 || (window.innerHeight < 500 && window.innerWidth < 1024);
    if (focusOnMount.current && !phone) input.current?.focus();
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const search = useCallback((q: string) => {
    onChange(q);
    setIdx(0);
    if (timer.current) clearTimeout(timer.current);

    const coord = q.trim().match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/);
    if (coord) {
      const lat = parseFloat(coord[1]);
      const lng = parseFloat(coord[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setResults([{ label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, kind: 'coordinate', context: 'Coordinates' }]);
        setOpen(true);
        return;
      }
    }

    if (q.trim().length < 2) { abort.current?.abort(); setResults([]); setLoading(false); setOpen(true); return; }

    timer.current = setTimeout(async () => {
      // Abandon any in-flight lookup so a slow earlier keystroke can never
      // overwrite the results for what the user has actually typed.
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;

      setLoading(true);
      try {
        const bias = biasLat !== undefined && biasLng !== undefined
          ? `&lat=${biasLat}&lng=${biasLng}` : '';
        const res = await fetch(
          `/api/v1/geo/search?q=${encodeURIComponent(q)}${bias}`,
          { signal: ctrl.signal },
        );
        const data: { results?: GeoHit[] } = await res.json();
        if (ctrl.signal.aborted) return;
        setResults((data.results || []).map((r) => ({
          label: r.name, context: r.context, lat: r.lat, lng: r.lng, kind: r.kind,
        })));
        setOpen(true);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      }
      if (!ctrl.signal.aborted) setLoading(false);
    }, 280);
  }, [onChange, biasLat, biasLng]);

  const choose = (p: Place) => {
    onChange(p.label);
    onPick(p);
    setOpen(false);
    setResults([]);
  };

  // What the list offers: where you are (when tracked), then what was typed for, or recent places while the field is empty.
  const empty = value.trim().length < 2;
  const you: Place[] = liveFix ? [{ label: 'Your location', lat: liveFix.lat, lng: liveFix.lng, kind: 'current', context: 'Live position' }] : [];
  const options: Array<Place & { recent?: boolean }> = [...you, ...(empty ? recent.map(r => ({ ...r, recent: true })) : results)];
  const at = Math.min(idx, Math.max(0, options.length - 1));
  const center = biasLat !== undefined && biasLng !== undefined ? { lat: biasLat, lng: biasLng } : null;

  return (
    <div className="relative min-w-0 flex-1" ref={box}>
      <div className={cx(fieldBox('md'), 'pr-1')}>
        <input
          ref={input}
          value={value}
          onChange={(e) => search(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIdx((i) => Math.min(i + 1, options.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter') {
              e.preventDefault();
              const pick = options[at];
              if (pick) choose(pick);
            }
            if (e.key === 'Escape' && open && options.length) { e.preventDefault(); setOpen(false); }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-controls={listId}
          aria-expanded={open && options.length > 0}
          aria-autocomplete="list"
          className={fieldInput}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <LoaderCircle aria-hidden className="size-3.5 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none" strokeWidth={1.75} />}
        {value && onClear && <IconButton size="sm" icon={X} label={`Clear ${placeholder.toLowerCase()}`} onClick={() => { onClear(); setResults([]); }} />}
        {onLocate && <IconButton size="sm" icon={LocateFixed} label="Use my location" disabled={locating} onClick={onLocate} />}
        {trailing}
      </div>

      {open && options.length > 0 && (
        <div id={listId} role="listbox" aria-label={empty ? 'Suggestions' : 'Places found'}
          className="styled-scrollbar absolute top-full right-0 left-0 z-[10000] mt-1 max-h-[300px] overflow-y-auto rounded-float border border-line bg-surface-1 p-1 shadow-float">
          {empty && recent.length > 0 && <p className="px-2 pt-1.5 pb-1 text-meta font-medium text-ink-3">Recent</p>}
          {options.map((r, i) => {
            const Icon = kindIcon(r.recent ? 'recent' : r.kind);
            return (
              <div key={`${r.kind}-${r.label}-${r.lat}-${i}`} role="option" aria-selected={i === at} onMouseEnter={() => setIdx(i)}>
                <ListRow flush selected={i === at} onClick={() => choose(r)}
                  leading={<Icon aria-hidden className="size-4" strokeWidth={1.75} />}
                  title={r.label}
                  subtitle={r.context ? <span className="text-ink-3">{r.context}</span> : undefined}
                  meta={center ? <span className="font-mono tabular-nums">{distanceText(center, r)}</span> : undefined} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
