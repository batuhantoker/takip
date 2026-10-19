'use client';

import { Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import type { HistorySession } from '@/lib/history/session';
import { CountriesSection } from '@/components/panels/history/parts/history-countries-section';
import { DeepTimeSection } from '@/components/panels/history/parts/history-deep-section';
import { BordersSection, EventsSection, type FlyTo, MomentsSection } from '@/components/panels/history/parts/history-sections';
import { HistoryBackToLive, WhereInTime } from '@/components/panels/history/parts/where-in-time';
import { useHistoryTick } from './use-history';

type Props = {
  onClose: () => void;
  onExit?: () => void;
  onFlyTo?: FlyTo;
  /** Body only, for the phone's sheet, which has its own title and close. */
  embedded?: boolean;
};

function Sections({ session, onFlyTo }: { session: HistorySession; onFlyTo?: FlyTo }) {
  useHistoryTick(session, { clocks: false });
  if (session.deep()) return <DeepTimeSection session={session} />;
  return (
    <>
      <EventsSection session={session} />
      <BordersSection session={session} onFlyTo={onFlyTo} />
      <CountriesSection session={session} />
      <MomentsSection session={session} onFlyTo={onFlyTo} />
      <DeepTimeSection session={session} />
    </>
  );
}

/** The History tab: what the historical map shows. The mode starts when the tab opens and ends with "Back to live". */
export default function HistoryPanel({ session, onOpen, onClose, onExit, onFlyTo, embedded }: Props & { session: HistorySession | null; onOpen: () => void }) {
  const t = useT();
  if (session) {
    if (embedded) return <Sections session={session} onFlyTo={onFlyTo} />;
    return (
      <Panel title={t('History')} subtitle={<WhereInTime session={session} />} onClose={onClose} actions={onExit && <HistoryBackToLive onExit={onExit} />}>
        <Sections session={session} onFlyTo={onFlyTo} />
      </Panel>
    );
  }
  const empty = (
    <EmptyState icon={Hourglass} title={t('See the world at another time')}
      body={t('Wars, battles and country statistics back to 10,000 BCE, and the continents drifting over 1.8 billion years.')}
      action={<Button variant="primary" onClick={onOpen}>{t('Show history on the map')}</Button>} />
  );
  return embedded ? empty : <Panel title={t('History')} onClose={onClose}>{empty}</Panel>;
}
