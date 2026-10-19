'use client';

import { cx, isNumeric } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { detectQuery } from '@/lib/intel/recon/detect-query';
import { toolById } from '@/components/panels/recon/recon-tools';

/** After an answer, the other lookups that fit the same query, so one target can be worked through without retyping it. */
export function ReconPivots({ query, current, onRun }: { query: string; current: string; onRun: (toolId: string) => void }) {
  const t = useT();
  const q = query.trim();
  const others = detectQuery(q).tools.filter(id => id !== current).map(toolById).filter(tool => !!tool);
  if (!q || !others.length) return null;
  return (
    <PanelSection title={t.rich('Also look up {query}', { query: <span className={cx('text-ink-2', isNumeric(q) && 'font-mono tabular-nums')}>{q}</span> })}>
      {others.map(tool => (
        <ListRow key={tool.id} compact leading={<tool.icon aria-hidden className="size-4" strokeWidth={1.75} />}
          title={t(tool.label)} onClick={() => onRun(tool.id)} aria-label={t('{tool} for {query}', { tool: t(tool.label), query: q })} />
      ))}
    </PanelSection>
  );
}
