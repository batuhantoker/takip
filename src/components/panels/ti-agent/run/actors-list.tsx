'use client';
/** TAKIP TI: the actors who play the simulation, each with what it wants and what it did last. */
import { useEffect, useRef } from 'react';
import { LoaderCircle, Users } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/components/ui/use-t';
import { castOf, type RunState } from '@/lib/ai/state';
import { Avatar, StanceTag } from '@/components/panels/ti-agent/atoms';

export function ActorsList({ s, selected, onSelect }: { s: RunState; selected: string | null; onSelect: (k: string | null) => void }) {
  const t = useT();
  const cast = castOf(s);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (selected?.startsWith('a:')) refs.current.get(selected.slice(2))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  if (!cast.length) {
    return <EmptyState icon={Users} title={s.status === 'running' ? t('Casting the actors') : t('No actors in this run')}
      body={s.status === 'running' ? t('The people and institutions who decide this appear here as they are cast.') : undefined} />;
  }
  const thinking = new Set(Object.keys(s.thinking).map(k => k.slice(k.indexOf(':') + 1)));
  return (
    <div className="flex flex-col">
      {cast.map(a => {
        const key = `a:${a.id}`;
        const on = selected === key;
        const moves = s.moves.filter(m => m.actor === a.id);
        const latest = moves.at(-1);
        return (
          <button key={a.id} type="button" ref={el => { if (el) refs.current.set(a.id, el); }} onClick={() => onSelect(on ? null : key)} aria-current={on || undefined}
            className={cx('-mx-2 flex items-center gap-3 rounded-control px-2 py-2 text-left', on ? 'bg-surface-3' : 'hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
            <Avatar name={a.name} size={28} ring={on ? 'selected' : thinking.has(a.id) ? 'thinking' : undefined} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-ink-1">{a.name}</span>
              <span className="block truncate text-small text-ink-2">{a.persona?.goal || a.role}</span>
            </span>
            {thinking.has(a.id)
              ? <span className="flex shrink-0 items-center gap-1.5 text-meta text-ink-3"><LoaderCircle aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />{t('Deciding')}</span>
              : latest && <span className="shrink-0" title={t('Latest move: {action}', { action: latest.action })}><StanceTag stance={latest.stance} /></span>}
          </button>
        );
      })}
    </div>
  );
}
