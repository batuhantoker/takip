'use client';

import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cx, TRANSITION } from '@/components/ui/class-names';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import type { LayerDef } from '@/components/panels/layers/layer-groups';
import { legendFor } from '@/components/panels/layers/lib/layer-legend';
import { LayerSwatch } from './layer-swatch';
import { inSentence, localLabel } from '@/components/panels/layers/lib/sentence-case';

export const layerName = (layer: LayerDef, t: Translate) => localLabel(layer.label, t);

/** One layer: its key, its name and source, how many things it draws, and the switch. The whole row toggles. */
export function LayerRow({ layer, on, count, detail, compact, onToggle }: {
  layer: LayerDef;
  on: boolean;
  count: number | null;
  /** The second line: where the data comes from. */
  detail?: string;
  compact?: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const id = useId();
  const name = layerName(layer, t);
  return (
    <div className={cx(
      'group/row relative -mx-2 flex items-center gap-3 rounded-control px-2 hover:bg-surface-2',
      compact ? 'min-h-10 py-1' : detail ? 'min-h-12 py-1.5' : 'min-h-10 py-1.5',
      TRANSITION,
    )}>
      <LayerSwatch layerKey={layer.key} on={on} />
      <div className="min-w-0 flex-1">
        {/* Stretched over the row, so a click anywhere on it reaches the switch. */}
        <label htmlFor={id} className={cx(
          'block cursor-pointer truncate text-body font-medium after:absolute after:inset-0 after:rounded-control',
          on ? 'text-ink-1' : 'text-ink-2',
        )}>
          {name}
        </label>
        {detail && <p className="truncate text-meta text-ink-3" title={detail}>{detail}</p>}
      </div>
      {count !== null && (
        <span className={cx('shrink-0 font-mono text-small tabular-nums', on ? 'text-ink-2' : 'text-ink-3')}>
          {count.toLocaleString(t.intl)}
        </span>
      )}
      <Switch id={id} hideLabel label={name} checked={on} onChange={onToggle} className="relative z-[1]" />
    </div>
  );
}

/**
 * Settings that narrow one layer (ship types, underway only), under the layer
 * while it is on. Each type keeps its map colour and, where the data says, how
 * many there are, lined up under the layer's own count.
 */
export function SubFilters({ parentName, layers, activeLayers, parentOn, countOf, onToggle }: {
  parentName: string;
  layers: LayerDef[];
  activeLayers: Record<string, boolean>;
  parentOn: boolean;
  countOf?: (layer: LayerDef) => number | null;
  onToggle: (key: string) => void;
}) {
  const t = useT();
  if (!layers.length) return null;
  const row = (l: LayerDef) => {
    const on = !!activeLayers[l.key];
    const count = countOf?.(l) ?? null;
    const swatch = legendFor(l.key);
    return (
      // The count sits under the parent's: its switch and gap are 42 px past this column's edge.
      <div key={l.key} className={cx('flex min-h-7 items-center gap-3 pr-[42px]', l.description && 'py-1')}>
        <Checkbox
          checked={on}
          onChange={() => onToggle(l.key)}
          description={l.description && t(l.description)}
          className="min-w-0 flex-1"
          label={(
            <span className="flex min-w-0 items-center gap-1.5 text-small text-ink-2">
              {swatch && <LayerSwatch layerKey={l.key} on={parentOn && on} className="-mx-1" />}
              <span className="truncate">{layerName(l, t)}</span>
            </span>
          )}
        />
        {count !== null && (
          <span className={cx('shrink-0 font-mono text-small tabular-nums', parentOn && on ? 'text-ink-2' : 'text-ink-3')}>
            {count.toLocaleString(t.intl)}
          </span>
        )}
      </div>
    );
  };
  // Narrowing options (underway only) read apart from the coloured types they sit above.
  const plain = layers.filter(l => !legendFor(l.key));
  const typed = layers.filter(l => legendFor(l.key));
  return (
    <div className={cx('mb-2 ml-2 flex flex-col gap-1 border-l border-line py-1 pl-[19px]', !parentOn && 'opacity-60')}>
      {!parentOn && <p className="pb-1 text-meta text-ink-3">{t('Applies once {layer} is on', { layer: inSentence(parentName, t) })}</p>}
      {plain.map(row)}
      {plain.length > 0 && typed.length > 0 && <p className="pt-2 text-meta font-medium text-ink-3">{t('By type')}</p>}
      {typed.map(row)}
    </div>
  );
}
