'use client';
/** TAKIP TI: the forecasts this browser has run, newest first. */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { AiClient } from '@/components/panels/ti-agent/use-ai';
import { ago, pct, sentence } from '../theme';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

const STATUS: Record<string, string> = { running: msg('Running'), failed: msg('Failed'), cancelled: msg('Stopped') };
const SHOWN = 5;

export function HistoryList({ ai, onPick }: { ai: AiClient; onPick: (id: string) => void }) {
  const t = useT();
  const [all, setAll] = useState(false);
  if (!ai.history.length) return null;
  const rows = all ? ai.history : ai.history.slice(0, SHOWN);
  return (
    <PanelSection title={t('Your forecasts')} hint={ai.history.length}
      action={ai.history.length > SHOWN ? <Button variant="ghost" size="sm" onClick={() => setAll(v => !v)}>{all ? t('Show fewer') : t('Show all')}</Button> : undefined}>
      {rows.map(h => {
        const answer = h.answer ? sentence(h.answer, t) : h.probability !== null ? pct(h.probability) : '';
        return (
          <ListRow key={h.id} title={h.question} onClick={() => onPick(h.id)}
            leading={h.status === 'running' ? <Dot tone="gold" pulse label={t('Running')} /> : undefined}
            subtitle={(
              <>
                {answer && <><span className="text-ink-1"><Figures text={answer} /></span> · </>}
                {[STATUS[h.status] ? t(STATUS[h.status]) : '', ago(h.at, t)].filter(Boolean).join(' · ')}
              </>
            )}
            trailing={<IconButton size="sm" label={t('Remove from this list')} icon={X} onClick={() => ai.forget(h.id)} className="-mr-1 text-ink-4 group-hover/row:text-ink-2" />} />
        );
      })}
    </PanelSection>
  );
}
