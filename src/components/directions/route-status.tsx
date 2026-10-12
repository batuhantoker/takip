'use client';

import { AlertTriangle, Loader2, LocateFixed } from 'lucide-react';
import type { RecentPlace } from '@/lib/recent-places';
import type { Place } from '@/lib/route-plan';
import { PlaceRow } from '@/components/search/places';

export function RouteLoading() {
  return (
    <div className="p-4 space-y-2.5 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-7 w-28 rounded bg-white/[0.07]" />
      <div className="h-3 w-48 rounded bg-white/[0.05]" />
      <div className="h-10 rounded-lg bg-white/[0.04]" />
      <div className="pt-1 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-white/[0.06]" />
            <span className="h-2.5 rounded bg-white/[0.05]" style={{ width: `${70 - i * 12}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RouteError({ error }: { error: string }) {
  return (
    <div className="px-5 py-6 flex flex-col items-center text-center">
      <span className="w-10 h-10 rounded-full flex items-center justify-center border border-[rgba(255,61,61,0.3)] bg-[rgba(255,61,61,0.06)]">
        <AlertTriangle className="w-4.5 h-4.5 text-[var(--alert-red)]" />
      </span>
      <p className="mt-2.5 text-[13px] text-[var(--text-heading)]">{error}</p>
      <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">Try a different point, or another way of travelling.</p>
    </div>
  );
}

export function RouteStart({ ready, from, to, useMyLocation, locating, locateError, recent, pickRecent, center }: {
  ready: boolean;
  from: Place | null;
  to: Place | null;
  useMyLocation: () => void;
  locating: boolean;
  locateError: string | null;
  recent: RecentPlace[];
  pickRecent: (p: Place) => void;
  center: { lat: number; lng: number } | null;
}) {
  return (
    <div className="p-3 flex flex-col gap-3">
      {ready ? (
        <p className="px-1 text-[12px] text-[var(--text-muted)]">Calculating…</p>
      ) : (
        <>
          {!from && (
            <button onClick={useMyLocation} disabled={locating}
              className="group flex items-center gap-3 w-full rounded-lg border border-[var(--border-secondary)] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-[var(--border-active)] hover:bg-[rgba(var(--gold-rgb),0.05)] disabled:opacity-70">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--gold-rgb),0.12)' }}>
                {locating ? <Loader2 className="w-4 h-4 animate-spin text-[var(--gold-light)]" /> : <LocateFixed className="w-4 h-4 text-[var(--gold-light)]" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-[var(--text-heading)]">Start from my location</span>
                <span className="block text-[11px] text-[var(--text-muted)]">{to ? `Then the route to ${to.label}` : 'Then choose where to go'}</span>
              </span>
            </button>
          )}
          {locateError && <p className="px-1 text-[11px] text-[var(--gold-light)]">{locateError}</p>}
          {recent.length > 0 && (
            <div>
              <span className="block px-1 pb-1 text-[9.5px] font-mono tracking-[0.14em] uppercase text-[var(--text-muted)]">Recent places</span>
              <div className="flex flex-col gap-0.5">
                {recent.slice(0, 4).map((r, i) => (
                  <PlaceRow key={`${r.label}-${r.lat}-${i}`} place={r} on={false} onPick={() => pickRecent(r)} from={center} kindOverride="recent" />
                ))}
              </div>
            </div>
          )}
          <div className="px-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[9.5px] font-mono tracking-[0.14em] uppercase text-[var(--text-muted)] mr-0.5">Try</span>
            <span className="instrument-sample">Heathrow</span>
            <span className="instrument-sample">10 Downing St</span>
            <span className="instrument-sample">51.5074, -0.1278</span>
          </div>
        </>
      )}
    </div>
  );
}
