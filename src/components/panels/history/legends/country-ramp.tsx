import { formatValue, type Scale } from '@/lib/history/series';

/** Stands in for the grey hatch the country layer draws where there is no value. */
const NO_DATA_FILL = 'repeating-linear-gradient(135deg, var(--ink-3) 0 1px, transparent 1px 4px)';

/** The colour scale for a country metric: low to high, with its ends and middle, and the no-data hatch. */
export function CountryRamp({ ramp, scale, unit }: { ramp: string[]; scale: Scale; unit: string | null }) {
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="h-2 rounded-full" style={{ background: `linear-gradient(to right, ${ramp.join(',')})` }} />
        <div className="mt-1.5 flex justify-between font-mono text-meta text-ink-3 tabular-nums">
          <span>{formatValue(scale.lo, unit)}</span>
          <span>{formatValue(scale.at(0.5), unit)}</span>
          <span>{formatValue(scale.hi, unit)}+</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <span className="h-2 w-6 rounded-full border border-line-strong" style={{ background: NO_DATA_FILL }} />
        <span className="text-meta text-ink-3">No data</span>
      </div>
    </div>
  );
}
