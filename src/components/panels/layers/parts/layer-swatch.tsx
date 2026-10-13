import { Plane } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { legendFor, type LegendSpec } from '@/components/panels/layers/lib/layer-legend';

const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

function Mark({ spec }: { spec: LegendSpec }) {
  const [c, ...rest] = spec.colors;
  switch (spec.shape) {
    case 'plane':
      return <Plane aria-hidden className="size-3.5 -rotate-45" strokeWidth={2} style={{ color: c, fill: tint(c, 40) }} />;
    case 'ring':
      return <span className="size-2.5 rounded-full border-[1.5px]" style={{ borderColor: c, background: tint(c, 25) }} />;
    case 'line':
      return <span className="h-[2px] w-3.5 rounded-full" style={{ background: c }} />;
    case 'area':
      return <span className="size-2.5 rounded-[3px] border" style={{ borderColor: c, background: tint(c, 30) }} />;
    case 'gradient':
      return <span className="h-1.5 w-3.5 rounded-full" style={{ background: `linear-gradient(90deg, ${spec.colors.join(', ')})` }} />;
    case 'cluster':
      return (
        <span className="relative size-3">
          {[c, ...rest].slice(0, 3).map((color, i) => (
            <span key={i} className={cx('absolute size-[5px] rounded-full', ['top-0 left-0', 'top-0 right-0', 'bottom-0 left-[3.5px]'][i])} style={{ background: color }} />
          ))}
        </span>
      );
    default:
      return <span className="size-2 rounded-full" style={{ background: c }} />;
  }
}

/**
 * A layer's key, drawn the way its marks look on the map. Off layers sit in
 * grey so the colour on screen belongs to what is actually drawn.
 */
export function LayerSwatch({ layerKey, on, className }: { layerKey: string; on: boolean; className?: string }) {
  const spec = legendFor(layerKey);
  return (
    <span aria-hidden className={cx(
      'flex size-4 shrink-0 items-center justify-center transition-[filter,opacity] duration-150 ease-out motion-reduce:transition-none',
      !on && 'opacity-60 grayscale group-hover/row:opacity-100 group-hover/row:grayscale-0',
      className,
    )}>
      {spec && <Mark spec={spec} />}
    </span>
  );
}
