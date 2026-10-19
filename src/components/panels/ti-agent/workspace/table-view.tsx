'use client';
/**
 * TAKIP TI: the table view.
 *
 * Every object of a kind in one sortable table: the actors with what they
 * did, every move made in every world, the events the worlds produced, the
 * sources with who quoted them, and every link. A row opens its object (a
 * move opens the actor that made it).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Table2 } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { Segmented } from '@/components/ui/segmented';
import { useT } from '@/components/ui/use-t';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { LINK_LABEL } from '@/lib/ai/workspace/objects';
import { nodeName } from '@/lib/ai/workspace/selection';
import type { RunState } from '@/lib/ai/state';
import { T, ago, fmtDate, toneColor } from '@/components/panels/ti-agent/theme';
import { StanceTag, TypeIcon, accentFor } from '@/components/panels/ti-agent/atoms';
import { PushTag, SOURCE_KIND } from '@/components/panels/ti-agent/parts/quotes';

type Kind = 'actors' | 'moves' | 'events' | 'sources' | 'links';

const KIND_NAME: Record<Kind, string> = { actors: msg('Actors'), moves: msg('Moves'), events: msg('Events'), sources: msg('Sources'), links: msg('Links') };

interface Column<R> {
  id: string;
  label: string;
  /** CSS grid track. */
  width: string;
  align?: 'right';
  sort: (r: R) => number | string;
  cell: (r: R) => ReactNode;
}

interface TableSpec<R> {
  rows: R[];
  /** What a row opens. */
  key: (r: R) => string;
  /** The row's own identity, where several rows open the same object. */
  id?: (r: R) => string;
  text: (r: R) => string;
  columns: Column<R>[];
}

const num = (v: ReactNode) => <span className="font-mono tabular-nums">{v}</span>;

function NameCell({ k, subtype, title, sub }: { k: string; subtype?: string; title: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <TypeIcon k={k} subtype={subtype} className={cx('size-3.5 shrink-0', accentFor(k))} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink-1">{title}</span>
        {sub && <span className="block truncate text-meta text-ink-3">{sub}</span>}
      </span>
    </span>
  );
}

