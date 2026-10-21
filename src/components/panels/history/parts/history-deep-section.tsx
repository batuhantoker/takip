'use client';

import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import type { HistorySession } from '@/lib/history/session';
import { CHAPTERS } from '@/lib/history/paleo/story';
import { playStory } from '@/components/panels/history/lib/history-plays';
import { HistoryCard } from './history-card';

/** In deep time: the continental-drift documentary and its chapters. `onStart` runs after anything that sets the map moving. */
export function DeepTimeSection({ session, onStart }: { session: HistorySession; onStart?: () => void }) {
  const t = useT();
  const age = (ma: number) => (ma === 0 ? t('Now') : `${ma.toLocaleString(t.intl)} Ma`);
  const { story } = session;
  const open = story.index();
  const playing = open !== null && story.auto();

  return (
    <PanelSection title={t('Deep time')} hint={t('{n, plural, one {# chapter} other {# chapters}}', { n: CHAPTERS.length })}>
      <HistoryCard title={t('How the continents moved')}
        body={t("1.8 billion years of drifting plates, with Earth's temperature and CO₂ for the last 485 million.")}>
        {playing ? (
          <Button variant="primary" size="sm" icon={Pause} onClick={() => story.setAuto(false)}>{t('Pause the story')}</Button>
        ) : (
          <Button variant="primary" size="sm" icon={Play} onClick={() => { playStory(session); onStart?.(); }}>
            {open === null ? t('Play the story') : t('Resume the story')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => session.setDeep(false)}>{t('Back to the calendar')}</Button>
      </HistoryCard>
      <ol className="mt-3 flex flex-col">
        {CHAPTERS.map((c, i) => (
          <li key={c.title}>
            <ListRow compact title={t(c.title)} trailing={age(c.ma)} selected={i === open} onClick={() => { story.go(i); onStart?.(); }} />
          </li>
        ))}
      </ol>
      <p className="mt-3 text-meta text-ink-3">{t('Events, borders and country colours come back with the calendar.')}</p>
    </PanelSection>
  );
}
