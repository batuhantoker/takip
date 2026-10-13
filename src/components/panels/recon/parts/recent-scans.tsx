'use client';

import { Button } from '@/components/ui/button';
import { isNumeric } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { toolById } from '@/components/panels/recon/recon-tools';
import type { HistoryEntry } from '@/components/panels/recon/use-recon-lookup';

const time = (at: number) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

/** The last few lookups, named by what was looked up; one click runs it again. */
export function RecentScans({ history, onPick, onClear, hideTool }: {
  history: HistoryEntry[];
  onPick: (tool: string, query: string) => void;
  /** Left out where the list is filtered, so Clear never wipes more than it shows. */
  onClear?: () => void;
  /** Inside one tool every row is that tool; say it once in the header instead. */
  hideTool?: boolean;
}) {
  return (
    <PanelSection title="Recent" action={onClear && <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>}>
      {history.slice(0, 5).map((h, i) => {
        const t = toolById(h.tool);
        const label = t?.label ?? h.tool;
        return (
          <ListRow key={`${h.tool}-${h.query}-${i}`} compact={hideTool}
            leading={!hideTool && t ? <t.icon aria-hidden className="size-4" strokeWidth={1.75} /> : undefined}
            title={isNumeric(h.query) ? <span className="font-mono tabular-nums">{h.query}</span> : h.query}
            subtitle={hideTool ? undefined : label} meta={time(h.at)} onClick={() => onPick(h.tool, h.query)}
            aria-label={`Run ${label} on ${h.query} again`} />
        );
      })}
    </PanelSection>
  );
}
