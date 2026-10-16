'use client';

import { TriangleAlert } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { Dot } from '@/components/ui/tag';
import { exchangeClocks } from '@/lib/intel/markets/markets';

const mono = 'font-mono tabular-nums';

/** Local time at the big exchanges, each with whether its regular session is open. */
export function ExchangeClocks({ now }: { now: number }) {
  return (
    <div className="hidden items-center gap-3 text-meta xl:flex" title="Regular sessions, local time. Holidays and early closes are not shown.">
      {exchangeClocks(new Date(now)).map(c => (
        <span key={c.code} className="flex items-center gap-1.5">
          <Dot tone={c.open ? 'green' : 'muted'} label={c.open ? `${c.code} open` : `${c.code} closed`} />
          <span className="text-ink-3">{c.code}</span>
          <span className={cx(mono, 'text-ink-2')}>{c.time}</span>
        </span>
      ))}
    </div>
  );
}

/** "5 of 10 trading", or that every session in the section is shut. */
export function TradingStatus({ open, total }: { open: number; total: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-meta text-ink-3">
      {open ? <><Dot tone="green" /><span className="tabular-nums">{open} of {total} trading</span></> : <span className="tabular-nums">All {total} closed</span>}
    </span>
  );
}

const PLACES: Record<string, string> = { HORMUZ: 'Strait of Hormuz', SUEZ: 'Suez Canal', PANAMA: 'Panama Canal' };

/** The feed shouts these ("🚨 HORMUZ HIGH: …"); this says where, how bad, and what it means. */
function readAlert(raw: string): { place: string | null; critical: boolean; text: string } {
  const m = /^\W*([A-Z]+) (HIGH|CRITICAL):\s*(.*)$/u.exec(raw);
  if (!m) return { place: null, critical: false, text: raw.replace(/^\W+\s*/u, '') };
  const place = PLACES[m[1]] ?? m[1].charAt(0) + m[1].slice(1).toLowerCase();
  return { place, critical: m[2] === 'CRITICAL', text: m[3] };
}

/** Shipping chokepoints whose congestion is moving prices. */
export function SupplyAlerts({ alerts }: { alerts: string[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {alerts.map((raw, i) => {
        const a = readAlert(String(raw));
        return (
          <li key={i} className="flex items-start gap-2.5">
            <TriangleAlert aria-hidden className={cx('mt-px size-4 shrink-0', a.critical ? 'text-red' : 'text-amber')} strokeWidth={1.75} />
            <div className="min-w-0">
              {a.place && (
                <p className="text-body font-medium text-ink-1">
                  {a.place} <span className="font-normal text-ink-3">· {a.critical ? 'critical' : 'high'} congestion</span>
                </p>
              )}
              <p className="text-small text-ink-2">{a.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Where the numbers come from, and the space weather the feed carries along. */
export function MarketsFooter({ spaceWeather, full }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the feed's space-weather payload is untyped
  spaceWeather?: any;
  /** Room for the long form. */
  full?: boolean;
}) {
  const kp = spaceWeather?.kp_index;
  const level = spaceWeather?.storm_level ? String(spaceWeather.storm_level).toLowerCase() : null;
  const flare = spaceWeather?.solar_flares?.[0]?.class as string | undefined;
  return (
    <>
      <span className="truncate">{full ? 'Prices from Yahoo Finance · charts by TradingView' : 'Prices from Yahoo Finance'}</span>
      {spaceWeather && (
        <span className="ml-auto shrink-0" title={`Geomagnetic activity from NOAA, which can disturb GPS, radio and power grids${flare ? `. Latest flare ${flare}` : ''}`}>
          {kp == null ? 'No space weather reading' : (
            <>Space weather Kp <span className={mono}>{kp}</span>{level && full ? `, ${level}` : ''}{flare && full && <> · flare <span className={mono}>{flare}</span></>}</>
          )}
        </span>
      )}
    </>
  );
}
