'use client';

import { CheckCircle, Download, ExternalLink, LayoutGrid, Loader2, Table2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Segmented } from '@/components/ui/segmented';
import { Stat } from '@/components/ui/stat';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { ReactNode } from 'react';
import type { Category } from '@/lib/intel/recon/fingerprint/search';
import { download, exportRows, bareUrl, type Row } from '@/lib/intel/recon/fingerprint/rows';
import { StatusPill } from './fingerprint-parts';
import { MatchTag, ProfileAvatar, ProfileCard } from './fingerprint-profile-card';
import type { FingerprintState } from './use-fingerprint-search';
import { FingerprintIdentity } from './fingerprint-identity';
import { CATEGORY_LABEL } from './fingerprint-status';

const STAGE_LABEL = { sweep: msg('Checking platforms'), verifying: msg('Verifying hits…'), profiles: msg('Reading profiles…') } as const;

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
  counts: { hits: number; unsure: number; blocked: number; tied: number };
  categoryCounts: { category: Category; count: number }[];
  visible: Row[];
}) {
  const t = useT();
  const toggleCategory = (c: Category) =>
    fp.setCategories(fp.categories.includes(c) ? fp.categories.filter(x => x !== c) : [...fp.categories, c]);

  const save = (format: 'csv' | 'json') => {
    if (!fp.searched) return;
    const file = exportRows(Object.values(fp.rows), { ...fp.searched, checked: fp.progress.checked }, format);
    download(file.filename, file.body, file.type);
  };

  const trouble = fp.networkTrouble && !running && (
    <p className="mt-3 text-small text-amber">
      {t('Most sites couldn’t be reached at all, so the connection dropped rather than the sites answering. Results are incomplete; try again in a minute.')}
    </p>
  );

  const pct = fp.progress.total ? Math.round((fp.progress.checked / fp.progress.total) * 100) : 0;
  const seconds = (fp.elapsedMs / 1000).toLocaleString(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const progress = (
    <div className="rounded-card border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between text-small">
        <span className="flex items-center gap-2 text-ink-1">
          {running ? <Loader2 aria-hidden className="size-3.5 animate-spin text-accent motion-reduce:animate-none" />
            : fp.phase === 'done' ? <CheckCircle aria-hidden className="size-3.5 text-green" /> : <XCircle aria-hidden className="size-3.5 text-amber" />}
          {running ? t(STAGE_LABEL[fp.progress.total && fp.progress.checked >= fp.progress.total && fp.stage === 'sweep' ? 'verifying' : fp.stage])
            : fp.phase === 'done' ? t('Search complete') : fp.phase === 'stopped' ? t('Stopped') : t('Search failed')}
        </span>
        <span className="font-mono text-ink-2 tabular-nums">{fp.progress.checked}{fp.progress.total ? ` / ${fp.progress.total}` : ''}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${fp.phase === 'done' ? 100 : pct}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        <Stat size="sm" label={t('Hits')} value={counts.hits} tone={counts.hits > 0 ? 'green' : 'neutral'} />
        <Stat size="sm" label={t('Ruled out')} value={fp.progress.ruledOut} />
        <Stat size="sm" label={t('Blocked')} value={counts.blocked} />
        <Stat size="sm" label={t('Elapsed')} value={seconds} unit="s" />
      </div>
      {trouble}
    </div>
  );

  const filters = (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {categoryCounts.length === 0 && <span className="text-small text-ink-3">{running ? t('Waiting for hits…') : t('Nothing to filter.')}</span>}
        {categoryCounts.map(({ category, count }) => (
          <CategoryChip key={category} on={fp.categories.includes(category)} onClick={() => toggleCategory(category)}>
            {t(CATEGORY_LABEL[category])}<span className="text-ink-3 tabular-nums">{count}</span>
          </CategoryChip>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {fp.identity?.tied && (
          <Checkbox checked={fp.tiedOnly} onChange={e => fp.setTiedOnly(e.target.checked)} label={t('Only profiles tied to this person ({n})', { n: counts.tied })} />
        )}
        <Checkbox checked={fp.showUnsure} onChange={e => fp.setShowUnsure(e.target.checked)} label={t('Show unsure ({n})', { n: counts.unsure })} />
        <Checkbox checked={fp.showBlocked} onChange={e => fp.setShowBlocked(e.target.checked)} label={t('Show blocked or no answer ({n})', { n: counts.blocked })} />
      </div>
    </div>
  );

  const empty = (
    <div className="py-8 text-center text-small text-ink-3">
      {running ? t('Hits appear here the moment a platform answers.') : t('No profiles match these filters.')}
    </div>
  );

  const cards = (
    <div className={`grid gap-2 ${isFullScreen ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
      {visible.map(r => <ProfileCard key={r.site} row={r} query={fp.searched!.query} live={running} />)}
    </div>
  );

  const table = (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full text-small">
        <thead>
          <tr className="text-meta text-ink-3">
            <th className="px-2.5 py-2 text-left font-medium">{t('Platform')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('Profile')}</th>
            {isFullScreen && <th className="px-2 py-2 text-left font-medium">{t('Name')}</th>}
            <th className="px-2 py-2 text-left font-medium">{t('Status')}</th>
            {isFullScreen && <th className="px-2.5 py-2 text-right font-medium">{t('Response')}</th>}
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.site} className="border-t border-line hover:bg-surface-2">
              <td className="px-2.5 py-1.5">
                <span className="flex items-center gap-2">
                  <ProfileAvatar row={r} small />
                  <span className="whitespace-nowrap font-medium text-ink-1">{r.site}</span>
                </span>
              </td>
              <td className="max-w-[240px] px-2 py-1.5">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 text-ink-2 hover:text-ink-1">
                  <span className="truncate">{bareUrl(r.url)}</span>
                  <ExternalLink aria-hidden className="size-3 shrink-0" />
                </a>
              </td>
              {isFullScreen && <td className="max-w-[180px] truncate px-2 py-1.5 text-ink-2">{r.profile?.name ?? ''}</td>}
              <td className="px-2 py-1.5" title={r.match?.reasons.join('\n') ?? r.reason}>
                <span className="flex items-center gap-1">
                  {r.status === 'verified' && !r.match ? <span className="text-ink-2">{t('Found')}</span> : <StatusPill status={r.status} live={running} />}
                  <MatchTag row={r} />
                </span>
              </td>
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
      {fp.identity && !running && fp.searched && <div><FingerprintIdentity fp={fp} identity={fp.identity} query={fp.searched.query} /></div>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small text-ink-2">
          {t.rich('{n, plural, one {{count} result} other {{count} results}}', { n: visible.length, count: <span className="font-medium text-ink-1 tabular-nums">{visible.length}</span> })}
        </span>
        <div className="flex items-center gap-1.5">
          <Segmented size="sm" label={t('Result view')} value={fp.view} onChange={fp.setView}
            options={[{ value: 'cards', label: t('Cards'), icon: LayoutGrid }, { value: 'table', label: t('Table'), icon: Table2 }]} />
          <Button variant="secondary" size="sm" icon={Download} disabled={all.length === 0} onClick={() => save('csv')}>CSV</Button>
          <Button variant="secondary" size="sm" icon={Download} disabled={all.length === 0} onClick={() => save('json')}>JSON</Button>
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
        {t('Hits show as checking while the search runs. Each is then tried against made-up handles: sites that also “find” those, or won’t answer for them, move to unsure. A miss only counts where the site can find its own known account. Profiles are then read for names, links and photos, and tied together where they verify, link to or resemble each other. Site list from the Sherlock project.')}
      </p>
    </div>
  );
}
