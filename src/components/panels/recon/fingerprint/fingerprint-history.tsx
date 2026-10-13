'use client';

import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Dot } from '@/components/ui/tag';
import { relativeTime, type HistoryEntry } from '@/lib/recon/fingerprint';
import type { FingerprintState } from './use-fingerprint-search';
import { plain } from '@/components/panels/recon/results/result-primitives';

const TONE = { done: 'green', stopped: 'amber', fail: 'red' } as const;

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** What the search found, in the words of its own kind of search. */
function outcome(h: HistoryEntry): string {
  if (h.status === 'fail') return 'didn’t finish';
  const found = h.type === 'phone' ? (h.count ? 'valid number' : 'not a valid number')
    : h.type === 'email' ? (h.count ? `in ${plural(h.count, 'breach', 'breaches')}` : 'no known breaches')
    : h.count ? plural(h.count, 'profile', 'profiles') : 'no profiles';
  return h.status === 'stopped' ? `stopped · ${found}` : found;
}

export function FingerprintHistory({ fp, isFullScreen }: { fp: FingerprintState; isFullScreen: boolean }) {
  return (
    <PanelSection title="Recent searches" hint={fp.history.length}
      action={<Button variant="ghost" size="sm" onClick={fp.clearHistory}>Clear</Button>}>
      {fp.history.slice(0, isFullScreen ? 12 : 6).map((h, i) => (
        <ListRow key={`${h.at}-${i}`} compact
          leading={<Dot tone={TONE[h.status as keyof typeof TONE] ?? 'muted'} />}
          title={h.query} subtitle={`${plain(h.type)} · ${outcome(h)}`}
          meta={relativeTime(h.at)} onClick={() => fp.run(h.type, h.query)} />
      ))}
    </PanelSection>
  );
}
