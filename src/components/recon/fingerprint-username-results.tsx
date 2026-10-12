'use client';

import { LayoutGrid, Table2, Download, ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toCsv, type Category } from '@/lib/fingerprint';
import { ACCENT, STATUS_META, CATEGORY_COLOR, download, bareUrl, type Row } from '@/lib/recon-fingerprint';
import { StatusPill, PlatformTile, Toggle } from './fingerprint-parts';
import type { FingerprintState } from './use-fingerprint-search';

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
        query: fp.searched.query,
        type: fp.searched.type,
        exported_at: new Date().toISOString(),
        platforms_checked: fp.progress.checked,
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

  const filters = (
    <div className={isFullScreen ? 'flex flex-col gap-3' : 'flex flex-col gap-1.5'}>
      {isFullScreen && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--text-secondary)]">FILTERS</span>
          {fp.categories.length > 0 && (
            <button onClick={() => fp.setCategories([])} className="text-[9px] font-mono text-[var(--text-muted)] hover:text-white hover:underline">Clear all</button>
          )}
        </div>
      )}
      <div className={isFullScreen ? 'flex flex-col gap-0.5' : 'flex flex-wrap gap-1'}>
        {categoryCounts.length === 0 && (
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{running ? 'Waiting for hits…' : 'Nothing to filter.'}</span>
        )}
        {categoryCounts.map(({ category, count }) => {
          const on = fp.categories.includes(category);
          const color = CATEGORY_COLOR[category];
          return isFullScreen ? (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              className="flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-mono transition-colors hover:bg-[var(--hover-accent)]"
              style={{ background: on ? `${color}14` : undefined, color: on ? color : 'var(--text-secondary)' }}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: color, opacity: on ? 1 : 0.5 }} />
                {category}
              </span>
              <span className="text-[var(--text-muted)]">{count}</span>
            </button>
          ) : (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors"
              style={{ color: on ? color : 'var(--text-muted)', background: on ? `${color}1a` : 'transparent', border: `1px solid ${on ? `${color}55` : 'var(--border-primary)'}` }}
            >
              {category} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      <div className={isFullScreen ? 'flex flex-col gap-1 pt-2 border-t border-[var(--border-primary)]' : 'flex flex-wrap gap-1'}>
        {isFullScreen && <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] mb-0.5">ALSO SHOW</span>}
        <Toggle on={fp.showUnsure} label="Unsure" count={counts.unsure} color={STATUS_META.unverifiable.color} onClick={() => fp.setShowUnsure(!fp.showUnsure)} />
        <Toggle on={fp.showBlocked} label="Blocked / no answer" count={counts.blocked} color={STATUS_META.blocked.color} onClick={() => fp.setShowBlocked(!fp.showBlocked)} />
      </div>
    </div>
  );

  const cards = (
    <div className={`grid gap-2 ${isFullScreen ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
      {visible.map(r => (
        <a
          key={r.site}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col gap-1.5 p-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 hover:border-[#3B82F6]/50 hover:bg-[#3B82F6]/5 transition-colors min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <PlatformTile row={r} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-primary)] truncate">{r.site.toUpperCase()}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">@{fp.searched!.query}</div>
            </div>
            <StatusPill status={r.status} live={running} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-[var(--text-muted)] min-w-0">
            <span className="truncate group-hover:text-[var(--text-secondary)]">{bareUrl(r.url)}</span>
            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
          </div>
          {(r.status === 'blocked' || r.status === 'error' || r.status === 'unverifiable') && r.reason && (
            <div className="text-[9px] font-mono leading-snug" style={{ color: STATUS_META[r.status].color }}>{r.reason}</div>
          )}
        </a>
      ))}
    </div>
  );

  const table = (
    <div className="rounded-lg border border-[var(--border-primary)] overflow-x-auto">
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="text-[9px] tracking-wider text-[var(--text-muted)] bg-[var(--bg-primary)]/40">
            <th className="text-left font-normal px-2.5 py-1.5">PLATFORM</th>
            <th className="text-left font-normal px-2 py-1.5">PROFILE</th>
            {isFullScreen && <th className="text-left font-normal px-2 py-1.5">CATEGORY</th>}
            <th className="text-left font-normal px-2 py-1.5">STATUS</th>
            {isFullScreen && <th className="text-right font-normal px-2.5 py-1.5">RESPONSE</th>}
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.site} className="border-t border-[var(--border-primary)]/50 hover:bg-[var(--hover-accent)]">
              <td className="px-2.5 py-1.5">
                <span className="flex items-center gap-2">
                  <PlatformTile row={r} size={18} />
                  <span className="font-bold text-[var(--text-primary)] whitespace-nowrap">{r.site}</span>
                </span>
              </td>
              <td className="px-2 py-1.5 max-w-[240px]">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-white hover:underline min-w-0">
                  <span className="truncate">{bareUrl(r.url)}</span>
                  <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                </a>
              </td>
              {isFullScreen && <td className="px-2 py-1.5" style={{ color: CATEGORY_COLOR[r.category] }}>{r.category}</td>}
              <td className="px-2 py-1.5"><StatusPill status={r.status} live={running} /></td>
              {isFullScreen && <td className="px-2.5 py-1.5 text-right text-[var(--text-muted)]">{r.ms} ms</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {/* Live progress */}
      <div className="p-3 rounded-lg border bg-[var(--bg-primary)]/40" style={{ borderColor: `${ACCENT}40` }}>
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest" style={{ color: ACCENT }}>
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : fp.phase === 'done' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {running
              ? (fp.progress.total && fp.progress.checked >= fp.progress.total ? 'VERIFYING HITS…' : 'CHECKING PLATFORMS')
              : fp.phase === 'done' ? 'SEARCH COMPLETE' : fp.phase === 'stopped' ? 'SEARCH STOPPED' : 'SEARCH FAILED'}
          </span>
          <span className="text-[10px] font-mono text-[var(--text-secondary)]">
            {fp.progress.checked}{fp.progress.total ? ` / ${fp.progress.total}` : ''} platforms
          </span>
        </div>
        <div className="w-full h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${fp.phase === 'done' ? 100 : pct}%`, background: ACCENT }} />
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2.5">
          {[
            { label: 'HITS', value: counts.hits, color: '#00E676' },
            { label: 'RULED OUT', value: fp.progress.ruledOut, color: 'var(--text-secondary)' },
            { label: 'BLOCKED', value: counts.blocked, color: STATUS_META.blocked.color },
            { label: 'ELAPSED', value: `${seconds}s`, color: 'var(--text-secondary)' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-[8px] font-mono tracking-widest text-[var(--text-muted)]">{s.label}</div>
              <div className="text-[12px] font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
          {visible.length} <span className="text-[var(--text-muted)] font-normal">{visible.length === 1 ? 'result' : 'results'}</span>
        </span>
        <div className="flex items-center gap-1">
          <div className="flex p-0.5 rounded-md border border-[var(--border-primary)]" role="tablist" aria-label="Result view">
            {([['cards', LayoutGrid, 'Cards'], ['table', Table2, 'Table']] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={fp.view === id}
                onClick={() => fp.setView(id)}
                title={`${label} view`}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
                style={{ background: fp.view === id ? `${ACCENT}26` : 'transparent', color: fp.view === id ? ACCENT : 'var(--text-muted)' }}
              >
                <Icon className="w-3 h-3" />{label.toUpperCase()}
              </button>
            ))}
          </div>
          {(['csv', 'json'] as const).map(f => (
            <button
              key={f}
              onClick={() => exportRows(f)}
              disabled={all.length === 0}
              title={`Export ${f.toUpperCase()}`}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md border border-[var(--border-primary)] text-[9px] font-mono text-[var(--text-muted)] hover:text-white disabled:opacity-30"
            >
              <Download className="w-3 h-3" />{f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {isFullScreen ? (
        <div className="flex gap-4 items-start">
          <aside className="w-[190px] flex-shrink-0 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 sticky top-0">
            {filters}
          </aside>
          <div className="flex-1 min-w-0">
            {visible.length > 0 ? (fp.view === 'cards' ? cards : table) : (
              <div className="py-10 text-center text-[10px] font-mono text-[var(--text-muted)]">
                {running ? 'Hits appear here the moment a platform confirms them.' : 'No profiles match these filters.'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {filters}
          {visible.length > 0 ? (fp.view === 'cards' ? cards : table) : (
            <div className="py-6 text-center text-[10px] font-mono text-[var(--text-muted)]">
              {running ? 'Hits appear here the moment a platform confirms them.' : 'No profiles match these filters.'}
            </div>
          )}
        </>
      )}

      <div className="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
        Hits show as VERIFYING while the sweep runs, then each is re-tested against two random control handles — sites that
        also “find” those move to UNSURE. Blocked sites refused the request, so nothing was learned either way.
        Source: Sherlock Project site database (MIT).
      </div>
    </>
  );
}
