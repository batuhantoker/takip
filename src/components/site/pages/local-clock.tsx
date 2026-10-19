'use client';

import { Fragment, useSyncExternalStore } from 'react';
import { CLOCK_FORMAT, isInstant, utcText, type Instant, type Spoken } from '@/lib/platform/site/clock';

const never = () => () => {};

/** A moment in the reader's own clock. The server renders it in UTC, marked so; the browser swaps in its zone after hydrating. */
export function LocalClock({ at, show = 'time', intl, className }: Partial<Pick<Instant, 'show'>> & Pick<Instant, 'at'> & { intl: string; className?: string }) {
  const hydrated = useSyncExternalStore(never, () => true, () => false);
  const utc = utcText({ at, show }, intl);
  return (
    <time dateTime={new Date(at).toISOString()} title={hydrated && show === 'time' ? utc : undefined} className={className}>
      {hydrated ? new Intl.DateTimeFormat(intl, CLOCK_FORMAT[show]).format(at) : utc}
    </time>
  );
}

/** Text from lib with its moments shown in the reader's clock. */
export function SpokenText({ parts, intl, className }: { parts: Spoken; intl: string; className?: string }) {
  return parts.map((p, i) => (isInstant(p)
    ? <LocalClock key={i} at={p.at} show={p.show} intl={intl} className={className} />
    : <Fragment key={i}>{p}</Fragment>));
}
