'use client';

import { Button } from '@/components/ui/button';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';
import { STOPS } from './lib/stops';
import { TourNote } from './parts/tour-note';
import { forgetStop, resumeTour, useTourStopped } from './tour-state';

/** The first time someone stops the tour early: carry on from there, or leave it for TI's How to. */
export default function TourResume() {
  const t = useT();
  const stopped = useTourStopped();
  const open = !!stopped?.ask;
  useEscape(forgetStop, open);
  if (!stopped || !open) return null;

  return (
    <TourNote title={t('Back to the tour?')}
      body={t('You stopped at {stop}, {n} of {count}. Carry on from there, or find the tour any time in TI, under How to use TAKIP.', {
        stop: t(STOPS[stopped.at].title), n: stopped.at + 1, count: STOPS.length,
      })}
      actions={(
        <>
          <Button variant="ghost" size="sm" onClick={forgetStop}>{t('Not now')}</Button>
          <Button variant="primary" size="sm" onClick={resumeTour}>{t('Back to the tour')}</Button>
        </>
      )} />
  );
}
