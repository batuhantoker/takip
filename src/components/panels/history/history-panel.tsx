'use client';

import { Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { Dot } from '@/components/ui/tag';
import type { HistorySession } from '@/lib/history/session';
import { longMa, maAt, periodAt } from '@/lib/paleo/deep-time';
import { CHAPTERS } from '@/lib/paleo/story';
import { longDate } from '@/components/panels/history/lib/format-date';
import { CountriesSection } from '@/components/panels/history/parts/history-countries-section';
import { DeepTimeSection } from '@/components/panels/history/parts/history-deep-section';
import { BordersSection, EventsSection, type FlyTo, MomentsSection } from '@/components/panels/history/parts/history-sections';
import { useHistoryTick } from './use-history';

type Props = { onClose: () => void; onExit?: () => void; onFlyTo?: FlyTo };

/** Where the clock stands, in words: "Showing 2 October 1914", "250 million years ago · Triassic". Ticks with the timeline so the two agree. */
function WhereInTime({ session }: { session: HistorySession }) {
  useHistoryTick(session);
  if (!session.deep()) return <>Showing {longDate(session.clock.time())}</>;
  const ma = maAt(session.deepClock.time());
  const open = session.story.index();
  return <>{open === null ? `${longMa(ma)} · ${periodAt(ma).name}` : `${CHAPTERS[open].title} · ${longMa(ma)}`}</>;
}

function SessionPanel({ session, onClose, onExit, onFlyTo }: Props & { session: HistorySession }) {
  useHistoryTick(session, { clocks: false });
  return (
    <Panel title="History" subtitle={<WhereInTime session={session} />} onClose={onClose}
      actions={onExit && (
        <Button variant="ghost" size="sm" onClick={onExit}>
          <Dot tone="green" />
          Back to live
        </Button>
      )}>
      {session.deep() ? <DeepTimeSection session={session} /> : (
        <>
          <EventsSection session={session} />
          <BordersSection session={session} onFlyTo={onFlyTo} />
          <CountriesSection session={session} />
          <MomentsSection session={session} onFlyTo={onFlyTo} />
          <DeepTimeSection session={session} />
        </>
      )}
    </Panel>
  );
}

/** The History tab: what the historical map shows. The mode starts when the tab opens and ends with "Back to live". */
export default function HistoryPanel({ session, onOpen, ...props }: Props & { session: HistorySession | null; onOpen: () => void }) {
  if (session) return <SessionPanel session={session} {...props} />;
  return (
    <Panel title="History" onClose={props.onClose}>
      <EmptyState icon={Hourglass} title="See the world at another time"
        body="Wars, battles and country statistics back to 10,000 BCE, and the continents drifting over 1.8 billion years."
        action={<Button variant="primary" onClick={onOpen}>Show history on the map</Button>} />
    </Panel>
  );
}
