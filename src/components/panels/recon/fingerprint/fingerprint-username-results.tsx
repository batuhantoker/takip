'use client';

import { CheckCircle, Download, ExternalLink, LayoutGrid, Loader2, Table2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Segmented } from '@/components/ui/segmented';
import { Stat } from '@/components/ui/stat';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { ReactNode } from 'react';
import { toCsv, type Category } from '@/lib/recon/fingerprint';
import { STATUS_META, download, bareUrl, type Row } from '@/lib/recon/fingerprint-rows';
import { StatusPill, PlatformTile } from './fingerprint-parts';
import type { FingerprintState } from './use-fingerprint-search';

function CategoryChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cx('inline-flex h-6 items-center gap-1.5 rounded-control border px-2 text-meta font-medium',
        on ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
      {children}
    </button>
  );
}

export function FingerprintUsernameResults({ fp, isFullScreen, running, all, counts, categoryCounts, visible }: {
  fp: FingerprintState;
  isFullScreen: boolean;
  running: boolean;
  all: Row[];
  counts: { hits: number; unsure: number; blocked: number };
  categoryCounts: { category: Category; count: number }[];
  visible: Row[];
}) {
  const toggleCategory = (c: Category) =>
    fp.setCategories(fp.categories.includes(c) ? fp.categories.filter(x => x !== c) : [...fp.categories, c]);

  const exportRows = (format: 'csv' | 'json') => {
    if (!fp.searched) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const base = `fingerprint-${fp.searched.query.replace(/[^A-Za-z0-9._-]/g, '_')}-${stamp}`;
    const rows = Object.values(fp.rows);
    if (format === 'json') {
      download(`${base}.json`, JSON.stringify({
        query: fp.searched.query, type: fp.searched.type, exported_at: new Date().toISOString(), platforms_checked: fp.progress.checked,
        results: rows.map(r => ({ platform: r.site, category: r.category, status: STATUS_META[r.status].label.toLowerCase(), url: r.url, http_status: r.http_status ?? null, response_ms: r.ms, note: r.reason ?? null })),
      }, null, 2), 'application/json');
    } else {
      download(`${base}.csv`, toCsv(
        ['platform', 'category', 'status', 'url', 'http_status', 'response_ms'],
        rows.map(r => [r.site, r.category, STATUS_META[r.status].label.toLowerCase(), r.url, r.http_status ?? '', r.ms]),
      ), 'text/csv');
    }
  };

  const pct = fp.progress.total ? Math.round((fp.progress.checked / fp.progress.total) * 100) : 0;
  const seconds = (fp.elapsedMs / 1000).toFixed(1);

  const progress = (
    <div className="rounded-card border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between text-small">
        <span className="flex items-center gap-2 text-ink-1">
          {running ? <Loader2 aria-hidden className="size-3.5 animate-spin text-accent motion-reduce:animate-none" />
            : fp.phase === 'done' ? <CheckCircle aria-hidden className="size-3.5 text-green" /> : <XCircle aria-hidden className="size-3.5 text-amber" />}
          {running ? (fp.progress.total && fp.progress.checked >= fp.progress.total ? 'Verifying hits…' : 'Checking platforms')
            : fp.phase === 'done' ? 'Search complete' : fp.phase === 'stopped' ? 'Stopped' : 'Search failed'}
        </span>
        <span className="font-mono text-ink-2 tabular-nums">{fp.progress.checked}{fp.progress.total ? ` / ${fp.progress.total}` : ''}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${fp.phase === 'done' ? 100 : pct}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        <Stat size="sm" label="Hits" value={counts.hits} tone={counts.hits > 0 ? 'green' : 'neutral'} />
        <Stat size="sm" label="Ruled out" value={fp.progress.ruledOut} />
        <Stat size="sm" label="Blocked" value={counts.blocked} />
        <Stat size="sm" label="Elapsed" value={seconds} unit="s" />
      </div>
    </div>
  );

  const filters = (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {categoryCounts.length === 0 && <span className="text-small text-ink-3">{running ? 'Waiting for hits…' : 'Nothing to filter.'}</span>}
        {categoryCounts.map(({ category, count }) => (
          <CategoryChip key={category} on={fp.categories.includes(category)} onClick={() => toggleCategory(category)}>
            {category}<span className="text-ink-3 tabular-nums">{count}</span>
          </CategoryChip>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Checkbox checked={fp.showUnsure} onChange={e => fp.setShowUnsure(e.target.checked)} label={`Show unsure (${counts.unsure})`} />
        <Checkbox checked={fp.showBlocked} onChange={e => fp.setShowBlocked(e.target.checked)} label={`Show blocked or no answer (${counts.blocked})`} />
      </div>
    </div>
  );

  const empty = (
    <div className="py-8 text-center text-small text-ink-3">
      {running ? 'Hits appear here the moment a platform confirms them.' : 'No profiles match these filters.'}
    </div>
  );

  const cards = (
    <div className={`grid gap-2 ${isFullScreen ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
      {visible.map(r => (
        <a key={r.site} href={r.url} target="_blank" rel="noopener noreferrer"
          className={cx('group flex flex-col gap-1.5 rounded-card border border-line bg-surface-2 p-2.5 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
          <div className="flex min-w-0 items-center gap-2">
            <PlatformTile row={r} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-medium text-ink-1">{r.site}</div>
              <div className="truncate text-meta text-ink-3">@{fp.searched!.query}</div>
            </div>
            <StatusPill status={r.status} live={running} />
          </div>
          <div className="flex items-center justify-between gap-2 text-meta text-ink-3">
            <span className="truncate group-hover:text-ink-2">{bareUrl(r.url)}</span>
            <ExternalLink aria-hidden className="size-3 shrink-0" />
          </div>
          {(r.status === 'blocked' || r.status === 'error' || r.status === 'unverifiable') && r.reason && (
            <p className="text-meta text-ink-3">{r.reason}</p>
          )}
        </a>
      ))}
    </div>
  );

  const table = (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full text-small">
        <thead>
          <tr className="text-meta text-ink-3">
            <th className="px-2.5 py-2 text-left font-medium">Platform</th>
            <th className="px-2 py-2 text-left font-medium">Profile</th>
            {isFullScreen && <th className="px-2 py-2 text-left font-medium">Category</th>}
            <th className="px-2 py-2 text-left font-medium">Status</th>
            {isFullScreen && <th className="px-2.5 py-2 text-right font-medium">Response</th>}
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.site} className="border-t border-line hover:bg-surface-2">
              <td className="px-2.5 py-1.5">
                <span className="flex items-center gap-2">
                  <PlatformTile row={r} small />
                  <span className="whitespace-nowrap font-medium text-ink-1">{r.site}</span>
                </span>
              </td>
              <td className="max-w-[240px] px-2 py-1.5">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 text-ink-2 hover:text-ink-1">
                  <span className="truncate">{bareUrl(r.url)}</span>
                  <ExternalLink aria-hidden className="size-3 shrink-0" />
                </a>
              </td>
              {isFullScreen && <td className="px-2 py-1.5 text-ink-2">{r.category}</td>}
              <td className="px-2 py-1.5">{r.status === 'verified' ? <span className="text-ink-2">Found</span> : <StatusPill status={r.status} live={running} />}</td>
              {isFullScreen && <td className="px-2.5 py-1.5 text-right font-mono text-ink-3 tabular-nums">{r.ms} ms</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const results = visible.length > 0 ? (fp.view === 'cards' ? cards : table) : empty;

  return (
    <div className="flex flex-col gap-4">
      {progress}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small text-ink-2"><span className="font-medium text-ink-1 tabular-nums">{visible.length}</span> {visible.length === 1 ? 'result' : 'results'}</span>
        <div className="flex items-center gap-1.5">
          <Segmented size="sm" label="Result view" value={fp.view} onChange={fp.setView}
            options={[{ value: 'cards', label: 'Cards', icon: LayoutGrid }, { value: 'table', label: 'Table', icon: Table2 }]} />
          <Button variant="secondary" size="sm" icon={Download} disabled={all.length === 0} onClick={() => exportRows('csv')}>CSV</Button>
          <Button variant="secondary" size="sm" icon={Download} disabled={all.length === 0} onClick={() => exportRows('json')}>JSON</Button>
        </div>
      </div>

      {isFullScreen ? (
        <div className="flex items-start gap-5">
          <aside className="w-[200px] shrink-0">{filters}</aside>
          <div className="min-w-0 flex-1">{results}</div>
        </div>
      ) : (
        <>
          {filters}
          {results}
        </>
      )}

      <p className="text-meta leading-relaxed text-ink-3">
        Hits show as checking while the search runs. Each is then tried against two made-up handles, and sites that also
        “find” those move to unsure. Blocked sites refused the request. Site list from the Sherlock project.
      </p>
    </div>
  );
}