function specs(s: RunState, t: Translate) {
  const touching = (k: string) => s.links.filter(l => l.from === k || l.to === k);
  const movesOf = (id: string) => s.moves.filter(m => m.actor === id);
  const hard = (id: string) => movesOf(id).filter(m => m.stance === 'pressure' || m.stance === 'oppose').length;
  const quotes = (id: string) => movesOf(id).reduce((n, m) => n + (m.cites?.length ?? 0), 0);
  const name = (id: string) => s.actors.find(a => a.id === id)?.name ?? id;
  const actors: TableSpec<RunState['actors'][number]> = {
    // The cast first, in the order they were cast; the rest of the world model after.
    rows: [...s.actors.filter(a => a.persona), ...s.actors.filter(a => !a.persona)], key: a => `a:${a.id}`, text: a => `${a.name} ${a.kind} ${a.role} ${a.place} ${a.persona?.goal ?? ''}`,
    columns: [
      { id: 'name', label: t('Actor'), width: 'minmax(170px,2fr)', sort: a => a.name, cell: a => <NameCell k={`a:${a.id}`} subtype={a.kind} title={a.name} sub={a.persona?.goal || a.role} /> },
      { id: 'kind', label: t('Type'), width: '96px', sort: a => a.kind, cell: a => <span className="text-ink-2 capitalize">{a.kind}</span> },
      { id: 'plays', label: t('Plays'), width: '56px', sort: a => (a.persona ? 1 : 0), cell: a => a.persona ? <span className="text-ink-1">{t('Yes')}</span> : <span className="text-ink-4">—</span> },
      {
        id: 'lean', label: t('Lean'), width: '64px', align: 'right', sort: a => a.lean,
        cell: a => s.frame?.kind === 'choice' ? num('—') : <span className="font-mono text-ink-1 tabular-nums">{a.lean > 0 ? '+' : ''}{a.lean.toFixed(2)}</span>,
      },
      { id: 'moves', label: t('Moves'), width: '60px', align: 'right', sort: a => movesOf(a.id).length, cell: a => num(movesOf(a.id).length || '—') },
      { id: 'hard', label: t('Presses'), width: '66px', align: 'right', sort: a => hard(a.id), cell: a => num(hard(a.id) || '—') },
      { id: 'quotes', label: t('Quotes'), width: '62px', align: 'right', sort: a => quotes(a.id), cell: a => num(quotes(a.id) || '—') },
      { id: 'links', label: t('Links'), width: '56px', align: 'right', sort: a => touching(`a:${a.id}`).length, cell: a => num(touching(`a:${a.id}`).length) },
    ],
  };
  const moves: TableSpec<RunState['moves'][number]> = {
    rows: s.moves, key: m => `a:${m.actor}`, id: m => m.id, text: m => `${name(m.actor)} ${m.action} ${m.statement} ${m.targets.map(name).join(' ')} world ${m.world}`,
    columns: [
      { id: 'period', label: 'P', width: '40px', align: 'right', sort: m => m.period * 100 + m.world.charCodeAt(0), cell: m => num(m.period) },
      { id: 'world', label: t('World'), width: '64px', sort: m => m.world, cell: m => <span className="font-mono text-ink-2">{m.world}</span> },
      { id: 'actor', label: t('Actor'), width: 'minmax(130px,1.2fr)', sort: m => name(m.actor), cell: m => <NameCell k={`a:${m.actor}`} subtype={s.actors.find(a => a.id === m.actor)?.kind} title={name(m.actor)} /> },
      { id: 'stance', label: t('Stance'), width: '96px', sort: m => m.stance, cell: m => <StanceTag stance={m.stance} /> },
      { id: 'action', label: t('Does'), width: 'minmax(200px,3fr)', sort: m => m.action, cell: m => <span className="truncate text-ink-1" title={m.action}>{m.action}</span> },
      { id: 'targets', label: t('Aimed at'), width: 'minmax(100px,1fr)', sort: m => m.targets.map(name).join(', '), cell: m => <span className="truncate text-ink-2">{m.targets.map(name).join(', ') || '—'}</span> },
      { id: 'quotes', label: t('Quotes'), width: '60px', align: 'right', sort: m => m.cites?.length ?? 0, cell: m => num(m.cites?.length || '—') },
    ],
  };
  const events: TableSpec<RunState['events'][number]> = {
    rows: s.events, key: e => `e:${e.id}`, text: e => `${e.title} ${e.detail} ${e.place} world ${e.world}`,
    columns: [
      { id: 'date', label: t('Date'), width: '112px', sort: e => e.date, cell: e => <span className="font-mono text-ink-2 tabular-nums">{fmtDate(e.date, t)}</span> },
      { id: 'world', label: t('World'), width: '64px', sort: e => e.world, cell: e => <span className="font-mono text-ink-2" title={t('World {w}', { w: e.world })}>{e.world}</span> },
      { id: 'title', label: t('Event'), width: 'minmax(220px,3fr)', sort: e => e.title, cell: e => <NameCell k={`e:${e.id}`} subtype={e.kind} title={e.title} sub={e.actors.map(name).join(', ')} /> },
      { id: 'kind', label: t('Kind'), width: '80px', sort: e => e.kind, cell: e => <span className={e.kind === 'event' ? 'text-ink-2' : 'text-ink-1'}>{e.kind === 'shock' ? t('Surprise') : e.kind === 'injected' ? t('Added') : t('Event')}</span> },
      { id: 'push', label: t('Pushes'), width: '104px', sort: e => e.push, cell: e => <PushTag c={e} frame={s.frame} /> },
      { id: 'place', label: t('Where'), width: 'minmax(80px,1fr)', sort: e => e.place, cell: e => <span className="truncate text-ink-2">{e.place || '—'}</span> },
    ],
  };
  const sources: TableSpec<RunState['context'][number]> = {
    rows: s.context, key: c => `c:${c.id}`, text: c => `${c.title} ${c.source} ${c.place}`,
    columns: [
      { id: 'title', label: t('Source'), width: 'minmax(220px,3fr)', sort: c => c.title, cell: c => <NameCell k={`c:${c.id}`} subtype={c.kind} title={c.title} sub={c.source} /> },
      { id: 'kind', label: t('Kind'), width: '84px', sort: c => c.kind, cell: c => <span className="text-ink-2">{SOURCE_KIND[c.kind] ? t(SOURCE_KIND[c.kind]) : c.kind}</span> },
      { id: 'place', label: t('Location'), width: 'minmax(80px,1fr)', sort: c => c.place, cell: c => <span className="truncate text-ink-2">{c.place || '—'}</span> },
      { id: 'age', label: t('Age'), width: '64px', align: 'right', sort: c => Date.parse(c.published) || 0, cell: c => num(ago(c.published, t) || '—') },
      { id: 'quoted', label: t('Quoted'), width: '60px', align: 'right', sort: c => s.links.filter(l => l.kind === 'cite' && l.to === `c:${c.id}`).length, cell: c => num(s.links.filter(l => l.kind === 'cite' && l.to === `c:${c.id}`).length || '—') },
      { id: 'cited', label: t('Cited'), width: '54px', align: 'right', sort: c => touching(`c:${c.id}`).length, cell: c => num(touching(`c:${c.id}`).length || '—') },
    ],
  };
  const links: TableSpec<RunState['links'][number]> = {
    rows: s.links, key: l => `link:${l.id}`, text: l => `${nodeName(s, l.from, t)} ${nodeName(s, l.to, t)} ${l.kind} ${l.label}`,
    columns: [
      { id: 'from', label: t('From'), width: 'minmax(120px,1.4fr)', sort: l => nodeName(s, l.from, t), cell: l => <span className="truncate text-ink-1">{nodeName(s, l.from, t)}</span> },
      {
        id: 'kind', label: t('Link'), width: '108px', sort: l => `${l.kind}${l.tone}`,
        cell: l => (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: l.kind === 'cite' ? T.ink2 : toneColor(l.tone), opacity: l.kind === 'evidence' ? 0.6 : 1 }} />
            <span className="text-ink-2">{t(LINK_LABEL[l.kind])}</span>
          </span>
        ),
      },
      { id: 'to', label: t('To'), width: 'minmax(120px,1.4fr)', sort: l => nodeName(s, l.to, t), cell: l => <span className="truncate text-ink-1">{nodeName(s, l.to, t)}</span> },
      { id: 'strength', label: t('Strength'), width: '72px', align: 'right', sort: l => l.strength, cell: l => num(Math.round(l.strength * 100)) },
      { id: 'round', label: t('When'), width: '62px', align: 'right', sort: l => l.round, cell: l => l.from === 'r:report' ? t('Report') : l.round ? num(`${l.id.split(':')[1]} · P${l.round}`) : t('Model') },
      { id: 'label', label: t('Says'), width: 'minmax(140px,2fr)', sort: l => l.label, cell: l => <span className="truncate text-ink-3" title={l.label}>{l.label || '—'}</span> },
    ],
  };
  return { actors, moves, events, sources, links };
}

