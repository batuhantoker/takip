import type { IndicatorStat } from '@/lib/platform/site/places/topics/indicators-facts';

/** A measure's figures in the page's header: each number large, what it is above it, a qualifier under it. */
export function StatTiles({ stats }: { stats: IndicatorStat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map(s => (
        <div key={s.label} className="flex flex-col gap-1 rounded-card border border-line bg-surface-1 px-3 py-2.5">
          <dt className="text-[12px] text-ink-3">{s.label}</dt>
          <dd className="text-[19px] leading-tight font-semibold tracking-[-0.01em] text-ink-1 tabular-nums">{s.value}</dd>
          {s.note && <dd className="text-[11px] leading-snug text-ink-3">{s.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Sentences as a list, each its own line. */
export function Points({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {points.map(p => (
        <li key={p} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-2">
          <span aria-hidden className="mt-[10px] size-1.5 shrink-0 rounded-full bg-ink-3" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}
