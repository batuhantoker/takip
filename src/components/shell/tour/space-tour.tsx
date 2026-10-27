'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';
import { countAction } from '@/lib/platform/usage-actions';
import { TourLayer } from './parts/tour-layer';
import { TourNote } from './parts/tour-note';
import { markTourSeen, quitTour, startTour, tourSeen, useTourAt, useTourName } from './tour-state';

const OFFER_DELAY_MS = 1200;

/** The space view's tour, over everything while it runs; it ends when the view does. */
export function SpaceTour() {
  const at = useTourAt();
  const mine = useTourName() === 'space';
  useEffect(() => () => quitTour('space'), []);
  return mine && at !== null ? <TourLayer at={at} /> : null;
}

/** Once per browser, a moment after arriving in space: a quick look at how to get around out here. */
export function SpaceTourOffer({ ready }: { ready: boolean }) {
  const t = useT();
  const [show, setShow] = useState(false);
  const touring = useTourAt() !== null;
  // It steps aside while a card is open and comes back after; that is still one offer.
  const offered = useRef(false);

  useEffect(() => {
    if (!ready || tourSeen('space')) return;
    const timer = setTimeout(() => {
      setShow(true);
      if (!offered.current) countAction('space_tour.offer');
      offered.current = true;
    }, OFFER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready]);
  if (show && (touring || !ready)) setShow(false);

  const notNow = () => { markTourSeen('space'); setShow(false); countAction('space_tour.decline'); };
  useEscape(notNow, show);
  if (!show) return null;

  return (
    <TourNote title={t('You’re in space')}
      body={t('Everything here is where it really is right now. A quick look at how to fly from here to the edge of the universe and back.')}
      actions={(
        <>
          <Button variant="ghost" size="sm" onClick={notNow}>{t('Not now')}</Button>
          <Button variant="primary" size="sm" onClick={() => startTour(0, null, 'space')}>{t('Learn how it works')}</Button>
        </>
      )} />
  );
}

/** The way back into the space tour once the offer is gone. */
export function SpaceHowItWorks() {
  const t = useT();
  return <IconButton icon={CircleHelp} label={t('How the space view works')} tooltipSide="right" onClick={() => startTour(0, null, 'space')} />;
}
