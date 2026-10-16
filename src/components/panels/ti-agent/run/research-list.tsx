'use client';
/**
 * TAKIP TI: the research behind a run: the world model's actors and how they
 * relate, and the sources it read, the most quoted first.
 */
import { BookOpen, Network } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Dot, Tag } from '@/components/ui/tag';
import { nodeName } from '@/lib/ai/workspace/selection';
import type { RunState } from '@/lib/ai/state';
import type { ContextItem, Link } from '@/lib/ai/types';
import { T, ago, pct, toneColor } from '@/components/panels/ti-agent/theme';
import { SOURCE_KIND, SourceLink, sourceLabel } from '@/components/panels/ti-agent/parts/quotes';

/** What the arcs (and the graph's edges) mean, in their own Style Studio colours. */
export function Legend({ floating = false, compact = false }: { floating?: boolean; compact?: boolean }) {
  const rows: { label: string; color: string; dash?: string; opacity?: number }[] = [
    { label: compact ? 'Aligned' : 'Aligned · cooperates', color: T.support },
    { label: compact ? 'Opposed' : 'Opposed · presses', color: T.oppose },
    { label: compact ? 'Between' : 'Between · holds', color: T.neutral },
    { label: 'Evidence', color: T.neutral, opacity: 0.55 },
    // Quotes are threads in the graph only; the globe does not draw them.
    ...(floating ? [] : [{ label: 'Quote', color: T.ink2, dash: '0.5 3.5' }]),
  ];
  return (
    <div className={cx('flex flex-wrap', floating ? 'justify-center gap-x-4 gap-y-1.5 rounded-full border border-line bg-surface-1 px-4 py-2 shadow-float' : 'gap-x-4 gap-y-1.5')}>
      {rows.map(r => (
        <span key={r.label} className="inline-flex items-center gap-1.5 text-meta text-ink-2">
          <svg width="18" height="6" aria-hidden><line x1="1" x2="17" y1="3" y2="3" strokeWidth="2" strokeDasharray={r.dash} strokeLinecap="round" style={{ stroke: r.color, opacity: r.opacity ?? 1 }} /></svg>
          {r.label}
        </span>
      ))}
    </div>
  );
}

export function LineGlyph({ link }: { link: Link }) {
  return (
    <svg width="16" height="6" className="shrink-0" aria-hidden>
      <line x1="1" x2="15" y1="3" y2="3" strokeWidth="2" strokeDasharray={link.kind === 'cite' ? '0.5 3.5' : undefined} strokeLinecap="round"
        style={{ stroke: link.kind === 'cite' ? T.ink2 : toneColor(link.tone), opacity: link.kind === 'evidence' ? 0.55 : 1 }} />
    </svg>
  );
}

export function WorldList({ s, selected, onSelect }: { s: RunState; selected: string | null; onSelect: (k: string | null) => void }) {
  const relations = s.links.filter(l => l.kind === 'relation');
  if (!s.actors.length) return <EmptyState icon={Network} title="Mapping the world" body="The actors and how they relate appear here as the world model is built." />;
  const pick = (key: string) => onSelect(selected === key ? null : key);
  return (
    <div className="flex flex-col">
      <Legend />
      <PanelSection title="Actors" hint={s.actors.length} className="mt-6">
        {s.actors.map(a => (
          <ListRow key={a.id} selected={selected === `a:${a.id}`} onClick={() => pick(`a:${a.id}`)}
            leading={<Dot tone={a.persona ? 'gold' : 'muted'} label={a.persona ? 'Plays in the simulation' : undefined} />}
            title={a.name} subtitle={a.role} meta={<span className="capitalize">{a.kind}</span>} />
        ))}
      </PanelSection>
      {relations.length > 0 && (
        <PanelSection title="Relations" hint={relations.length}>
          {relations.map(l => (
            <ListRow key={l.id} selected={selected === `link:${l.id}`} onClick={() => pick(`link:${l.id}`)}
              leading={<LineGlyph link={l} />} title={`${nodeName(s, l.from)} and ${nodeName(s, l.to)}`} subtitle={l.label.charAt(0).toUpperCase() + l.label.slice(1)} />
          ))}
        </PanelSection>
      )}
      <ContextList s={s} selected={selected} onSelect={onSelect} />
    </div>
  );
}

export function ContextList({ s, selected, onSelect }: { s: RunState; selected: string | null; onSelect: (k: string | null) => void }) {
  if (!s.context.length) {
    return s.status === 'running' && !s.actors.length
      ? <EmptyState icon={BookOpen} title="Reading the live feeds" body="The sources TI finds are listed here, the most quoted first." />
      : null;
  }
  const cited = new Set(s.links.filter(l => l.kind === 'evidence').map(l => l.from.slice(2)));
  // How often the actors and the report quoted each source: the most quoted first, the unquoted after.
  const quoted = new Map<string, number>();
  for (const l of s.links) if (l.kind === 'cite') quoted.set(l.to.slice(2), (quoted.get(l.to.slice(2)) ?? 0) + 1);
  const order = s.context.map((c, i) => ({ c, i })).sort((a, b) => (quoted.get(b.c.id) ?? 0) - (quoted.get(a.c.id) ?? 0) || a.i - b.i).map(x => x.c);
  return (
    <PanelSection title="Sources" hint={s.context.length}>
      {order.map((c: ContextItem) => {
        const key = `c:${c.id}`;
        const n = quoted.get(c.id) ?? 0;
        const used = n > 0 || cited.has(c.id);
        return (
          <ListRow key={c.id} selected={selected === key} onClick={() => onSelect(selected === key ? null : key)}
            leading={<Dot tone={used ? 'gold' : 'muted'} label={used ? 'Quoted or cited' : undefined} />}
            title={c.kind === 'data' && c.id !== 'data' ? `“${c.title}”` : c.title}
            subtitle={<><span className="font-mono">[{c.id}]</span> {[SOURCE_KIND[c.kind], sourceLabel(c, c.id), ago(c.published)].filter(Boolean).join(' · ')}</>}
            trailing={(
              <>
                {c.kind === 'odds' && c.odds && <span className="font-mono text-small text-ink-1 tabular-nums" title={`${c.odds.platform} prices yes at ${pct(c.odds.probability)}`}>{pct(c.odds.probability)}</span>}
                {c.kind === 'social' && <Tag>Unverified</Tag>}
                {n > 0 && <span className="font-mono text-meta text-ink-3 tabular-nums" title={`Quoted ${n} time${n === 1 ? '' : 's'}`}>{n}×</span>}
                <SourceLink url={c.url} />
              </>
            )} />
        );
      })}
    </PanelSection>
  );
}
