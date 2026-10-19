'use client';

import { cx } from '@/components/ui/class-names';
import { ANCHORS } from '../lib/model';
import { presetSpot, spotStyle } from '../lib/spot';
import { useDragging } from './arrange-state';

/** While a piece is dragged: its outline at each of the nine preset places, the one it would take lit. */
export default function ArrangeTargets() {
  const dragging = useDragging();
  if (!dragging) return null;
  return ANCHORS.map(anchor => (
    <div key={anchor} aria-hidden style={{ ...spotStyle(presetSpot(anchor)), width: dragging.width, height: dragging.height }}
      className={cx(
        'pointer-events-none absolute z-[230] rounded-float border border-dashed transition-colors duration-100',
        dragging.snap === anchor ? 'border-accent bg-accent/15' : 'border-line-strong',
      )} />
  ));
}
