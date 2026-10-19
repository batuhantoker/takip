'use client';

import type { KeyboardEvent } from 'react';
import { Activity, CloudSun, Newspaper, SearchX, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { AlertItem, LocateOptions } from '@/lib/intel/alerts/live-alerts';
import NewsRow, { newsTarget } from '@/components/panels/alerts/rows/news-row';
import QuakeRow from '@/components/panels/alerts/rows/quake-row';
import StatementRow from '@/components/panels/alerts/rows/statement-row';
import type { AlertEntry, AlertGroup, AlertTab } from '@/components/panels/alerts/hooks/use-alert-list';
import WarningRow from '@/components/panels/alerts/rows/warning-row';
import { countAction } from '@/lib/platform/usage-actions';

type Locate = (lat: number, lng: number, options?: LocateOptions) => void;

/** Where a click on an alert should take the map, if anywhere. */
function targetOf(item: AlertItem): [number, number, LocateOptions?] | null {
  if (item.kind === 'news') return newsTarget(item);
  if (item.kind === 'warning') return [item.lat, item.lng, { zoom: 6 }];
  return [item.lat, item.lng];
}

/** Up and down move between alerts, as in a mail list; Tab still walks every control. */
function moveFocus(e: KeyboardEvent<HTMLElement>) {
  const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
  if (!step || !(e.target as HTMLElement).matches('[data-alert-row]')) return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-alert-row]')];
  const next = rows[rows.indexOf(e.target as HTMLElement) + step];
  if (!next) return;
  e.preventDefault();
  next.focus();
}

const EMPTY: Record<AlertTab, { icon: typeof Radio; title: string; body: string }> = {
  all: { icon: Radio, title: msg('Nothing has come in yet'), body: msg('The sources did not answer. Try again in a minute.') },
  news: { icon: Newspaper, title: msg('No reports right now'), body: msg('The channels did not answer. Try again in a minute.') },
  warnings: { icon: CloudSun, title: msg('No warnings in force'), body: msg('Official weather and disaster warnings show up here when issued.') },
  quakes: { icon: Activity, title: msg('No recent earthquakes'), body: msg('Earthquakes from USGS show up here within minutes.') },
};

export default function AlertList({ tab, groups, loading, filtersActive, now, openKey, setOpenKey, onLocate, onRetry, onClearFilters }: {
  tab: AlertTab;
  groups: AlertGroup[];
  loading: boolean;
  filtersActive: boolean;
  now: number;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  onLocate: Locate;
  onRetry?: () => void;
  onClearFilters: () => void;
}) {
  const t = useT();
  // An open alert closes before the panel does.
  useEscape(() => setOpenKey(null), openKey !== null);

  if (loading) {
    return (
      <div aria-busy="true" aria-label={t('Reading the sources')} className="flex flex-col gap-4 pt-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-3">
            <span className="mt-1.5 size-1.5 rounded-full bg-surface-3" />
            <div className="flex flex-1 flex-col gap-2">
              <span className="h-3 w-11/12 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
              <span className="h-3 w-2/5 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!groups.length) {
    if (filtersActive) {
      return (
        <EmptyState icon={SearchX} title={t('Nothing matches')} body={t('Try other words, or clear the filters to see everything.')}
          action={<Button size="sm" onClick={onClearFilters}>{t('Clear filters')}</Button>} />
      );
    }
    const e = EMPTY[tab];
    return (
      <EmptyState icon={e.icon} title={t(e.title)} body={t(e.body)}
        action={onRetry && (tab === 'all' || tab === 'news') ? <Button size="sm" onClick={onRetry}>{t('Try again')}</Button> : undefined} />
    );
  }

  const select = (entry: AlertEntry) => {
    if (openKey === entry.key) { setOpenKey(null); return; }
    countAction('alert.open');
    setOpenKey(entry.key);
    const target = entry.kind === 'item' ? targetOf(entry.item) : null;
    if (target) onLocate(...target);
  };

  return (
    <div className="flex flex-col gap-5" onKeyDown={moveFocus}>
      {groups.map(group => (
        <section key={group.label} aria-label={t(group.label)}>
          <h3 className="sticky top-0 z-[3] -mx-4 mb-1 h-8 truncate bg-surface-1 px-4 text-meta leading-8 font-medium text-ink-3">
            {t(group.label)}<span className="font-normal"> · {group.count.toLocaleString(t.intl)}</span>
          </h3>
          <ul className="flex flex-col gap-px">
            {group.entries.map(entry => {
              const open = openKey === entry.key;
              const onSelect = () => select(entry);
              if (entry.kind === 'statement') {
                return <StatementRow key={entry.key} speaker={entry.speaker} items={entry.items} now={now} selected={open} onSelect={onSelect} />;
              }
              const { item, similar } = entry;
              if (item.kind === 'warning') return <WarningRow key={entry.key} item={item} similar={similar} now={now} selected={open} onSelect={onSelect} onLocate={onLocate} />;
              if (item.kind === 'quake') return <QuakeRow key={entry.key} item={item} now={now} selected={open} onSelect={onSelect} onLocate={onLocate} />;
              return <NewsRow key={entry.key} item={item} similar={similar} now={now} selected={open} onSelect={onSelect} onLocate={onLocate} />;
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
