'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ChartLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, ENTER } from '@/components/ui/class-names';
import { Panel } from '@/components/ui/panel';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useT } from '@/components/ui/use-t';
import { FloatingWindow, WindowFoldButton } from '@/components/map/windows';
import { MAX_CHARTED } from '@/lib/history/countries/chart';
import type { CountryView } from '@/lib/history/countries/view';
import { nameOf } from '@/lib/history/countries/indicator-groups';
import { formatAt, formatYear, msAt, yearAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { clampRange, extentOf, type Range } from './lib/chart-geometry';
import { CountryKeys } from './parts/country-keys';
import { IndicatorPlot } from './parts/indicator-plot';

/** Changes when a pick is added, dropped, loads or swaps onto the map; not when the pointer moves. */
const picksSignature = (view: CountryView) => {
  const s = view.state();
  return `${s.status === 'off' ? '' : s.code}|${view.picks().map(p => `${p.code}:${p.status}`).join(',')}`;
};

/** The narrowest view: a few years, or eight weeks when any chart is weekly. */
const MIN_YEARS = 3;
const MIN_WEEKS = 8 / 52;

/**
 * The countries clicked on the History map, charted over time: one chart per picked indicator, each folding
 * under its name, all following the History clock every frame, reading the same year under the pointer and
 * zoomed to the same years. Open while any country is charted and countries are coloured; closing it drops
 * the countries.
 */
export function CountryChartWindow({ session }: { session: HistorySession }) {
  const t = useT();
  const { clock, countries: view, chart } = session;
  const time = useSyncExternalStore(clock.subscribe, clock.time, clock.time);
  const signature = useSyncExternalStore(view.subscribe, () => picksSignature(view), () => picksSignature(view));
  const charted = useSyncExternalStore(chart.subscribe, chart.countries, chart.countries);
  const picks = useMemo(() => (signature ? view.picks() : []), [signature, view]);
  const [hover, setHover] = useState<number | null>(null);
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const [range, setRange] = useState<Range | null>(null);
  // Every chart's years together: zooming and panning stay inside them.
  const { full, minSpan } = useMemo(() => {
    const extents = picks.flatMap(p => (p.status === 'ready' ? [extentOf(charted.map(c => p.data.values[c.key] ?? []), p.data.step)] : []))
      .filter((e): e is Range => e !== null);
    const weekly = picks.some(p => p.status === 'ready' && p.data.step === 'day');
    return {
      full: extents.length ? [Math.min(...extents.map(e => e[0])), Math.max(...extents.map(e => e[1]))] as Range : null,
      minSpan: weekly ? MIN_WEEKS : MIN_YEARS,
    };
  }, [picks, charted]);
  const zoomTo = useCallback((r: Range | null) => setRange(r && full ? clampRange(r, full, minSpan) : null), [full, minSpan]);
  const isMobile = useIsMobile();
  const state = view.state();
  if (!charted.length || state.status === 'off' || !picks.length) return null;

  const close = () => chart.clear();
  const at = yearAt(time);
  const shownAt = hover ?? at;
  const many = picks.length > 1;
  const dated = picks.every(p => p.status === 'ready' && p.data.step === 'day');
  const fold = (code: string, open: boolean) => setFolded(prev => {
    const next = new Set(prev);
    if (open) next.delete(code);
    else next.add(code);
    return next;
  });

  const single = !many && state.status === 'ready' ? state.data : null;
  const subtitle = many ? t('{n, plural, one {# indicator} other {# indicators}}', { n: picks.length }) : single ? [single.metric.unit, single.source.name].filter(Boolean).join(' · ') : undefined;
  const atCap = charted.length >= MAX_CHARTED;
  const when = <span className="font-mono text-ink-2 tabular-nums">{dated ? formatAt(shownAt, 'day', t) : formatYear(Math.floor(shownAt), t)}</span>;
  const panel = (
    <Panel docked={false} title={many ? t('Over time') : nameOf(state, true, t)} subtitle={subtitle} icon={ChartLine} onClose={close}
      className={isMobile ? 'max-h-[inherit]' : undefined} closeOnEscape={isMobile}
      actions={isMobile ? undefined : <WindowFoldButton />}
      footer={<span>{atCap ? t("That's {n}, the most at once. Remove one to add another.", { n: MAX_CHARTED }) : t('Click a country on the map to add it, and again to remove it. Drag across a chart to zoom in.')}</span>}>
      <div className="mb-2 flex min-h-7 items-center gap-2">
        <p className="min-w-0 flex-1 text-meta text-ink-3">
          {dated
            ? (hover === null ? t.rich('Values on {time}, where the clock is', { time: when }) : t.rich('Values on {time}', { time: when }))
            : (hover === null ? t.rich('Values in {time}, where the clock is', { time: when }) : t.rich('Values in {time}', { time: when }))}
        </p>
        {range && <Button variant="ghost" size="sm" onClick={() => setRange(null)}>{t('Show all years')}</Button>}
      </div>
      <CountryKeys countries={charted} onRemove={key => chart.remove(key)} />
      <div className="mt-3">
        {picks.map(p => (
          <IndicatorPlot key={p.code} pick={p} onMap={p.code === state.code} heading={many} open={!folded.has(p.code)} onOpenChange={o => fold(p.code, o)}
            countries={charted} at={at} hover={hover} range={range} height={many ? 150 : 196}
            onHover={setHover} onSeek={y => clock.seek(msAt(y))} onRange={zoomTo} onColour={() => view.select(p.code)} />
        ))}
      </div>
    </Panel>
  );
  if (!isMobile) return <FloatingWindow id="country-chart" kind="chart" label={t('Country chart')} onClose={close}>{panel}</FloatingWindow>;
  return <div className={cx('absolute top-16 right-2 left-2 z-[300]', ENTER)} style={{ maxHeight: 'min(70vh, 640px)' }}>{panel}</div>;
}
