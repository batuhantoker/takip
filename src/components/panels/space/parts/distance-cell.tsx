import { distance } from '@/lib/space/format';

/** How far, and how long light (or a radio signal) takes to cover it: two right-aligned lines. */
export function DistanceCell({ km, light }: { km: number; light?: string }) {
  return (
    <span className="flex flex-col items-end leading-none">
      <span className="font-mono text-small text-ink-1 tabular-nums">{distance(km)}</span>
      {light && (
        <span className="mt-1 text-meta text-ink-3" title={`Light, and a radio signal, takes ${light} to get there`}>
          light <span className="font-mono tabular-nums">{light}</span>
        </span>
      )}
    </span>
  );
}
