'use client';

import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import { relativeTime, type HistoryEntry } from '@/lib/intel/recon/fingerprint/search';
import type { FingerprintState } from './use-fingerprint-search';
import { SEARCH_TYPE_LABEL } from './fingerprint-status';

const TONE = { done: 'green', stopped: 'amber', fail: 'red' } as const;

/** What the search found, in the words of its own kind of search. */
function outcome(h: HistoryEntry, t: Translate): string {
  if (h.status === 'fail') return t('didn’t finish');
  const found = h.type === 'phone' ? (h.count ? t('valid number') : t('not a valid number'))
    : h.type === 'email' ? (h.count ? t('{n, plural, one {in # breach} other {in # breaches}}', { n: h.count }) : t('no known breaches'))
    : h.count ? t('{n, plural, one {# profile} other {# profiles}}', { n: h.count }) : t('no profiles');
  return h.status === 'stopped' ? t('stopped · {found}', { found }) : found;
}

export function FingerprintHistory({ fp, isFullScreen }: { fp: FingerprintState; isFullScreen: boolean }) {
  const t = useT();
  return (
    <PanelSection title={t('Recent searches')} hint={fp.history.length}
      action={<Button variant="ghost" size="sm" onClick={fp.clearHistory}>{t('Clear')}</Button>}>
      {fp.history.slice(0, isFullScreen ? 12 : 6).map((h, i) => (
        <ListRow key={`${h.at}-${i}`} compact
          leading={<Dot tone={TONE[h.status as keyof typeof TONE] ?? 'muted'} />}
          title={h.query} subtitle={`${t(SEARCH_TYPE_LABEL[h.type])} · ${outcome(h, t)}`}
          meta={relativeTime(h.at, undefined, t)} onClick={() => fp.run(h.type, h.query)} />
      ))}
    </PanelSection>
  );
}
