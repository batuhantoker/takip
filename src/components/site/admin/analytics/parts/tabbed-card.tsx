'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Segmented, segmentId } from '@/components/ui/segmented';

export type CardTab = { id: string; label: string; note?: ReactNode; body: ReactNode };

/** One card, several views of the same question (countries or cities, browsers or systems), switched in its header. */
export function TabbedCard({ title, tabs }: { title: string; tabs: CardTab[] }) {
  const id = useId();
  const [open, setOpen] = useState(tabs[0].id);
  const tab = tabs.find(t => t.id === open) ?? tabs[0];
  return (
    <ChartCard
      title={title}
      note={tab.note}
      actions={<Segmented size="sm" semantics="tabs" id={id} label={title} value={tab.id} onChange={setOpen} options={tabs.map(t => ({ value: t.id, label: t.label }))} />}
    >
      <div role="tabpanel" aria-labelledby={segmentId(id, tab.id)}>{tab.body}</div>
    </ChartCard>
  );
}
