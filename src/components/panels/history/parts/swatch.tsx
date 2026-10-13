import type { CSSProperties } from 'react';
import { cx } from '@/components/ui/class-names';

const SHAPE = { dot: 'size-2 rounded-full', square: 'size-2.5 rounded-[2px]', bar: 'h-2.5 w-3.5 rounded-[2px]' };

/** A key to a colour the map draws: an event family, a period, an alignment. The colour comes from the data, not the theme. */
export function Swatch({ color, shape = 'square', off, style, className }: {
  color: string;
  /** Dots for point layers, squares and bars for filled areas. */
  shape?: 'dot' | 'square' | 'bar';
  /** Drawn grey while its layer is off. */
  off?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span aria-hidden
      className={cx('inline-block shrink-0', SHAPE[shape], off && 'bg-ink-4', className)}
      style={off ? style : { background: color, ...style }} />
  );
}
