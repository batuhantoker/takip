'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';
import { countAction } from '@/lib/platform/usage-actions';
import { TourNote } from './parts/tour-note';
import { markTourSeen, startTour, tourSeen, useTourAt } from './tour-state';

/** Once, on a first visit to the plain map: a shared link already says where to look. */
export default function TourOffer({ ready }: { ready: boolean }) {
  const t = useT();
  const [show, setShow] = useState(false);
  // As opened: the map writes its own ?layers= in once it starts.
  const [shared] = useState(() => typeof window !== 'undefined' && !!window.location.search);
  const touring = useTourAt() !== null;

  useEffect(() => {
    if (!ready || shared || tourSeen()) return;
    const timer = setTimeout(() => { setShow(true); countAction('tour.offer'); }, 800);
    return () => clearTimeout(timer);
  }, [ready, shared]);
  // Started from TI instead: this is answered.
  if (touring && show) setShow(false);

  const notNow = () => { markTourSeen(); setShow(false); countAction('tour.decline'); };
  useEscape(notNow, show);
  if (!show) return null;

  return (
    <TourNote title={t('New here?')}
      body={t('A one-minute look at what is where: your layout, base maps, layers, History, Space, Recon and TI. It stays in TI, under How to use TAKIP.')}
      actions={(
        <>
          <Button variant="ghost" size="sm" onClick={notNow}>{t('Not now')}</Button>
          <Button variant="primary" size="sm" onClick={() => startTour()}>{t('Show me around')}</Button>
        </>
      )} />
  );
}
