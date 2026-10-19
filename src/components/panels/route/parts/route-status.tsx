'use client';

import { CircleAlert, LocateFixed } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { RecentPlace } from '@/lib/places/recent-places';
import type { Place } from '@/lib/places/route/plan';
import { distanceText, kindIcon } from '@/components/shell/search/places';

/** One of each kind of thing the fields take; picking one fills the destination, or the start once that is set. */
const EXAMPLES: Place[] = [
  { label: 'Heathrow', context: 'London', lat: 51.47, lng: -0.4543, kind: 'poi' },
  { label: '10 Downing St', context: 'London', lat: 51.5034, lng: -0.1276, kind: 'address' },
  { label: '51.507, -0.128', context: msg('Coordinates'), lat: 51.507, lng: -0.128, kind: 'coordinate' },
];

export function RouteLoading() {
  const t = useT();
  const bar = 'rounded-[4px] bg-surface-2 animate-pulse motion-reduce:animate-none';
  return (
    <div className="flex flex-col gap-3 p-4" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t('Finding a route…')}</span>
      <div className={`h-7 w-28 ${bar}`} />
      <div className={`h-3 w-44 ${bar}`} />
      <div className={`mt-1 h-8 ${bar}`} />
      <div className="mt-2 flex flex-col gap-3">
        {[70, 58, 46, 34].map(w => (
          <div key={w} className="flex items-center gap-3">
            <span className={`size-4 ${bar}`} />
            <span className={`h-2.5 ${bar}`} style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RouteError({ error }: { error: string }) {
  const t = useT();
  return <EmptyState icon={CircleAlert} title={error} body={t('Try a point nearer a road, or another way of travelling.')} />;
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
  const t = useT();
  if (ready) return <p className="p-4 text-small text-ink-3">{t('Finding a route…')}</p>;
  return (
    <div className="p-4">
      {!from && (
        <ListRow
          leading={<LocateFixed aria-hidden className="size-4 text-accent" strokeWidth={1.75} />}
          title={locating ? t('Finding you…') : t('Start from my location')}
          subtitle={<span className="text-ink-3">{to ? t('Then the route to {place}', { place: to.label }) : t('Then choose where to go')}</span>}
          disabled={locating}
          onClick={useMyLocation}
        />
      )}
      {locateError && <p className="mt-1 text-meta text-amber">{locateError}</p>}
      {recent.length > 0 && (
        <PanelSection title={t('Recent places')} className="mt-5">
          {recent.slice(0, 4).map((r, i) => {
            const Icon = kindIcon(r.kind);
            return (
              <ListRow key={`${r.label}-${r.lat}-${i}`} onClick={() => pickRecent(r)} title={r.label}
                leading={<Icon aria-hidden className="size-4" strokeWidth={1.75} />}
                subtitle={r.context ? <span className="text-ink-3">{r.context}</span> : undefined}
                meta={center ? <span className="font-mono tabular-nums">{distanceText(center, r, t.intl)}</span> : undefined} />
            );
          })}
        </PanelSection>
      )}
      <div className="mt-5">
        <p className="text-meta text-ink-3">{t('Try a place, an address or coordinates')}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map(p => (
            <button key={p.label} type="button" onClick={() => pickRecent({ ...p, context: p.context && t(p.context) })}
              className={cx('inline-flex h-6 items-center rounded-control border border-line-strong px-2 text-small text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
              <span className={p.kind === 'coordinate' ? 'font-mono tabular-nums' : undefined}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
