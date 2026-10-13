'use client';

import { type MouseEvent, useMemo, useState } from 'react';
import { climateAt } from '@/lib/paleo/climate';
import { formatMa, periodAt } from '@/lib/paleo/deep-time';

const W = 360;
const H = 64;
const PAD_L = 26;
const PAD_T = 4;
const AXIS = 14;
const LINE = '#E8C36A';

const fmt = (v: number) => `${Math.round(v)}°`;

/** Global temperature over the PhanDA record: the median, its 16–84% range, today's level and the clock's age. Click to go there. */
export default function ClimateChart({ rows, ma, onSeek }: { rows: number[][]; ma: number; onSeek: (ma: number) => void }) {
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
    <div className="relative mt-2">
      <svg viewBox={`0 0 ${W} ${H + AXIS}`} className="w-full h-auto block cursor-crosshair select-none" role="img"
        aria-label={`Global mean surface temperature, ${Math.round(oldest)} million years ago to today`}
        onPointerMove={e => setHover(snap(ageAt(e)))} onPointerLeave={() => setHover(null)} onClick={e => onSeek(ageAt(e))}>
        <line x1={PAD_L} x2={W} y1={geo.y(geo.today)} y2={geo.y(geo.today)} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 3" className="text-[var(--text-muted)]" />
        <text x={W - 2} y={geo.y(geo.today) - 3} textAnchor="end" className="fill-[var(--text-muted)] text-[8.5px]">today</text>
        <polygon points={geo.band} fill={LINE} fillOpacity={0.16} />
        <path d={geo.line} fill="none" stroke={LINE} strokeWidth={1.6} strokeLinejoin="round" />
        {[geo.lo, geo.hi].map(v => (
          <text key={v} x={PAD_L - 4} y={geo.y(v) + (v === geo.hi ? 7 : 0)} textAnchor="end" className="fill-[var(--text-muted)] text-[8.5px] tabular-nums">{fmt(v)}</text>
        ))}
        {ticks.map(t => (
          <text key={t} x={geo.x(t)} y={H + AXIS - 2} textAnchor={t === oldest ? 'start' : t === 0 ? 'end' : 'middle'} className="fill-[var(--text-muted)] text-[8.5px] tabular-nums">
            {t === 0 ? 'now' : `${Math.round(t)} Ma`}
          </text>
        ))}
        {now && (
          <g>
            <line x1={geo.x(ma)} x2={geo.x(ma)} y1={PAD_T} y2={H} stroke="var(--text-primary)" strokeOpacity={0.55} strokeWidth={1} />
            <circle cx={geo.x(ma)} cy={geo.y(now.gmst.mid)} r={3.5} fill={LINE} stroke="#08080d" strokeWidth={1.5} />
          </g>
        )}
        {hover !== null && shown && (
          <g pointerEvents="none">
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD_T} y2={H} stroke="var(--text-secondary)" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="2 2" />
            <circle cx={geo.x(hover)} cy={geo.y(shown.gmst.mid)} r={4} fill="none" stroke={LINE} strokeWidth={1.5} />
          </g>
        )}
      </svg>
      {hover !== null && shown && (
        <div className="pointer-events-none absolute -top-9 px-2 py-1 rounded-md bg-[#08080d]/95 border border-white/10 text-[10.5px] whitespace-nowrap shadow-lg"
          style={{ left: `${(geo.x(hover) / W) * 100}%`, transform: `translateX(${hover > oldest * 0.7 ? '0' : hover < oldest * 0.3 ? '-100%' : '-50%'})` }}>
          <span className="font-medium text-[var(--text-primary)] tabular-nums">{shown.gmst.mid.toFixed(1)} °C</span>
          <span className="text-[var(--text-muted)] tabular-nums"> ({fmt(shown.gmst.lo)}–{fmt(shown.gmst.hi)})</span>
          <span className="text-[var(--text-secondary)]"> · {formatMa(hover)} · {periodAt(hover).name}</span>
        </div>
      )}
    </div>
  );
}
