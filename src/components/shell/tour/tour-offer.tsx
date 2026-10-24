'use client';

import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { cx, ENTER } from '@/components/ui/class-names';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';
import { countAction } from '@/lib/platform/usage-actions';
import { markTourSeen, startTour, tourSeen, useTourAt } from './tour-state';

// The middle of the map, clear of the bottom corners' pieces.
const PLACE: CSSProperties = {
  left: 'calc(var(--shell-left, 0px) + (100% - var(--shell-left, 0px)) / 2)',
  bottom: 'calc(var(--shell-foot, 28px) + 72px)',
};

/** Once, on a first visit to the plain map: a shared link already says where to look. */
export default function TourOffer({ ready }: { ready: boolean }) {
  const t = useT();
  const id = useId();
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
    <div role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} style={PLACE}
      className={cx(
        'absolute z-[500] w-[340px] -translate-x-1/2',
        'rounded-float border border-line bg-surface-1 p-4 shadow-float starting:translate-y-1', ENTER,
      )}>
      <h2 id={`${id}-title`} className="text-title font-semibold text-ink-1">{t('New here?')}</h2>
      <p id={`${id}-body`} className="mt-1.5 text-body text-ink-2">
        {t('A one-minute look at what is where: your layout, base maps, layers, History, Space, Recon and TI. It stays in TI, under How to use TAKIP.')}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={notNow}>{t('Not now')}</Button>
        <Button variant="primary" size="sm" onClick={() => startTour()}>{t('Show me around')}</Button>
      </div>
    </div>
  );
}
