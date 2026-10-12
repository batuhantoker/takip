'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { X, LocateFixed, Loader2 } from 'lucide-react';
import type { RecentPlace } from '@/lib/recent-places';
import type { Place } from '@/lib/route-plan';
import { PlaceRow } from '@/components/search/places';

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
    <div className="relative flex-1 min-w-0" ref={box}>
      <div className="flex items-center h-10 rounded-lg border bg-black/45 transition-[border-color,box-shadow] border-white/[0.07] hover:border-white/[0.13] focus-within:!border-[rgba(var(--gold-rgb),0.5)] focus-within:shadow-[0_0_0_3px_rgba(var(--gold-rgb),0.08)]">
        <input
          value={value}
          autoFocus={autoFocus}
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
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 min-w-0 h-full bg-transparent pl-3 pr-1 text-[13px] text-[var(--text-heading)] outline-none placeholder:text-[var(--text-muted)]"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <Loader2 className="w-3.5 h-3.5 mx-1 flex-shrink-0 animate-spin text-[var(--gold-primary)]" />}
        {value && onClear && (
          <button type="button" onClick={() => { onClear(); setResults([]); }} aria-label={`Clear ${placeholder.toLowerCase()}`}
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-white/[0.06] transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {onLocate && (
          <button type="button" onClick={onLocate} disabled={locating} title="Use my location" aria-label="Use my location"
            className="w-8 h-8 mr-0.5 rounded-md flex items-center justify-center flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--gold-light)] hover:bg-[rgba(var(--gold-rgb),0.08)] transition-colors disabled:opacity-60">
            <LocateFixed className={`w-4 h-4 ${locating ? 'animate-pulse text-[var(--gold-light)]' : ''}`} />
          </button>
        )}
        {trailing}
      </div>

      {open && options.length > 0 && (
        <div role="listbox" aria-label={empty ? 'Suggestions' : 'Places found'}
          className="absolute top-full -left-[26px] -right-[42px] mt-1.5 z-[10000] rounded-xl border border-[var(--border-primary)] p-1.5 max-h-[280px] overflow-y-auto styled-scrollbar"
          style={{ background: 'var(--oi-solid)', boxShadow: '0 18px 44px rgba(0,0,0,0.75)' }}>
          {empty && recent.length > 0 && <span className="block px-3 pt-1 pb-1 text-[9.5px] font-mono tracking-[0.14em] uppercase text-[var(--text-muted)]">Recent</span>}
          {options.map((r, i) => (
            <PlaceRow key={`${r.kind}-${r.label}-${r.lat}-${i}`} place={r} query={empty ? '' : value} on={i === at}
              onPick={() => choose(r)} onHover={() => setIdx(i)} from={center} kindOverride={r.recent ? 'recent' : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
