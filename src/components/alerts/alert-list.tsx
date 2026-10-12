'use client';

import { Radio } from 'lucide-react';
import {
  FEED_REGIONS, type BUILTIN_FEEDS, type AlertItem, type LocateOptions, type Tab, type Unit,
} from '@/lib/live-alerts';
import NewsCard from './news-card';
import QuakeCard from './quake-card';
import StatementCard from './statement-card';
import WarningCard from './warning-card';

interface AlertListProps {
  tab: Tab;
  visibleFeeds: typeof BUILTIN_FEEDS;
  loading: boolean;
  list: AlertItem[];
  grouped: { label: string; units: Unit[] }[];
  filtersActive: boolean;
  maximized: boolean;
  now: number;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  locate: (lat: number, lng: number, options?: LocateOptions) => void;
  onWatchFeed?: (url: string, name: string) => void;
  onRefresh?: () => Promise<unknown> | void;
  refresh: () => Promise<void>;
  clearFilters: () => void;
}

export default function AlertList({
  tab, visibleFeeds, loading, list, grouped, filtersActive, maximized, now, openId, setOpenId,
  locate, onWatchFeed, onRefresh, refresh, clearFilters,
}: AlertListProps) {
  return tab === 'feeds' ? (
    <div className="space-y-3">
      {Object.entries(FEED_REGIONS).map(([region, label]) => {
        const feeds = visibleFeeds.filter(f => f.region === region);
        if (!feeds.length) return null;
        return (
          <section key={region}>
            <h5 className="mb-1 text-[8.5px] font-mono tracking-widest text-[#5C5A54]">{label}</h5>
            <div className="space-y-1">
              {feeds.map(f => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => { locate(f.lat, f.lng); onWatchFeed?.(f.url, f.name); }}
                  className="flex w-full items-center gap-2 rounded-md border border-[#26262A] bg-[#111111]/70 px-2.5 py-1.5 text-left transition-colors hover:bg-[#17171B] hover:border-[#34343A]"
                >
                  <Radio className="h-3 w-3 flex-shrink-0 text-[#FF4081]" />
                  <span className="flex-1 min-w-0 truncate text-[11.5px] text-[#E8E6E0]">{f.name}</span>
                  <span className="flex-shrink-0 text-[9px] font-mono uppercase text-[#8A8880]">{f.city}, {f.country}</span>
                  <span className="flex-shrink-0 rounded bg-white/5 px-1 text-[8px] font-mono uppercase text-[#5C5A54]">{f.category}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {visibleFeeds.length === 0 && <EmptyState text="No feeds match" onClear={clearFilters} />}
    </div>
  ) : loading ? (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-[74px] animate-pulse rounded-lg border border-[#26262A] bg-[#111111]/60" />
      ))}
      <div className="text-center text-[10px] font-mono text-[#5C5A54]">READING CHANNELS…</div>
    </div>
  ) : list.length === 0 ? (
    filtersActive
      ? <EmptyState text="No alerts match these filters" onClear={clearFilters} />
      : <EmptyState text={tab === 'quakes' ? 'No recent earthquakes' : tab === 'warnings' ? 'No warnings in force' : 'No reports — the sources did not answer'} onRetry={onRefresh ? refresh : undefined} />
  ) : (
    <div className="space-y-3">
      {grouped.map(group => (
        <section key={group.label}>
          <h5 className={`sticky top-0 z-10 -mx-1 mb-1.5 px-1 py-1 text-[8.5px] font-mono tracking-widest text-[#5C5A54] backdrop-blur-md ${maximized ? 'bg-[#0a0a09]/90' : 'bg-[#08080c]/80'}`}>
            {group.label} <span className="opacity-60">· {group.units.reduce((n, u) => n + (u.kind === 'statement' ? u.items.length : 1), 0)}</span>
          </h5>
          <div className={maximized ? 'grid gap-2 grid-cols-1 xl:grid-cols-2 items-start' : 'space-y-2'}>
            {group.units.map(unit => {
              if (unit.kind === 'statement') {
                return (
                  <StatementCard
                    key={unit.key}
                    speaker={unit.speaker}
                    items={unit.items}
                    now={now}
                    open={openId === unit.key}
                    wide={maximized && openId === unit.key}
                    onToggle={() => setOpenId(openId === unit.key ? null : unit.key)}
                  />
                );
              }
              const item = unit.item;
              if (item.kind === 'warning') return <WarningCard key={item.id} item={item} now={now} onLocate={locate} />;
              if (item.kind === 'quake') return <QuakeCard key={item.id} item={item} now={now} onLocate={locate} />;
              return (
                <NewsCard
                  key={item.id}
                  item={item}
                  now={now}
                  open={openId === item.id}
                  wide={maximized && openId === item.id}
                  onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                  onLocate={locate}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmptyState({ text, onClear, onRetry }: { text: string; onClear?: () => void; onRetry?: () => void }) {
  return (
    <div className="py-6 text-center">
      <div className="text-[11px] font-mono text-[var(--text-muted)]">{text}</div>
      {onClear && <button onClick={onClear} className="mt-2 text-[10px] font-mono text-[var(--cyan-primary)] hover:underline">CLEAR FILTERS</button>}
      {onRetry && <button onClick={onRetry} className="mt-2 text-[10px] font-mono text-[var(--cyan-primary)] hover:underline">TRY AGAIN</button>}
    </div>
  );
}
