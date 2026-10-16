'use client';

import { useId } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { showAccountDialog } from '../account-dialog-state';
import { useSignedIn } from '../plan-gate';
import { usePlans } from '../use-access';
import { useMapTime } from './use-map-time';

const minutes = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;

/** "5 h 12 min" until `iso`. */
function until(iso: string, now = Date.now()) {
  const left = Math.max(1, Math.round((Date.parse(iso) - now) / 60_000));
  const h = Math.floor(left / 60);
  return h ? `${h} h ${left % 60} min` : `${left} min`;
}

/**
 * Covers the map once today's minutes run out (the plan's map.minutes_per_day). Visitors are offered a free
 * account, members their plans. Under the account dialog, so its buttons open on top of it.
 */
export default function MapTimeWall() {
  const time = useMapTime();
  const signedIn = useSignedIn();
  const plans = usePlans();
  const titleId = useId();
  if (!time?.blocked || typeof document === 'undefined') return null;

  const free = plans?.find(p => p.id === 'free')?.entitlements['map.minutes_per_day'];
  const back = `The map opens again at 00:00 UTC, in ${until(time.resetsAt)}.`;
  const title = signedIn ? "That's today's map time" : 'Create a free account to keep going';
  const body = signedIn
    ? `You've used today's ${minutes(time.limit)} on the map. ${back}`
    : `You've used the ${minutes(time.limit)} visitors get each day. ${free === 0 ? 'A free account has no time limit.' : free ? `A free account gets ${minutes(free)} a day.` : ''}`;

  return createPortal(
    <div className="fixed inset-0 z-[990] flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-surface-0/80 backdrop-blur-sm" />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="relative flex w-full max-w-[380px] flex-col gap-3 rounded-float border border-line bg-surface-1 p-4 shadow-float">
        <h2 id={titleId} className="text-title font-semibold text-ink-1">{title}</h2>
        <p className="text-body text-ink-2">{body}</p>
        {signedIn ? (
          <Button variant="primary" className="w-full" onClick={() => showAccountDialog({ kind: 'settings', tab: 'account' })}>See plans</Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="w-full" onClick={() => showAccountDialog({ kind: 'sign-up' })}>Create account</Button>
            <Button className="w-full" onClick={() => showAccountDialog({ kind: 'sign-in' })}>Sign in</Button>
            <p className="text-small text-ink-3">{back}</p>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
