'use client';

import { CircleHelp, Play } from 'lucide-react';
import { useRemembered } from '@/components/map/replay/use-remembered';
import { Button, IconButton } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { Kbd } from '@/components/ui/kbd';
import { ListRow } from '@/components/ui/list-row';
import { useT } from '@/components/ui/use-t';
import { STOPS, type StopId } from './lib/stops';
import { startTour } from './tour-state';

const FOLD = ['open', 'closed'] as const;

/** TI's How to: the tour from the start, or from any of its stops. */
export function HowTo() {
  const t = useT();
  const [fold, setFold] = useRemembered('takip.tour.howto', 'closed', FOLD);
  return (
    <Disclosure icon={CircleHelp} title={t('How to use TAKIP')}
      open={fold === 'open'} onOpenChange={o => setFold(o ? 'open' : 'closed')}
      action={<Button variant="ghost" size="sm" icon={Play} onClick={() => startTour()}>{t('Take the tour')}</Button>}>
      <p className="mb-1 text-small text-ink-2">{t('Start anywhere. Any key or click goes on, ← goes back and Esc stops.')}</p>
      <ul className="flex flex-col">
        {STOPS.map((s, i) => (
          <li key={s.id}>
            <ListRow title={t(s.title)} subtitle={t(s.hint)} trailing={s.kbd && <Kbd>{s.kbd}</Kbd>} onClick={() => startTour(i)} />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

/** A panel's own way into the tour: a look through what is inside it, then on to the next stop. */
export function HowThisWorks({ stop }: { stop: StopId }) {
  const t = useT();
  return <IconButton label={t('How this works')} icon={CircleHelp} onClick={() => startTour(STOPS.findIndex(s => s.id === stop), 0)} />;
}
