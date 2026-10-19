'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, TRANSITION } from '@/components/ui/class-names';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { LayerSwatch } from './layer-swatch';
import type { LayerUndo } from '@/components/panels/layers/use-layer-browser';

/** Past this many the list folds, so the groups below stay in reach. */
const FOLDED = 6;

export interface OnMapItem {
  key: string;
  label: string;
  count: number | null;
}

/** The layers drawing right now, as a key to the map: each removable on its own, with a short undo. */
export default function LayersOnMap({ items, undo, onTurnOff, onUndo }: {
  items: OnMapItem[];
  undo: LayerUndo | null;
  onTurnOff: (items: OnMapItem[]) => void;
  onUndo: () => void;
}) {
  const t = useT();
  const [unfolded, setUnfolded] = useState(false);
  const folds = items.length > FOLDED + 1;
  const visible = folds && !unfolded ? items.slice(0, FOLDED) : items;

  return (
    <PanelSection
      title={t('On the map')}
      action={items.length > 1 ? <Button variant="ghost" size="sm" onClick={() => onTurnOff(items)}>{t('Turn all off')}</Button> : undefined}
    >
      {items.length === 0 && !undo && <p className="text-small text-ink-3">{t('Nothing yet. Turn a layer on below.')}</p>}
      {items.length > 0 && (
        <ul className="flex flex-col">
          {visible.map(item => (
            <li key={item.key} className={cx('-mx-2 flex h-8 items-center gap-3 rounded-control pr-2.5 pl-2 hover:bg-surface-2', TRANSITION)}>
              <LayerSwatch layerKey={item.key} on />
              <span className="min-w-0 flex-1 truncate text-body text-ink-1">{item.label}</span>
              {item.count !== null && <span className="font-mono text-small text-ink-2 tabular-nums">{item.count.toLocaleString(t.intl)}</span>}
              <IconButton size="sm" icon={X} label={t('Turn off {layer}', { layer: item.label })} tooltipSide="left" onClick={() => onTurnOff([item])} />
            </li>
          ))}
          {folds && (
            <li>
              <Button variant="ghost" size="sm" className="mt-1 -ml-2.5" onClick={() => setUnfolded(u => !u)} aria-expanded={unfolded}>
                {unfolded ? t('Show fewer') : t('Show {n} more', { n: items.length - FOLDED })}
              </Button>
            </li>
          )}
        </ul>
      )}
      {undo && (
        <p role="status" className={cx('flex h-7 items-center gap-2 text-small text-ink-2', items.length > 0 && 'mt-2')}>
          <span className="truncate">{undo.text}</span>
          <Button variant="ghost" size="sm" onClick={onUndo} className="-ml-1">{t('Undo')}</Button>
        </p>
      )}
    </PanelSection>
  );
}
