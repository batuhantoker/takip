'use client';

import { type MouseEvent, useMemo, useState } from 'react';
import { climateAt } from '@/lib/history/paleo/climate';
import { formatMa, periodAt } from '@/lib/history/paleo/deep-time';
import { useT } from '@/components/ui/use-t';

const W = 368;
const H = 64;
const PAD_L = 30;
const PAD_T = 6;
const AXIS = 18;

const deg = (v: number) => `${Math.round(v)}°`;

/** Global temperature over the PhanDA record: the median, its 16–84% range, today's level and the clock's age. Click to go there. */
export default function ClimateChart({ rows, ma, onSeek }: { rows: number[][]; ma: number; onSeek: (ma: number) => void }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const oldest = rows[rows.length - 1][0];
  const geo = useMemo(() => {
    const lo = Math.floor(Math.min(...rows.map(r => r[1])) / 5) * 5;
    const hi = Math.ceil(Math.max(...rows.map(r => r[3])) / 5) * 5;
    const x = (age: number) => PAD_L + (1 - age / oldest) * (W - PAD_L);
    const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T);
    const band = [...rows.map(r => `${x(r[0])},${y(r[3])}`), ...rows.slice().reverse().map(r => `${x(r[0])},${y(r[1])}`)].join(' ');
    const line = rows.map((r, i) => `${i ? 'L' : 'M'}${x(r[0]).toFixed(1)},${y(r[2]).toFixed(1)}`).join('');
    return { lo, hi, x, y, band, line, today: rows[0][2] };
  }, [rows, oldest]);

  const ageAt = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    return Math.max(0, Math.min(oldest, (1 - (px - PAD_L) / (W - PAD_L)) * oldest));
  };
  // The crosshair snaps to the nearest stage.
  const snap = (age: number) => rows.reduce((best, r) => (Math.abs(r[0] - age) < Math.abs(best - age) ? r[0] : best), rows[0][0]);

  const now = ma <= oldest ? climateAt(rows, ma) : null;
  const shown = hover !== null ? climateAt(rows, hover) : null;
  const ticks = [oldest, 252, 66, 0];

  return (
    <figure className="m-0">
      <figcaption className="mb-1 flex items-center gap-2 text-meta text-ink-3">
        {hover !== null && shown ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="font-mono font-medium text-ink-1 tabular-nums">{shown.gmst.mid.toFixed(1)} °C</span>
            <span className="font-mono tabular-nums"> {deg(shown.gmst.lo)}–{deg(shown.gmst.hi)}</span>
            <span className="text-ink-2"> · {formatMa(hover, t.intl)} · {t(periodAt(hover).name)}</span>
          </span>
        ) : <span className="flex-1 font-medium">{t('Global temperature')}</span>}
        <svg aria-hidden width="14" height="2" className="shrink-0"><line x1="0" x2="14" y1="1" y2="1" stroke="var(--ink-4)" strokeWidth={2} strokeDasharray="2 3" /></svg>
        <span>{t('today')}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + AXIS}`} className="block h-auto w-full cursor-crosshair select-none" role="img"
        aria-label={t('Global mean surface temperature, {n} million years ago to today', { n: Math.round(oldest) })}
        onPointerMove={e => setHover(snap(ageAt(e)))} onPointerLeave={() => setHover(null)} onClick={e => onSeek(ageAt(e))}>
        <line x1={PAD_L} x2={W} y1={geo.y(geo.today)} y2={geo.y(geo.today)} stroke="var(--ink-4)" strokeDasharray="2 3" />
        <polygon points={geo.band} fill="var(--ink-1)" fillOpacity={0.08} />
        <path d={geo.line} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} strokeLinejoin="round" />
        {[geo.lo, geo.hi].map(v => (
          <text key={v} x={PAD_L - 6} y={geo.y(v) + (v === geo.hi ? 8 : 0)} textAnchor="end" fill="var(--ink-3)" fontSize={11} className="font-mono tabular-nums">{deg(v)}</text>
        ))}
        {ticks.map(tick => (
          <text key={tick} x={geo.x(tick)} y={H + AXIS - 3} textAnchor={tick === oldest ? 'start' : tick === 0 ? 'end' : 'middle'} fill="var(--ink-3)" fontSize={11} className="font-mono tabular-nums">
            {tick === 0 ? t('now') : `${Math.round(tick)} Ma`}
          </text>
        ))}
        {now && (
          <g>
            <line x1={geo.x(ma)} x2={geo.x(ma)} y1={PAD_T} y2={H} stroke="var(--accent)" strokeOpacity={0.5} />
            <circle cx={geo.x(ma)} cy={geo.y(now.gmst.mid)} r={3.5} fill="var(--accent)" stroke="var(--surface-1)" strokeWidth={1.5} />
          </g>
        )}
        {hover !== null && shown && (
          <g pointerEvents="none">
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD_T} y2={H} stroke="var(--ink-3)" strokeDasharray="2 2" />
            <circle cx={geo.x(hover)} cy={geo.y(shown.gmst.mid)} r={4} fill="none" stroke="var(--ink-1)" strokeWidth={1.5} />
          </g>
        )}
      </svg>
    </figure>
  );
}
