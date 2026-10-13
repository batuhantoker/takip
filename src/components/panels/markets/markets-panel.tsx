'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { CloudOff, Maximize2, Star } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { useEscape } from '@/components/ui/use-escape';
import { longName } from '@/lib/markets/markets';
import AiOverview from '@/components/panels/alerts/ai-overview';
import DonBotScan from './donbot-scan';
import CommandLine from '@/components/panels/markets/parts/command-line';
import FunctionKeys from '@/components/panels/markets/parts/function-keys';
import { BreadthCard, MarketHeatmap, Movers, PulseMonitor } from '@/components/panels/markets/parts/market-board';
import MarketsFull from '@/components/panels/markets/parts/markets-full';
import MarketsHelp from '@/components/panels/markets/parts/markets-help';
import { ExchangeClocks, MarketsFooter, SupplyAlerts, TradingStatus } from '@/components/panels/markets/parts/markets-parts';
import { sectionTitle } from './markets-format';
import SecurityTable from '@/components/panels/markets/parts/security-table';
import { useMarkets } from './use-markets';
import { useNow } from './use-now';

/**
 * Markets: find a security or a section, the benchmarks everyone checks first,
 * one table per section, and a chart for whatever is picked. Full screen widens
 * the table to more columns and adds the day's heatmap and biggest moves.
 * Nothing here costs a request of its own: every column comes from the one
 * quote per instrument the feed already fetches.
 */

// Canvas charting has no business in the server bundle, and it only mounts once a security is loaded.
const MarketChart = dynamic(() => import('@/components/panels/markets/parts/market-chart'), { ssr: false });

interface MarketsPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the page's live data is untyped
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
  spaceWeather?: any;
  /** Docked in the sidebar with its own frame; without it, just the body, for the phone's drawer. */
  onClose?: () => void;
}

export default function MarketsPanel({ data, spaceWeather, onClose }: MarketsPanelProps) {
  const [maximized, setMaximized] = useState(false);

  const now = useNow(30_000);
  const markets = useMemo(() => data.markets || {}, [data.markets]);
  const m = useMarkets(markets, maximized);
  const { fn, setFn, current, chartSymbol, chartQuote, breadth, allQuotes } = m;

  // Full screen covers the map, so Escape gets out of it, unloading the chart first: the nearer thing to dismiss.
  useEscape(() => (m.selected ? m.setSelected(null) : setMaximized(false)), maximized);

  const updatedAgo = markets.timestamp ? ago(Date.parse(markets.timestamp), now) : null;
  const subtitle = allQuotes.length
    ? `${allQuotes.length} instruments${updatedAgo ? ` · updated ${updatedAgo}` : ''}`
    : m.feedLoaded ? 'Prices are unavailable right now' : 'Loading prices…';

  const find = (
    <CommandLine command={m.command} setCommand={m.setCommand} pick={m.pick} setPick={m.setPick}
      miss={m.miss} setMiss={m.setMiss} suggestions={m.suggestions} run={m.run} />
  );
  const monitor = allQuotes.length > 0 && <PulseMonitor bySymbol={m.bySymbol} chartSymbol={chartSymbol} open={m.open} maximized={maximized} />;
  const breadthCard = breadth && <BreadthCard breadth={breadth} open={m.open} />;
  const alerts = Array.isArray(markets.scm_alerts) && markets.scm_alerts.length > 0 && <SupplyAlerts alerts={markets.scm_alerts} />;
  const chart = chartSymbol && chartQuote && (
    <MarketChart key={chartSymbol} symbol={chartSymbol} name={longName(chartQuote)} large={maximized} onClose={() => m.setSelected(null)} />
  );
  const status = m.rowCount > 0 && current?.section !== 'crypto' && <TradingStatus open={m.openCount} total={m.rowCount} />;

  const body = fn === 'HELP' ? <MarketsHelp />
    : current?.section === 'donbot' ? <DonBotScan />
    : m.rowCount > 0 ? (
      <SecurityTable groups={m.groups} selected={chartSymbol} watchlist={m.watchlist} sort={m.sort} onSort={m.onSort} onOpen={m.open} onStar={m.star} now={now} />
    ) : current?.section === 'watch' ? (
      <EmptyState icon={Star} title="Nothing on your watchlist yet" body="Star a row in any section and it stays here, in this browser." />
    ) : m.feedLoaded ? (
      <EmptyState icon={CloudOff} title="Prices are unavailable" body="The feed did not answer. It tries again on its own." />
    ) : <p className="py-6 text-center text-small text-ink-3">Loading prices…</p>;

  const title = current ? sectionTitle(current.code) : 'How to search';
  const content = (
    <section aria-label={title}>
      <div className="mb-2 flex min-h-7 items-center gap-3">
        {maximized ? <h3 className="min-w-0 flex-1 truncate text-body font-medium text-ink-1">{title}</h3>
          : <FunctionKeys fn={fn} setFn={setFn} maximized={false} />}
        {status}
      </div>
      {body}
    </section>
  );
  const ai = <AiOverview mode="markets" payload={{ markets, spaceWeather }} />;

  // Only a click can set this, so the portal never renders on the server.
  if (maximized) {
    return (
      <MarketsFull
        subtitle={subtitle}
        clocks={<ExchangeClocks now={now} />}
        find={find}
        sections={<FunctionKeys fn={fn} setFn={setFn} maximized />}
        monitor={monitor}
        table={<>{content}{allQuotes.length > 0 && <MarketHeatmap allQuotes={allQuotes} chartSymbol={chartSymbol} open={m.open} setFn={setFn} />}</>}
        side={<>{chart}{breadthCard}{alerts}{breadth && <Movers breadth={breadth} open={m.open} />}{ai}</>}
        footer={<MarketsFooter spaceWeather={spaceWeather} full />}
        onExit={() => setMaximized(false)}
      />
    );
  }

  const stack = (
    <div className="flex flex-col gap-5">
      {find}
      {monitor}
      {breadthCard}
      {alerts}
      {chart}
      {content}
      {ai}
    </div>
  );

  // In the phone's drawer, which brings its own frame.
  if (!onClose) return <div className="text-ink-2">{stack}</div>;

  return (
    <Panel title="Markets" subtitle={subtitle} onClose={onClose} footer={<MarketsFooter spaceWeather={spaceWeather} />}
      actions={<IconButton icon={Maximize2} label="Full screen" onClick={() => setMaximized(true)} />}>
      {stack}
    </Panel>
  );
}

function ago(at: number, now: number): string {
  const min = Math.round((now - at) / 60_000);
  if (!Number.isFinite(min) || min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}
