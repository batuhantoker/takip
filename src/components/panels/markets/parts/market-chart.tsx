'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, CandlestickSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from 'lightweight-charts';
import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { Segmented } from '@/components/ui/segmented';
import { useT } from '@/components/ui/use-t';
import { MAP_INK } from '@/lib/map/style/tokens';

interface Candle {
  time: number;
  open: number; high: number; low: number; close: number; volume: number;
}

interface MarketChartProps {
  symbol: string;
  name: string;
  onClose: () => void;
  /** Taller layout for the maximized panel, where there is room for it. */
  large?: boolean;
}

/* Lowercase m is minutes, uppercase M is months — the convention every
   trading tool uses, and what the API's range keys mean. */
const RANGES = ['1m', '15m', '24H', '1W', '1M', '6M', '1Y'] as const;
type Range = typeof RANGES[number];

/** Bars finer than a day need the clock on the axis, not just the date. */
const INTRADAY: Record<Range, boolean> = {
  '1m': true, '15m': true, '24H': true, '1W': true,
  '1M': false, '6M': false, '1Y': false,
};

/** A theme value, read off the page: the canvas cannot resolve a CSS variable itself. */
function themeColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** `#rrggbb` at an alpha, for canvas fills. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const palette = () => ({
  up: themeColor('--green', MAP_INK.green),
  down: themeColor('--red', MAP_INK.red),
  text: themeColor('--ink-3', MAP_INK.ink3),
  ink: themeColor('--ink-2', MAP_INK.ink2),
  label: themeColor('--surface-3', MAP_INK.surface1),
});

/** Prices here span FX pairs to Bitcoin — pick the precision from the value. */
function priceFormat(v: number, intl: string): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toLocaleString(intl, { maximumFractionDigits: 0 });
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

