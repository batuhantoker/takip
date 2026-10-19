'use client';

import { Fragment, useEffect, type CSSProperties, type ReactNode } from 'react';
import { refreshMapArea } from '@/components/map/windows/map-area';
import { cx } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import ArrangeBar from './arrange/arrange-bar';
import ArrangeTargets from './arrange/arrange-targets';
import { useArranging } from './arrange/arrange-state';
import PieceFrame from './arrange/piece-frame';
import { OVERLAY_LABELS } from './lib/labels';
import { CORNERS, OVERLAY_IDS, menuCorner, type Corner, type FreeSpot, type OverlayId } from './lib/model';
import { spotStyle } from './lib/spot';

// Clear of the sidebar and any panel beside it (--shell-left), and above the status bar or a timeline (--shell-bottom).
const LEFT = 'calc(var(--shell-left, 0px) + 12px)';
const BOTTOM = 'calc(var(--shell-bottom, var(--shell-foot, 28px)) + 12px)';

const PLACE: Record<Corner, { style: CSSProperties; className: string }> = {
  'top-left': { style: { top: 12, left: LEFT }, className: 'flex-col items-start' },
  'top-right': { style: { top: 12, right: 12 }, className: 'flex-col items-end' },
  'bottom-left': { style: { bottom: BOTTOM, left: LEFT }, className: 'flex-row items-end' },
  'bottom-right': { style: { bottom: BOTTOM, right: 12 }, className: 'flex-row-reverse items-end' },
};

const HUD = 'pointer-events-none absolute flex transition-[opacity,left,bottom] duration-150 ease-out motion-reduce:transition-none';

/**
 * The desktop map's pieces (Settings → Layout). Each sits in one of the four corners, the first nearest the corner:
 * stacked down from a top corner, side by side along the bottom. One the person dragged elsewhere sits where they
 * left it, hung from a corner, an edge's middle or the map's. The window column reads the right-hand corners and those pieces (map/windows/map-area.ts) to stay clear.
 */
export default function CornerSlots({ corners, free, revealed, pieces }: {
  corners: Record<Corner, OverlayId[]>;
  free: Partial<Record<OverlayId, FreeSpot>>;
  revealed: boolean;
  /** Each piece as it looks hanging from a corner; nothing when it is hidden or has no place right now (out in space). */
  pieces: Record<OverlayId, (corner: Corner) => ReactNode>;
}) {
  const t = useT();
  const arranging = useArranging();
  // Search's results open over the windows.
  const layer = (ids: OverlayId[]) => (ids.includes('search') ? 'z-[450]' : 'z-[240]');
  const shown = revealed ? 'opacity-100' : 'opacity-0';
  const piece = (id: OverlayId, corner: Corner) => {
    const node = pieces[id](corner);
    return arranging && node ? <PieceFrame id={id} label={t(OVERLAY_LABELS[id])}>{node}</PieceFrame> : node;
  };

  useEffect(() => { requestAnimationFrame(refreshMapArea); }, [corners, free]);

  return (
    <>
      {CORNERS.map(corner => {
        const ids = corners[corner].filter(id => !free[id]);
        return (
          <div key={corner} data-hud data-corner={corner} style={PLACE[corner].style} className={cx(HUD, 'gap-2', PLACE[corner].className, layer(ids), shown)}>
            {ids.map(id => <Fragment key={id}>{piece(id, corner)}</Fragment>)}
          </div>
        );
      })}
      {OVERLAY_IDS.map(id => {
        const spot = free[id];
        return spot && (
          <div key={id} data-hud data-free style={spotStyle(spot)} className={cx(HUD, layer([id]), shown)}>
            {piece(id, menuCorner(spot.anchor))}
          </div>
        );
      })}
      {arranging && <ArrangeTargets />}
      {arranging && <ArrangeBar placed={Object.keys(free).length} />}
    </>
  );
}
