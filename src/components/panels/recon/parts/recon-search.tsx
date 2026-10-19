'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { SearchField } from '@/components/ui/search-field';
import { useT } from '@/components/ui/use-t';
import { namedTools, toolById } from '@/components/panels/recon/recon-tools';
import { flatSuggestions, suggestTools, type Suggestion } from '@/lib/intel/recon/suggest-tools';

/** Recon's front door: one field that works out what was typed and offers the tools that fit, Enter running the best. */
export function ReconSearch({ id, query, setQuery, onRun, onOpen, autoFocus }: {
  id?: string;
  query: string;
  setQuery: (q: string) => void;
  onRun: (toolId: string, query: string) => void;
  onOpen: (toolId: string) => void;
  autoFocus?: boolean;
}) {
  const t = useT();
  const groups = useMemo(() => suggestTools(query, namedTools(t)), [query, t]);
  const items = flatSuggestions(groups);
  const [picked, setPicked] = useState(0);
  const [pickedFor, setPickedFor] = useState(query);
  // A new query starts the highlight over at the best match.
  if (pickedFor !== query) { setPickedFor(query); setPicked(0); }
  const active = Math.min(picked, Math.max(items.length - 1, 0));

  const choose = (s: Suggestion) => (s.action === 'run' ? onRun(s.id, query) : onOpen(s.id));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setPicked((active + step + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[active]);
    }
  };

  const current = items[active] && toolById(items[active].id);
  let index = 0;
  return (
    <div className="flex flex-col">
      <p className="sr-only" aria-live="polite">
        {current ? t('{tool}, {n} of {total}. Enter to {action, select, run {run} other {open}}.', {
          tool: t(current.label), n: active + 1, total: items.length, action: items[active].action,
        }) : ''}
      </p>
      <SearchField
        id={id}
        value={query}
        onChange={setQuery}
        onKeyDown={onKeyDown}
        placeholder={t('IP, domain, email, username or phone')}
        label={t('Look up an IP, domain, email, username or phone number')}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
      />
      {groups.map(group => (
        <PanelSection key={group.label} title={t(group.label)}>
          {group.items.map(s => {
            const tool = toolById(s.id);
            const i = index++;
            if (!tool) return null;
            return (
              <ListRow
                key={`${s.action}-${s.id}`}
                leading={<tool.icon aria-hidden className="size-4" strokeWidth={1.75} />}
                title={t(tool.label)}
                subtitle={<span className="text-ink-3">{t(tool.blurb)}</span>}
                selected={i === active}
                trailing={i === active ? <span className="flex pointer-coarse:hidden"><Kbd size="sm">↵</Kbd></span> : undefined}
                onClick={() => choose(s)}
              />
            );
          })}
        </PanelSection>
      ))}
    </div>
  );
}