export default function MarketChart({ symbol, name, onClose, large = false }: MarketChartProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [range, setRange] = useState<Range>('1M');
  /* Keyed by the request it answers, so status is derived rather than set on
     the way in — a synchronous setState in the effect body would cascade. */
  const [result, setResult] = useState<{ key: string; rows: Candle[] | null }>({ key: '', rows: null });
  /** Whatever the crosshair is currently over — falls back to the last bar. */
  const [hover, setHover] = useState<Candle | null>(null);

  const height = large ? 420 : 200;

  // ── Chart instance. Built once; data and axis formatting are applied later
  //    so that changing range never tears down the canvas.
  useEffect(() => {
    if (!containerRef.current) return;

    const c = palette();
    const grid = withAlpha(MAP_INK.ink1, 0.04);
    const axis = withAlpha(MAP_INK.ink1, 0.1);
    const chart = createChart(containerRef.current, {
      // The library measures the container itself. Sizing the canvases by
      // hand left their bitmaps at the 300x150 default — laid out, but never
      // painted.
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        // Credited in the full-screen footer instead of a logo inside the plot.
        attributionLogo: false,
        textColor: c.text,
        fontFamily: themeColor('--font-hud', 'ui-monospace, SFMono-Regular, Menlo, monospace'),
        fontSize: 11,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: axis, scaleMargins: { top: 0.1, bottom: 0.26 } },
      timeScale: { borderColor: axis, secondsVisible: false },
      crosshair: {
        vertLine: { color: withAlpha(c.ink, 0.4), labelBackgroundColor: c.label },
        horzLine: { color: withAlpha(c.ink, 0.4), labelBackgroundColor: c.label },
      },
      handleScale: { axisPressedMouseMove: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: c.up, downColor: c.down,
      wickUpColor: c.up, wickDownColor: c.down,
      borderVisible: false,
    });

    // Volume sits in the bottom quarter, on its own invisible scale so it
    // never distorts the price axis.
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chart.subscribeCrosshairMove((param) => {
      const d = param.seriesData.get(candleSeries) as Candle | undefined;
      setHover(d && param.time ? { ...d, time: param.time as number, volume: d.volume ?? 0 } : null);
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    return () => { chart.remove(); chartRef.current = null; };
  }, []);

  // Only intraday bars need the clock on the axis. Applied separately so
  // switching range never tears down the canvas.
  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({ timeVisible: INTRADAY[range] });
  }, [range]);

  const requestKey = `${symbol}|${range}`;
  const status: 'loading' | 'ready' | 'error' =
    result.key !== requestKey ? 'loading' : result.rows === null ? 'error' : 'ready';
  const candles = useMemo(
    () => (result.key === requestKey && result.rows ? result.rows : []),
    [result, requestKey],
  );

  // ── Data ──
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/v1/markets/history?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        const rows: Candle[] = d.candles || [];
        setResult({ key: `${symbol}|${range}`, rows: rows.length ? rows : null });
      })
      .catch(() => { if (!cancelled) setResult({ key: `${symbol}|${range}`, rows: null }); });

    return () => { cancelled = true; };
  }, [symbol, range]);

  // Push data once both the series and the rows exist.
  useEffect(() => {
    if (status !== 'ready' || !candleRef.current || !volumeRef.current) return;

    candleRef.current.setData(candles.map(c => ({
      time: c.time as UTCTimestamp,
      open: c.open, high: c.high, low: c.low, close: c.close,
    })));

    const { up, down } = palette();
    volumeRef.current.setData(candles.map(c => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: withAlpha(c.close >= c.open ? up : down, 0.28),
    })));

    chartRef.current?.timeScale().fitContent();
  }, [candles, status]);

  // ── Range summary: first open to last close across the window shown ──
  const last = candles[candles.length - 1];
  const first = candles[0];
  const rangeChange = first && last ? ((last.close - first.open) / first.open) * 100 : null;
  const shown = hover || last;
  const high = candles.length ? Math.max(...candles.map(c => c.high)) : null;
  const low = candles.length ? Math.min(...candles.map(c => c.low)) : null;

  const mono = 'font-mono tabular-nums';
  return (
    <div className="rounded-card border border-line bg-surface-2">
      {/* What is charted, and how it did over the window shown */}
      <div className="flex items-center gap-2 border-b border-line py-1.5 pr-1.5 pl-3">
        <span className="truncate text-body font-medium text-ink-1">{name}</span>
        <span className="shrink-0 font-mono text-meta text-ink-3">{symbol}</span>
        {rangeChange !== null && (
          <span className={cx(mono, 'ml-auto shrink-0 text-small', rangeChange >= 0 ? 'text-green' : 'text-red')}>
            {rangeChange >= 0 ? '+' : '−'}{Math.abs(rangeChange).toFixed(2)}% <span className="text-ink-3">{range}</span>
          </span>
        )}
        <IconButton size="sm" icon={X} label={t('Close the chart')} onClick={onClose} className={rangeChange === null ? 'ml-auto' : undefined} />
      </div>

      <div className="px-3 pt-2 pb-3">
        {/* Follows the crosshair, resting on the latest bar */}
        <div className={cx(mono, 'mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-ink-3')}>
          {shown ? (
            <>
              <span>O <span className="text-ink-2">{priceFormat(shown.open, t.intl)}</span></span>
              <span>H <span className="text-ink-2">{priceFormat(shown.high, t.intl)}</span></span>
              <span>L <span className="text-ink-2">{priceFormat(shown.low, t.intl)}</span></span>
              <span>C <span className="text-ink-1">{priceFormat(shown.close, t.intl)}</span></span>
              {shown.volume > 0 && <span>V <span className="text-ink-2">{formatVolume(shown.volume)}</span></span>}
            </>
          ) : <span>—</span>}
        </div>

        {/* Loading and failure draw over the same box, so the panel never changes height while a range loads. */}
        <div className="relative" style={{ height }}>
          <div ref={containerRef} className="w-full" style={{ height }} />
          {status !== 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-2/80 text-small text-ink-3">
              {status === 'loading'
                ? <><LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.75} /> {t('Loading {range}', { range })}</>
                : <><CircleAlert aria-hidden className="size-3.5" strokeWidth={1.75} /> {t('No {range} data for {symbol}', { range, symbol })}</>}
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className={cx(mono, 'text-meta text-ink-3')}>
            {high !== null && low !== null && t.rich('High {high} · low {low}', { high: <span className="text-ink-2">{priceFormat(high, t.intl)}</span>, low: <span className="text-ink-2">{priceFormat(low, t.intl)}</span> })}
          </span>
          <Segmented<Range> label={t('Range')} size="sm" value={range} onChange={setRange} options={RANGES.map(r => ({ value: r, label: <span className="font-mono">{r}</span> }))} />
        </div>
      </div>
    </div>
  );
}
