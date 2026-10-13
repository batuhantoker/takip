'use client';

import { useMemo } from 'react';
import { CATEGORIES, type Category } from '@/lib/recon/fingerprint';
import type { FingerprintState } from './use-fingerprint-search';
import { STATUS_META } from '@/lib/recon/fingerprint-rows';
import { FingerprintSearchBar } from './fingerprint-search-bar';
import { FingerprintHistory } from './fingerprint-history';
import { FingerprintUsernameResults } from './fingerprint-username-results';
import { plain } from '@/components/panels/recon/results/result-primitives';
import { FingerprintSourceResults } from './fingerprint-source-results';

export { useFingerprintSearch } from './use-fingerprint-search';
export type { FingerprintState } from './use-fingerprint-search';

/**
 * Recon → Profile search. One box, three lookups (username / email / phone),
 * results streamed in as each source answers. Every source is public.
 */
export default function FingerprintSearch({ fp, isFullScreen, autoFocus }: { fp: FingerprintState; isFullScreen: boolean; autoFocus?: boolean }) {
  const running = fp.phase === 'running';
  const shownType = fp.searched?.type;

  const all = useMemo(() => Object.values(fp.rows), [fp.rows]);
  const counts = useMemo(() => {
    const c = { hits: 0, unsure: 0, blocked: 0 };
    for (const r of all) {
      if (r.status === 'verified' || r.status === 'verifying') c.hits++;
      else if (r.status === 'unverifiable') c.unsure++;
      else c.blocked++;
    }
    return c;
  }, [all]);

  const statusFiltered = useMemo(() => all.filter(r =>
    r.status === 'verified' || r.status === 'verifying' ||
    (fp.showUnsure && r.status === 'unverifiable') ||
    (fp.showBlocked && (r.status === 'blocked' || r.status === 'error'))
  ), [all, fp.showUnsure, fp.showBlocked]);

  const categoryCounts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const r of statusFiltered) m.set(r.category, (m.get(r.category) || 0) + 1);
    return CATEGORIES.filter(c => m.has(c)).map(c => ({ category: c, count: m.get(c)! }));
  }, [statusFiltered]);

  const visible = useMemo(() => statusFiltered
    .filter(r => fp.categories.length === 0 || fp.categories.includes(r.category))
    .sort((a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank),
  [statusFiltered, fp.categories]);

  const historyLog = fp.history.length > 0 && !running && <FingerprintHistory fp={fp} isFullScreen={isFullScreen} />;

  if (!fp.searched) {
    return (
      <div className="flex flex-col gap-5">
        <FingerprintSearchBar fp={fp} running={running} autoFocus={autoFocus} />
        {historyLog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <FingerprintSearchBar fp={fp} running={running} />
      <p className="min-w-0 truncate text-small text-ink-2">
        {plain(fp.searched.type)} <span className="font-medium text-ink-1">{fp.searched.query}</span>
      </p>
      {shownType === 'username'
        ? <FingerprintUsernameResults fp={fp} isFullScreen={isFullScreen} running={running} all={all} counts={counts} categoryCounts={categoryCounts} visible={visible} />
        : <FingerprintSourceResults fp={fp} />}
      {historyLog}
    </div>
  );
}
