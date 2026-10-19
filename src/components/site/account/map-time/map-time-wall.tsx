'use client';

import { useId } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import { showAccountDialog } from '../account-dialog-state';
import { useSignedIn } from '../plan-gate';
import { usePlans } from '../use-access';
import { useMapTime } from './use-map-time';

/** "5 h 12 min" until `iso`. */
function until(iso: string, t: Translate, now = Date.now()) {
  const left = Math.max(1, Math.round((Date.parse(iso) - now) / 60_000));
  const h = Math.floor(left / 60);
  return h ? t('{h} h {m} min', { h, m: left % 60 }) : t('{m} min', { m: left });
}

function visitorBody(limit: number, free: number | undefined, t: Translate) {
  const used = t("{n, plural, one {You've used the # minute visitors get each day.} other {You've used the # minutes visitors get each day.}}", { n: limit });
  if (free === 0) return `${used} ${t('A free account has no time limit.')}`;
  if (free) return `${used} ${t('{n, plural, one {A free account gets # minute a day.} other {A free account gets # minutes a day.}}', { n: free })}`;
  return used;
}

/**
 * Covers the map once today's minutes run out (the plan's map.minutes_per_day). Visitors are offered a free
 * account, members their plans. Under the account dialog, so its buttons open on top of it.
 */
export default function MapTimeWall({ features }: { features?: readonly string[] }) {
  const t = useT();
  const time = useMapTime(features);
  const signedIn = useSignedIn();
  const plans = usePlans();
  const titleId = useId();
  if (!time?.blocked || typeof document === 'undefined') return null;

  const free = plans?.find(p => p.id === 'free')?.entitlements['map.minutes_per_day'];
  const back = t('The map opens again at 00:00 UTC, in {time}.', { time: until(time.resetsAt, t) });
  const title = signedIn ? t("That's today's map time") : t('Create a free account to keep going');
  const body = signedIn
    ? `${t("{n, plural, one {You've used today's # minute on the map.} other {You've used today's # minutes on the map.}}", { n: time.limit })} ${back}`
    : visitorBody(time.limit, free, t);

  return createPortal(
    <div className="fixed inset-0 z-[990] flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-surface-0/80 backdrop-blur-sm" />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="relative flex w-full max-w-[380px] flex-col gap-3 rounded-float border border-line bg-surface-1 p-4 shadow-float">
        <h2 id={titleId} className="text-title font-semibold text-ink-1">{title}</h2>
        <p className="text-body text-ink-2">{body}</p>
        {signedIn ? (
          <Button variant="primary" className="w-full" onClick={() => showAccountDialog({ kind: 'settings', tab: 'account' })}>{t('See plans')}</Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="w-full" onClick={() => showAccountDialog({ kind: 'sign-up' })}>{t('Create account')}</Button>
            <Button className="w-full" onClick={() => showAccountDialog({ kind: 'sign-in' })}>{t('Sign in')}</Button>
            <p className="text-small text-ink-3">{back}</p>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
