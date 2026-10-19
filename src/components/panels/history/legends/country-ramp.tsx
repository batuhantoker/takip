import { formatValue, type Scale } from '@/lib/history/series';
import { useT } from '@/components/ui/use-t';

/** Stands in for the grey hatch the country layer draws where there is no value. */
const NO_DATA_FILL = 'repeating-linear-gradient(135deg, var(--ink-3) 0 1px, transparent 1px 4px)';
/** And for the hatch leaning the other way over a projected value's colour. */
const projectedFill = (color: string) => `repeating-linear-gradient(45deg, var(--ink-3) 0 1px, transparent 1px 4px), ${color}`;

function Key({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-6 shrink-0 rounded-full border border-line-strong" style={{ background: fill }} />
      <span className="text-meta text-ink-3">{label}</span>
    </span>
  );
}

/** The colour scale for a country metric: low to high, with its ends and middle, the no-data hatch and, with projections, theirs. */
/** `projected` names the hatched values' key: "Projected", or "Modelled" when no value is measured. */
export function CountryRamp({ ramp, scale, unit, projected }: { ramp: string[]; scale: Scale; unit: string | null; projected?: string }) {
  const t = useT();
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="h-2 rounded-full" style={{ background: `linear-gradient(to right, ${ramp.join(',')})` }} />
        <div className="mt-1.5 flex justify-between font-mono text-meta text-ink-3 tabular-nums">
          <span>{formatValue(scale.lo, unit, t.intl)}</span>
          <span>{formatValue(scale.at(0.5), unit, t.intl)}</span>
          <span>{formatValue(scale.hi, unit, t.intl)}+</span>
        </div>
      </div>
      {projected ? (
        // Two keys side by side would squeeze the scale's numbers together.
        <div className="flex shrink-0 flex-col gap-1">
          <Key fill={projectedFill(ramp[Math.floor(ramp.length / 2)])} label={projected} />
          <Key fill={NO_DATA_FILL} label={t('No data')} />
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <span className="h-2 w-6 rounded-full border border-line-strong" style={{ background: NO_DATA_FILL }} />
          <span className="text-meta text-ink-3">{t('No data')}</span>
        </div>
      )}
    </div>
  );
}
