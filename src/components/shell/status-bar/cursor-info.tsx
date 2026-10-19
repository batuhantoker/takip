'use client';

import { useSyncExternalStore, type RefObject } from 'react';
import { cx } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import type { PointerPlace } from '@/lib/places/pointer-place';

/** Where the pointer is: its coordinates, written straight into the ref off React, and the place under it. Either can be left out. */
export default function CursorInfo({ coordsDisplayRef, place, hidden = false }: {
  coordsDisplayRef?: RefObject<HTMLSpanElement | null>;
  place?: PointerPlace;
  /** Out in space there is no map under the pointer; kept mounted so the ref keeps its last reading. */
  hidden?: boolean;
}) {
  const t = useT();
  return (
    <div className={cx('min-w-0 items-center gap-2', hidden ? 'hidden' : 'flex')}>
      {coordsDisplayRef && <span ref={coordsDisplayRef} aria-label={t('Pointer position')} className="shrink-0 font-mono tabular-nums text-ink-2" />}
      {place && <PlaceLabel place={place} dot={!!coordsDisplayRef} />}
    </div>
  );
}

/** Subscribed here, so a new name re-renders this and not the page, and a hidden name looks nothing up. */
function PlaceLabel({ place, dot }: { place: PointerPlace; dot: boolean }) {
  const label = useSyncExternalStore(place.subscribe, place.label, () => '');
  if (!label) return null;
  return (
    <>
      {dot && <span aria-hidden className="text-ink-4">·</span>}
      <span className="truncate">{label}</span>
    </>
  );
}