function Table<R>({ spec, selected, onSelect, query }: { spec: TableSpec<R>; selected: string | null; onSelect: (k: string | null) => void; query: string }) {
  const t = useT();
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const template = spec.columns.map(c => c.width).join(' ');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = q ? spec.rows.filter(r => spec.text(r).toLowerCase().includes(q)) : spec.rows;
    if (!sort) return hit;
    const col = spec.columns.find(c => c.id === sort.id);
    if (!col) return hit;
    return hit.slice().sort((a, b) => {
      const x = col.sort(a), y = col.sort(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [spec, sort, query]);

  return (
    <div role="table" className="min-w-[560px]">
      <div role="row" className="sticky top-0 z-10 grid border-b border-line-strong bg-surface-1" style={{ gridTemplateColumns: template }}>
        {spec.columns.map(c => {
          const on = sort?.id === c.id;
          return (
            <button key={c.id} type="button" role="columnheader" aria-sort={on ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}
              onClick={() => setSort(on ? (sort!.dir === 1 ? { id: c.id, dir: -1 } : null) : { id: c.id, dir: 1 })}
              className={cx('flex h-8 items-center gap-1 px-3 text-meta font-medium hover:text-ink-1', c.align === 'right' && 'justify-end', on ? 'text-ink-1' : 'text-ink-3', FOCUS_RING, TRANSITION)}>
              {c.label}{on && (sort!.dir === 1 ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />)}
            </button>
          );
        })}
      </div>
      {rows.map(r => {
        const k = spec.key(r);
        const on = selected === k;
        return (
          <button key={spec.id?.(r) ?? k} type="button" role="row" onClick={() => onSelect(on ? null : k)} aria-selected={on}
            className={cx('grid w-full items-center border-b border-line text-left text-small', on ? 'bg-surface-3' : 'hover:bg-surface-2', FOCUS_RING, TRANSITION)}
            style={{ gridTemplateColumns: template }}>
            {spec.columns.map(c => (
              <span key={c.id} role="cell" className={cx('flex min-w-0 items-center overflow-hidden px-3 py-2', c.align === 'right' && 'justify-end')}>{c.cell(r)}</span>
            ))}
          </button>
        );
      })}
      {!rows.length && <p className="px-4 py-8 text-center text-small text-ink-3">{query ? t('Nothing matches the filter.') : t('Nothing here yet.')}</p>}
    </div>
  );
}

export function TableView({ s, selected, onSelect }: { s: RunState; selected: string | null; onSelect: (k: string | null) => void }) {
  const t = useT();
  const [kind, setKind] = useState<Kind>('actors');
  const [query, setQuery] = useState('');
  const all = useMemo(() => specs(s, t), [s, t]);
  const counts: Record<Kind, number> = { actors: s.actors.length, moves: s.moves.length, events: s.events.length, sources: s.context.length, links: s.links.length };
  // On a narrow stage the tabs drop their counts.
  const head = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const hasRows = s.actors.length > 0;
  useEffect(() => {
    const el = head.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 680));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasRows]);
  if (!hasRows) return <div className="flex h-full items-center justify-center"><EmptyState icon={Table2} title={t('No objects yet')} body={t('Actors, moves, events, sources and links fill these tables as the run goes.')} /></div>;
  return (
    <div className="flex h-full flex-col">
      <div ref={head} className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <h3 className={cx('shrink-0 text-body font-semibold text-ink-1', narrow && 'sr-only')}>{t('Objects')}</h3>
        <Segmented size="sm" label={t('Kind of object')} value={kind} onChange={k => { setKind(k); setQuery(''); }}
          options={(Object.keys(counts) as Kind[]).map(k => ({ value: k, label: t(KIND_NAME[k]), count: narrow ? undefined : counts[k] }))} />
        <div className={cx('ml-auto shrink-0', narrow ? 'w-32' : 'w-48')}><SearchField size="sm" value={query} onChange={setQuery} placeholder={t('Filter rows')} /></div>
      </div>
      <div className="styled-scrollbar min-h-0 flex-1 overflow-auto">
        {kind === 'actors' && <Table spec={all.actors} selected={selected} onSelect={onSelect} query={query} />}
        {kind === 'moves' && <Table spec={all.moves} selected={selected} onSelect={onSelect} query={query} />}
        {kind === 'events' && <Table spec={all.events} selected={selected} onSelect={onSelect} query={query} />}
        {kind === 'sources' && <Table spec={all.sources} selected={selected} onSelect={onSelect} query={query} />}
        {kind === 'links' && <Table spec={all.links} selected={selected} onSelect={onSelect} query={query} />}
      </div>
    </div>
  );
}
