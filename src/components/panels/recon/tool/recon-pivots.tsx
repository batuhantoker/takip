'use client';

import { cx, isNumeric } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { detectQuery } from '@/lib/intel/recon/detect-query';
import { toolById } from '@/components/panels/recon/recon-tools';

/** After an answer, the other lookups that fit the same query, so one target can be worked through without retyping it. */
export function ReconPivots({ query, current, onRun }: { query: string; current: string; onRun: (toolId: string) => void }) {
  const q = query.trim();
  const others = detectQuery(q).tools.filter(id => id !== current).map(toolById).filter(t => !!t);
  if (!q || !others.length) return null;
  return (
    <PanelSection title={<>Also look up <span className={cx('text-ink-2', isNumeric(q) && 'font-mono tabular-nums')}>{q}</span></>}>
      {others.map(t => (
        <ListRow key={t.id} compact leading={<t.icon aria-hidden className="size-4" strokeWidth={1.75} />}
          title={t.label} onClick={() => onRun(t.id)} aria-label={`${t.label} for ${q}`} />
      ))}
    </PanelSection>
  );
}
