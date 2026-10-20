'use client';

import { useState } from 'react';
import { ArrowUpRight, Plane } from 'lucide-react';
import { FLIGHT_KIND, isFlightQuery, useFlightSearch } from '@/components/shell/search/use-flight-search';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { SearchField } from '@/components/ui/search-field';
import { useT } from '@/components/ui/use-t';
import type { FlightHit } from '@/lib/feeds/aviation/flight-search';
import { mapHref } from '@/lib/platform/site/map-link';

const FLIGHT_LAYERS = ['flights', 'private', 'jets', 'military'];

const follow = (f: FlightHit) => mapHref({ layers: FLIGHT_LAYERS, view: { lat: f.lat, lon: f.lng, zoom: 8 }, track: `aircraft:${f.icao24}` });

/**
 * Find an aircraft in the air now by flight number, callsign, registration or airline, and open the map
 * following it. `near` puts the closest first when many match, such as an airline's whole fleet.
 */
export function FlightFinder({ near = null, className }: { near?: { lat: number; lng: number } | null; className?: string }) {
  const t = useT();
  const [value, setValue] = useState('');
  const { answer, search } = useFlightSearch(near, 8);
  const typed = value.trim();
  const pending = isFlightQuery(value) && answer.q !== value;
  const hits = answer.q === value ? answer.hits : [];

  return (
    <div className={className}>
      <SearchField value={value} onChange={v => { setValue(v); search(v); }} label={t('Find a flight')}
        placeholder={t('Flight number, callsign, registration or airline')} autoComplete="off" spellCheck={false} />
      <div aria-live="polite">
        {hits.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface-1">
            {hits.map(f => (
              <li key={f.icao24}>
                <a href={follow(f)} className={cx('group flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                  <Plane aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[14px] text-ink-1 tabular-nums">{f.callsign ?? f.registration ?? f.icao24.toUpperCase()}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {[f.airline ?? t(FLIGHT_KIND[f.bucket].label), f.model, f.callsign && f.registration, f.grounded && t('On the ground')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <ArrowUpRight aria-label={t('Follow on the map')} className="size-4 shrink-0 text-ink-3 group-hover:text-ink-1" />
                </a>
              </li>
            ))}
          </ul>
        )}
        {typed.length >= 2 && !pending && hits.length === 0 && (
          <p className="mt-2 text-[13px] text-ink-3">{t('No aircraft in the air match “{query}”', { query: typed })}</p>
        )}
        {typed.length < 2 && (
          <p className="mt-2 text-[13px] text-ink-3">{t('Aircraft in the air now. Try {examples}.', { examples: 'TK1, BAW286, Ryanair' })}</p>
        )}
      </div>
    </div>
  );
}
