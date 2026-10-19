'use client';

import type { RefObject } from 'react';
import type { Piece, Side, StatusId } from '@/components/shell/layout/lib/model';
import type { BackendStatus, LiveData } from '@/components/shell/state/types';
import type { PointerPlace } from '@/lib/places/pointer-place';
import CursorInfo from './cursor-info';
import GlobalStatusBar from './global-status-bar';
import { LatestQuake } from './latest-quake';
import { LiveState, ShortcutsButton, TrackedCount, UtcClock } from './status-cluster';

/** The status bar's pieces in the person's order and on their side (Settings → Layout); nothing when they hid the bar. */
export default function StatusBar({ revealed, status, shown, cursor, inSpace, backendStatus, data, onLocate }: {
  revealed: boolean;
  status: Record<Side, StatusId[]>;
  shown: (piece: Piece) => boolean;
  cursor: { coordsDisplayRef: RefObject<HTMLSpanElement | null>; place: PointerPlace };
  inSpace: boolean;
  backendStatus: BackendStatus;
  data: LiveData;
  onLocate: (lat: number, lng: number) => void;
}) {
  if (!shown('statusbar')) return null;

  const pieces = (ids: StatusId[]) => {
    const visible = ids.filter(id => shown(`status:${id}`));
    return visible.map((id, i) => {
      switch (id) {
        // Side by side, the position and the place read as one: "41.77° N 88.15° W · Naperville".
        case 'position':
          return <CursorInfo key={id} coordsDisplayRef={cursor.coordsDisplayRef} place={visible[i + 1] === 'place' ? cursor.place : undefined} hidden={inSpace} />;
        case 'place':
          return visible[i - 1] === 'position' ? null : <CursorInfo key={id} place={cursor.place} hidden={inSpace} />;
        case 'quake':
          return <span key={id} className="hidden min-w-0 xl:flex"><LatestQuake quakes={data?.earthquakes} onLocate={onLocate} /></span>;
        case 'live':
          return <LiveState key={id} backendStatus={backendStatus} />;
        case 'tracked':
          return <TrackedCount key={id} data={data} />;
        case 'clock':
          return <UtcClock key={id} />;
        case 'shortcuts':
          return <ShortcutsButton key={id} tight={visible[i - 1] === 'clock'} />;
      }
    });
  };

  return <GlobalStatusBar revealed={revealed} left={pieces(status.left)} right={pieces(status.right)} />;
}
