'use client';

import { useMemo } from 'react';
import { Fingerprint } from 'lucide-react';
import { CATEGORIES, type Category } from '@/lib/fingerprint';
import { ACCENT, STATUS_META } from '@/lib/recon-fingerprint';
import type { FingerprintState } from './use-fingerprint-search';
import { FingerprintSearchBar } from './fingerprint-search-bar';
import { FingerprintHistory } from './fingerprint-history';
import { FingerprintUsernameResults } from './fingerprint-username-results';
import { FingerprintSourceResults } from './fingerprint-source-results';

export { useFingerprintSearch } from './use-fingerprint-search';
export type { FingerprintState } from './use-fingerprint-search';

/**
 * RECON → FINGERPRINT. One box, three lookups (username / email / phone),
 * results streamed in as each source answers, then filtered, viewed as cards
 * or a table, and exported. Every source is public: the username sweep reads
 * public profile URLs, email and phone reuse the breach, DNS and numbering-plan
 * lookups the toolkit already runs.
 */

export default function FingerprintSearch({ fp, isFullScreen }: { fp: FingerprintState; isFullScreen: boolean }) {
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

  // Status toggles first, so category counts describe what can be shown.
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

  // Stable sort: hits keep the order they streamed in.
  const visible = useMemo(() => statusFiltered
    .filter(r => fp.categories.length === 0 || fp.categories.includes(r.category))
    .sort((a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank),
  [statusFiltered, fp.categories]);

  const searchBar = <FingerprintSearchBar fp={fp} running={running} />;

  const historyLog = fp.history.length > 0 && !running && <FingerprintHistory fp={fp} isFullScreen={isFullScreen} />;

  /* ── idle ── */
  if (!fp.searched) {
    return (
      <div className="flex flex-col gap-3">
        {searchBar}
        <div className="flex flex-col items-center text-center py-6">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 border border-[var(--border-primary)] bg-[var(--bg-primary)]/60">
            <Fingerprint className="w-4 h-4" style={{ color: ACCENT }} />
          </span>
          <div className="text-[11px] font-mono font-bold tracking-wider text-[var(--text-primary)]">SEARCH PUBLIC PROFILES</div>
          <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">Enter a query above to get started.</div>
        </div>
        {historyLog}
      </div>
    );
  }

  const usernameResults = shownType === 'username' && (
    <FingerprintUsernameResults
      fp={fp} isFullScreen={isFullScreen} running={running}
      all={all} counts={counts} categoryCounts={categoryCounts} visible={visible}
    />
  );

  const sourceResults = shownType !== 'username' && <FingerprintSourceResults fp={fp} isFullScreen={isFullScreen} />;

  return (
    <div className="flex flex-col gap-3">
      {searchBar}
      {fp.searched && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
          <span className="px-1.5 py-0.5 rounded text-[9px] tracking-wider" style={{ color: ACCENT, background: `${ACCENT}1a`, border: `1px solid ${ACCENT}40` }}>
            {fp.searched.type.toUpperCase()}
          </span>
          <span className="text-[var(--text-primary)] truncate">{fp.searched.query}</span>
        </div>
      )}
      {usernameResults}
      {sourceResults}
      {historyLog}
    </div>
  );
}
