'use client';

import type { ReactNode } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { isShown, moveBy, setShown, type Form, type PageLayout, type Piece } from '@/components/shell/layout/lib/model';
import { updateLayout } from '@/components/shell/layout/use-page-layout';
import { IconButton } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/components/ui/use-t';

/** On or off for one piece, at once; `label` is already in the reader's language. */
export function ShownSwitch({ layout, form, piece, label }: { layout: PageLayout; form: Form; piece: Piece; label: string }) {
  const t = useT();
  return (
    <Switch size="sm" hideLabel label={t('Show {name}', { name: label })} checked={isShown(layout, form, piece)}
      onChange={on => updateLayout(l => setShown(l, form, piece, on))} />
  );
}

/** A piece that only switches on and off. */
export function PieceRow({ layout, form, piece, label, detail }: { layout: PageLayout; form: Form; piece: Piece; label: string; detail?: string }) {
  return (
    <div className="flex min-h-10 items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-ink-1">{label}</span>
        {detail && <span className="truncate text-small text-ink-3">{detail}</span>}
      </div>
      <ShownSwitch layout={layout} form={form} piece={piece} label={label} />
    </div>
  );
}

export const Subhead = ({ children }: { children: ReactNode }) => <h4 className="mt-1 text-small text-ink-3">{children}</h4>;

/** A list the person puts in order: drag a row by its grip, or move it with the arrows. */
export function OrderList<T extends string>({ items, onOrder, label, row, trailing }: {
  items: T[];
  onOrder: (items: T[]) => void;
  label: (item: T) => string;
  /** The row between the grip and the arrows. */
  row: (item: T) => ReactNode;
  /** After the arrows: its switch. */
  trailing?: (item: T) => ReactNode;
}) {
  const t = useT();
  if (!items.length) return <p className="flex min-h-10 items-center text-small text-ink-4">{t('Nothing here')}</p>;
  return (
    <Reorder.Group as="div" axis="y" values={items} onReorder={onOrder} className="flex flex-col">
      {items.map((item, i) => (
        <OrderRow key={item} item={item} name={label(item)} first={i === 0} last={i === items.length - 1}
          onMove={delta => onOrder(moveBy(items, item, delta))} trailing={trailing?.(item)}>
          {row(item)}
        </OrderRow>
      ))}
    </Reorder.Group>
  );
}

function OrderRow<T extends string>({ item, name, first, last, onMove, trailing, children }: {
  item: T;
  name: string;
  first: boolean;
  last: boolean;
  onMove: (delta: number) => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const drag = useDragControls();
  return (
    <Reorder.Item as="div" value={item} dragListener={false} dragControls={drag} className="relative flex min-h-10 items-center gap-2 rounded-control bg-surface-1">
      <span aria-hidden onPointerDown={e => drag.start(e)} className="-ml-1 flex cursor-grab touch-none items-center text-ink-4 hover:text-ink-2 active:cursor-grabbing">
        <GripVertical className="size-4" strokeWidth={1.75} />
      </span>
      {children}
      <span className="flex shrink-0">
        <IconButton label={t('Move {name} up', { name })} icon={ArrowUp} size="sm" disabled={first} onClick={() => onMove(-1)} />
        <IconButton label={t('Move {name} down', { name })} icon={ArrowDown} size="sm" disabled={last} onClick={() => onMove(1)} />
      </span>
      {trailing}
    </Reorder.Item>
  );
}
