'use client';

import { Button } from '@/components/ui/button';
import { Dot } from '@/components/ui/tag';
import { allProjectedAt, projectedAt } from '@/lib/history/projection';
import type { HistorySession } from '@/lib/history/session';
import { longMa, maAt, periodAt } from '@/lib/history/paleo/deep-time';
import { CHAPTERS } from '@/lib/history/paleo/story';
import { longDate, shortDate } from '@/components/panels/history/lib/format-date';
import { useHistoryTick } from '@/components/panels/history/use-history';

/** Where the clock stands, in words: "Showing 2 October 1914", "250 million years ago · Triassic". Ticks with the timeline so the two agree. */
export function WhereInTime({ session }: { session: HistorySession }) {
  useHistoryTick(session);
  if (!session.deep()) {
    const t = session.clock.time();
    const projection = session.countries.projection();
    // The short date leaves room for the tag in the panel's subtitle.
    if (!projectedAt(projection, t)) return <>Showing {longDate(t)}</>;
    return <>Showing {shortDate(t)} · {allProjectedAt(projection, t) ? 'projected' : 'partly projected'}</>;
  }
  const ma = maAt(session.deepClock.time());
  const open = session.story.index();
  return <>{open === null ? `${longMa(ma)} · ${periodAt(ma).name}` : `${CHAPTERS[open].title} · ${longMa(ma)}`}</>;
}

export function HistoryBackToLive({ onExit }: { onExit: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onExit}>
      <Dot tone="green" />
      Back to live
    </Button>
  );
}
