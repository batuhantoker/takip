'use client';

import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';
import { useMapArea } from './map-area';
import { showControls, useWindows, windowStore } from './window-store';

/** Escape closes the frontmost window. Remounted on every open, so it rejoins the top of the kit's stack. */
function EscapeClaim({ active }: { active: boolean }) {
  useEscape(() => windowStore.closeFront(), active);
  return null;
}

/** Mounted once beside the windows: Escape, Close all, and a reset when a remembered place no longer fits. */
export function WindowLayer() {
  const t = useT();
  const snap = useWindows();
  const { list, opened, offerReset } = snap;
  const area = useMapArea();
  const closable = list.filter(w => w.closable).length;

  return (
    <>
      <EscapeClaim key={opened} active={closable > 0} />
      {showControls(snap) && (
        // The column's first row, which docked windows stack below.
        <div className="pointer-events-auto fixed z-[399] flex gap-1.5" style={{ top: area.colTop, right: area.right - area.colRight }}>
          {offerReset && (
            <Button size="sm" icon={RotateCcw} onClick={() => windowStore.resetPlaces()}>{t('Reset window places')}</Button>
          )}
          {closable >= 2 && <Button size="sm" icon={X} onClick={() => windowStore.closeAll()}>{t('Close all')}</Button>}
        </div>
      )}
    </>
  );
}
