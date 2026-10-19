'use client';

import { useRef } from 'react';
import { Landmark, MessageSquareWarning, Satellite } from 'lucide-react';
import { cx, ENTER } from '@/components/ui/class-names';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { useDismiss } from '@/components/ui/use-dismiss';
import { useT } from '@/components/ui/use-t';
import { showReportDialog } from '@/components/site/report/report-dialog-state';

/** A point on the map and where on screen it was right-clicked, relative to the map. */
export interface MapMenuAt {
  lat: number;
  lng: number;
  x: number;
  y: number;
}

/** What can be asked about the point under a right-click, or reported there. Nothing is fetched until an item is picked. */
export function MapMenu({ at, onClose, onDossier, onImagery }: {
  at: MapMenuAt;
  onClose: () => void;
  onDossier: (at: MapMenuAt) => void;
  onImagery: (at: MapMenuAt) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  const pick = (action: (at: MapMenuAt) => void) => () => { onClose(); action(at); };
  return (
    // The menu opens under the cursor, so a double right-click's second click lands here: it still means the dossier.
    <div ref={ref} role="menu" aria-label={t('This place')} onContextMenu={e => { e.preventDefault(); pick(onDossier)(); }}
      className={cx('absolute z-[1200] w-56 rounded-float border border-line bg-surface-1 p-1 text-ink-2 shadow-float', ENTER)}
      style={{ left: at.x, top: at.y }}>
      <MenuItem icon={Landmark} onSelect={pick(onDossier)}>{t('Region dossier')}</MenuItem>
      <MenuItem icon={Satellite} onSelect={pick(onImagery)}>{t('Satellite images here')}</MenuItem>
      <MenuDivider />
      <MenuItem icon={MessageSquareWarning} onSelect={pick(p => showReportDialog({ lat: p.lat, lng: p.lng }))}>{t('Report an issue here')}</MenuItem>
    </div>
  );
}
