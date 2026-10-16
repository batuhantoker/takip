'use client';
/** TAKIP TI: the forecasts this browser has run, newest first. */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Dot } from '@/components/ui/tag';
import type { AiClient } from '@/components/panels/ti-agent/use-ai';
import { ago, pct, sentence } from '../theme';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

const STATUS: Record<string, string> = { running: 'Running', failed: 'Failed', cancelled: 'Stopped' };
const SHOWN = 5;

export function HistoryList({ ai, onPick }: { ai: AiClient; onPick: (id: string) => void }) {
  const [all, setAll] = useState(false);
  if (!ai.history.length) return null;
  const rows = all ? ai.history : ai.history.slice(0, SHOWN);
  return (
    <PanelSection title="Your forecasts" hint={ai.history.length}
      action={ai.history.length > SHOWN ? <Button variant="ghost" size="sm" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : 'Show all'}</Button> : undefined}>
      {rows.map(h => {
        const answer = h.answer ? sentence(h.answer) : h.probability !== null ? pct(h.probability) : '';
        return (
          <ListRow key={h.id} title={h.question} onClick={() => onPick(h.id)}
            leading={h.status === 'running' ? <Dot tone="gold" pulse label="Running" /> : undefined}
            subtitle={(
              <>
                {answer && <><span className="text-ink-1"><Figures text={answer} /></span> · </>}
                {[STATUS[h.status], ago(h.at)].filter(Boolean).join(' · ')}
              </>
            )}
            trailing={<IconButton size="sm" label="Remove from this list" icon={X} onClick={() => ai.forget(h.id)} className="-mr-1 text-ink-4 group-hover/row:text-ink-2" />} />
        );
      })}
    </PanelSection>
  );
}
