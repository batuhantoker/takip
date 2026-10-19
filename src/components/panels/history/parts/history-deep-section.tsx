'use client';

import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import type { HistorySession } from '@/lib/history/session';
import { CHAPTERS } from '@/lib/history/paleo/story';
import { HistoryCard } from './history-card';

/** The continental-drift documentary, and free play along the deep clock. */
export function DeepTimeSection({ session }: { session: HistorySession }) {
  const t = useT();
  const age = (ma: number) => (ma === 0 ? t('Now') : `${ma.toLocaleString(t.intl)} Ma`);
  const { story } = session;
  const deep = session.deep();
  const open = story.index();
  const playing = open !== null && story.auto();

  return (
    <PanelSection title={t('Deep time')} hint={t('{n, plural, one {# chapter} other {# chapters}}', { n: CHAPTERS.length })}>
      <HistoryCard title={t('How the continents moved')}
        body={t("1.8 billion years of drifting plates, with Earth's temperature and CO₂ for the last 485 million.")}>
        {playing ? (
          <Button variant="primary" size="sm" icon={Pause} onClick={() => story.setAuto(false)}>{t('Pause the story')}</Button>
        ) : (
          <Button variant="primary" size="sm" icon={Play} onClick={() => { story.setAuto(true); if (open === null) story.go(0); }}>
            {open === null ? t('Play the story') : t('Resume the story')}
          </Button>
        )}
        {deep ? (
          <Button variant="ghost" size="sm" onClick={() => session.setDeep(false)}>{t('Back to the calendar')}</Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => { session.setDeep(true); session.deepClock.play(); }}>{t('Watch the plates move')}</Button>
        )}
      </HistoryCard>
      {/* Chapters only in deep time, so the calendar's panel stays short. */}
      {deep && (
        <>
          <ol className="mt-3 flex flex-col">
            {CHAPTERS.map((c, i) => (
              <li key={c.title}>
                <ListRow compact title={t(c.title)} trailing={age(c.ma)} selected={i === open} onClick={() => story.go(i)} />
              </li>
            ))}
          </ol>
          <p className="mt-3 text-meta text-ink-3">{t('Events, borders and country colours come back with the calendar.')}</p>
        </>
      )}
    </PanelSection>
  );
}
