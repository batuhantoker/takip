'use client';

import { Button } from '@/components/ui/button';
import { isNumeric } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import { toolById } from '@/components/panels/recon/recon-tools';
import type { HistoryEntry } from '@/components/panels/recon/use-recon-lookup';

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export const timeAgo = (at: number, t: Translate) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return t('just now');
  if (m < 60) return t('{n} min ago', { n: m });
  const h = Math.round(m / 60);
  return h < 24 ? t('{n} h ago', { n: h }) : t('{n} d ago', { n: Math.round(h / 24) });
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
  const t = useT();
  return (
    <PanelSection title={t('Recent')} action={onClear && <Button variant="ghost" size="sm" onClick={onClear}>{t('Clear')}</Button>}>
      {history.slice(0, 5).map((h, i) => {
        const tool = toolById(h.tool);
        const label = tool ? t(tool.label) : h.tool;
        return (
          <ListRow key={`${h.tool}-${h.query}-${i}`} compact={hideTool}
            leading={!hideTool && tool ? <tool.icon aria-hidden className="size-4" strokeWidth={1.75} /> : undefined}
            title={isNumeric(h.query) ? <span className="font-mono tabular-nums">{h.query}</span> : h.query}
            subtitle={hideTool ? undefined : label} meta={timeAgo(h.at, t)} onClick={() => onPick(h.tool, h.query)}
            aria-label={t('Run {tool} on {query} again', { tool: label, query: h.query })} />
        );
      })}
    </PanelSection>
  );
}
