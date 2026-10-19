import { pct } from '@/components/site/admin/analytics/lib/format';

export type MeterPart = { label: string; value: number; color: string };

/** Parts of a whole on one bar; whatever the parts leave of `total` is the unfilled track. */
export function Meter({ parts, total, format, rest }: { parts: MeterPart[]; total: number; format: (n: number) => string; rest?: string }) {
  const used = parts.reduce((s, p) => s + p.value, 0);
  const left = Math.max(0, total - used);
  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={parts.map(p => `${p.label} ${format(p.value)}`).concat(rest ? [`${rest} ${format(left)}`] : []).join(', ')}
        className="flex h-3 gap-[2px] overflow-hidden rounded-[4px] bg-surface-3"
      >
        {parts.map(p => p.value > 0 && (
          <div key={p.label} className="h-full min-w-px" style={{ width: `${(p.value / Math.max(1, total)) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
        {parts.map(p => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: p.color }} />
            <span className="text-ink-2">{p.label}</span>
            <span className="font-mono tabular-nums text-ink-1">{format(p.value)}</span>
            <span className="text-ink-3">{pct(p.value, total)}</span>
          </li>
        ))}
        {rest && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[2px] bg-surface-3 ring-1 ring-line-strong" />
            <span className="text-ink-2">{rest}</span>
            <span className="font-mono tabular-nums text-ink-1">{format(left)}</span>
            <span className="text-ink-3">{pct(left, total)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
