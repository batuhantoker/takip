'use client';
/**
 * TAKIP TI: choosing a model.
 *
 * The chosen model with what it is good for; opened, a searchable list in
 * groups (Recommended, then each family, newest first). Dated snapshots of a
 * listed alias stay tucked away until asked for. Arrow keys move, Enter
 * picks, Escape closes the list; a name that is not listed can still be used
 * as typed.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, CornerDownLeft } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { SearchField } from '@/components/ui/search-field';
import { Tag } from '@/components/ui/tag';
import { isPlausibleModel, type ProviderId } from '@/lib/ai/providers/catalog';
import { isReasoning, modelHint, organizeModels, type ModelOption } from '@/lib/ai/providers/models';

function Tags({ reasoning, isDefault }: { reasoning: boolean; isDefault: boolean }) {
  return (
    <>
      {reasoning && <Tag>Reasoning</Tag>}
      {isDefault && <Tag>Default</Tag>}
    </>
  );
}

export function ModelPicker({ provider, models, value, onChange, suggested, defaultModel, listed }: {
  provider: ProviderId;
  models: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  suggested: string[];
  defaultModel: string;
  /** The list came from the key itself, not the known names. */
  listed: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [snapshots, setSnapshots] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const { groups, hidden } = useMemo(
    () => organizeModels(provider, models, { suggested, defaultModel, selected: value, query, snapshots }),
    [provider, models, suggested, defaultModel, value, query, snapshots],
  );
  const flat = useMemo(() => groups.flatMap(g => g.models), [groups]);
  const typed = query.trim();
  // A name that is not listed: a new model, a fine-tune, or one the provider does not list.
  const custom = typed && isPlausibleModel(typed) && !flat.some(m => m.id === typed) ? typed : '';
  const count = flat.length + (custom ? 1 : 0);
  const at = Math.min(active, Math.max(0, count - 1));

  const pick = (m: string) => { onChange(m); setOpen(false); setQuery(''); };

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, at]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(at + 1, count - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(at - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const next = at < flat.length ? flat[at]?.id : custom;
      if (next) pick(next);
    } else if (e.key === 'Escape' && !query) {
      // Close the list, not the popover around it.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  const current = { hint: modelHint(provider, value), reasoning: isReasoning(provider, value), isDefault: value === defaultModel };
  const currentName = models.find(m => m.id === value)?.name;
  let index = -1;

  const row = (m: ModelOption) => {
    index++;
    const i = index;
    const on = m.id === value;
    return (
      <button key={m.id} type="button" role="option" aria-selected={on} data-active={i === at}
        onClick={() => pick(m.id)} onPointerMove={() => { if (i !== at) setActive(i); }}
        className={cx('flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left', i === at ? 'bg-surface-2' : '', TRANSITION)}>
        <span className="flex h-[18px] w-3.5 shrink-0 items-center">{on && <Check aria-hidden className="size-3.5 text-ink-1" strokeWidth={2} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cx('truncate text-body', on ? 'font-medium text-ink-1' : 'text-ink-1')}>{m.name}</span>
            <Tags reasoning={m.reasoning} isDefault={m.isDefault} />
          </span>
          {(m.hint || m.name !== m.id) && (
            <span className="block truncate text-meta text-ink-3">
              {m.hint}{m.hint && m.name !== m.id ? ' · ' : ''}{m.name !== m.id && <span className="font-mono">{m.id}</span>}
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => { setOpen(o => !o); setQuery(''); setActive(0); }} aria-expanded={open} aria-controls={`${id}-list`}
        className={cx('flex w-full items-center gap-2 rounded-card border bg-surface-2 px-2.5 py-1.5 text-left hover:bg-surface-3',
          open ? 'border-accent' : 'border-line-strong', FOCUS_RING, TRANSITION)}>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-body text-ink-1">{currentName && currentName !== value ? currentName : value}</span>
            <Tags reasoning={current.reasoning} isDefault={current.isDefault} />
          </span>
          {current.hint && <span className="block truncate text-meta text-ink-3">{current.hint}</span>}
        </span>
        <ChevronDown aria-hidden className={cx('size-4 shrink-0 text-ink-3 transition-transform duration-150', open && 'rotate-180')} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="flex flex-col gap-1.5">
          <SearchField value={query} onChange={v => { setQuery(v); setActive(0); }} onKeyDown={onKey} size="sm" autoFocus
            placeholder="Search models" aria-controls={`${id}-list`} spellCheck={false} autoComplete="off" />
          <div ref={list} id={`${id}-list`} role="listbox" aria-label="Models" className="styled-scrollbar -mx-1 max-h-[248px] overflow-y-auto px-1">
            {groups.map(g => (
              <div key={g.key} role="group" aria-label={g.label}>
                <div className="sticky top-0 z-[1] flex items-center gap-2 bg-surface-1 px-2 pt-2 pb-1 text-meta font-medium text-ink-3">
                  <span className="flex-1">{g.label}</span>
                  <span className="font-mono tabular-nums">{g.models.length}</span>
                </div>
                {g.models.map(row)}
              </div>
            ))}
            {custom && (
              <button type="button" data-active={at === flat.length} onClick={() => pick(custom)} onPointerMove={() => setActive(flat.length)}
                className={cx('flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-body text-ink-2', at === flat.length && 'bg-surface-2')}>
                <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} />
                <span>Use <span className="font-mono text-ink-1">{custom}</span> as typed</span>
              </button>
            )}
            {!count && <p className="px-2 py-4 text-center text-small text-ink-3">No model matches.</p>}
          </div>
          {(hidden > 0 || snapshots || (listed && provider === 'openai')) && (
            <div className="flex items-start gap-3 text-meta text-ink-3">
              {listed && provider === 'openai' && <span className="min-w-0 flex-1">Pro, Codex and Deep Research models run only on OpenAI&apos;s Responses API, so they are not listed.</span>}
              {(hidden > 0 || snapshots) && (
                <button type="button" onClick={() => { setSnapshots(v => !v); setActive(0); }} className={cx('ml-auto shrink-0 rounded-control font-medium text-ink-2 hover:text-ink-1', FOCUS_RING)}>
                  {snapshots ? 'Hide dated versions' : `Show ${hidden} dated`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
