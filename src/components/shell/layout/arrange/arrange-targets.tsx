'use client';

import { cx } from '@/components/ui/class-names';
import { ANCHORS } from '../lib/model';
import { presetSpot, spotStyle } from '../lib/spot';
import { useDragging } from './arrange-state';

const GHOST = 'pointer-events-none absolute rounded-float border border-dashed transition-colors duration-100';

/** While a piece is dragged: its outline at each of the nine preset places, and where it would land lit, preset or beside another piece. */
export default function ArrangeTargets() {
  const dragging = useDragging();
  if (!dragging) return null;
  const { width, height, snap } = dragging;
  return (
    <>
      {ANCHORS.map(anchor => (
        <div key={anchor} aria-hidden style={{ ...spotStyle(presetSpot(anchor)), width, height }}
          className={cx(GHOST, 'z-[230]', snap?.preset === anchor ? 'border-accent bg-accent/15' : 'border-line-strong')} />
      ))}
      {/* <main> fills the viewport from 0, 0, so a viewport box places it directly. */}
      {snap && !snap.preset && (
        <div aria-hidden style={{ left: snap.box.left, top: snap.box.top, width, height }} className={cx(GHOST, 'z-[235] border-accent bg-accent/15')} />
      )}
    </>
  );
}
