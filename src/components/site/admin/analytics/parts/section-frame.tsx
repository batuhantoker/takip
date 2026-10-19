import type { ReactNode } from 'react';
import { ErrorText, Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsQuery } from '../lib/use-analytics-data';
import { longDay } from '../lib/format';

/** One endpoint's slice of the page: its own error, its own loading line, dimmed while a new range loads. */
export function SectionFrame<T>({ query, children }: { query: AnalyticsQuery<T>; children: (data: T) => ReactNode }) {
  if (!query.data) return query.error ? <ErrorText message={query.error} /> : <Muted>Loading…</Muted>;
  return (
    <div className={`flex flex-col gap-4 transition-opacity duration-150 ${query.stale ? 'opacity-60' : ''}`} aria-busy={query.stale}>
      {query.error && <ErrorText message={query.error} />}
      {children(query.data)}
    </div>
  );
}

/** Map minutes only exist from the day the tick started recording them; `first` is the range's first day. */
export function CollectingNote({ since, first }: { since: string | null; first?: string }) {
  if (!since) return <p className="text-[12px] text-ink-3">No map minutes recorded yet. They are counted once a minute while someone has the map open.</p>;
  if (!first || since > first) return <p className="text-[12px] text-ink-3">Collecting since {longDay(since)}; earlier days have no minutes.</p>;
  return null;
}

export const SectionHeading = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-2 text-[13px] font-semibold text-ink-1">{children}</h2>
);

export const Tiles = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;

export const Pair = ({ children }: { children: ReactNode }) => <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
