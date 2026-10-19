import { useT } from '@/components/ui/use-t';
import { distance } from '@/lib/space/format';

/** How far, and how long light (or a radio signal) takes to cover it: two right-aligned lines. */
export function DistanceCell({ km, light }: { km: number; light?: string }) {
  const t = useT();
  return (
    <span className="flex flex-col items-end leading-none">
      <span className="font-mono text-small text-ink-1 tabular-nums">{distance(km, t)}</span>
      {light && (
        <span className="mt-1 text-meta text-ink-3" title={t('Light, and a radio signal, takes {time} to get there', { time: light })}>
          {t.rich('light {time}', { time: <span className="font-mono tabular-nums">{light}</span> })}
        </span>
      )}
    </span>
  );
}
