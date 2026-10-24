'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { useDismiss } from '@/components/ui/use-dismiss';
import { matchCountries, type CountryOption } from '@/lib/platform/site/compare/country-search';

/**
 * A country typed or picked from the list under it. The field itself is what the form sends, so a name typed without
 * scripts works too: the server takes a slug or a name (compare/countries.ts findCountry). `submit` sends the form
 * the moment a country is picked.
 */
export function CountryPicker({ name, options, label, placeholder, empty, submit = false, required = false, look }: {
  name: string;
  options: CountryOption[];
  label: string;
  placeholder: string;
  /** Said when nothing matches. */
  empty: string;
  submit?: boolean;
  required?: boolean;
  look: 'chip' | 'field';
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useId();
  const hits = useMemo(() => matchCountries(options, text), [options, text]);
  useDismiss(open, () => setOpen(false), box);

  useEffect(() => {
    if (open) document.getElementById(`${list}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, list]);

  const pick = (o: CountryOption) => {
    flushSync(() => {
      setText(o.name);
      setOpen(false);
    });
    if (submit) input.current?.form?.requestSubmit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive(i => Math.max(0, Math.min(hits.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' && open && hits[active]) {
      e.preventDefault();
      pick(hits[active]);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={box} className={cx('relative', look === 'chip' ? 'w-[15rem] max-w-full' : 'min-w-0 flex-1')}>
      <input ref={input} name={name} type="text" role="combobox" aria-label={label} aria-expanded={open} aria-controls={list} aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${list}-${active}` : undefined} autoComplete="off" spellCheck={false} required={required}
        placeholder={placeholder} value={text} onKeyDown={onKeyDown} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onChange={e => { setText(e.target.value); setActive(0); setOpen(true); }}
        className={cx(
          'w-full min-w-0 text-ink-1 placeholder:text-ink-3', FOCUS_RING,
          look === 'chip'
            ? 'h-8 rounded-full border border-dashed border-line-strong bg-surface-1 px-3 text-[13px]'
            : 'h-10 rounded-control border border-line-strong bg-surface-2 px-3 text-[14px]',
        )} />
      {open && (
        <ul id={list} role="listbox" aria-label={label}
          className="absolute top-full left-0 z-50 mt-1 max-h-72 w-full min-w-[14rem] overflow-auto rounded-float border border-line bg-surface-1 p-1 shadow-float">
          {hits.length ? hits.map((o, i) => (
            <li key={o.slug} id={`${list}-${i}`} role="option" aria-selected={i === active}
              onPointerDown={e => e.preventDefault()} onPointerMove={() => setActive(i)} onClick={() => pick(o)}
              className={cx('cursor-pointer rounded-control px-2.5 py-1.5 text-[13px]', i === active ? 'bg-surface-2 text-ink-1' : 'text-ink-2')}>
              {o.name}
              {o.also && <span className="ml-1.5 text-ink-3">{o.also}</span>}
            </li>
          )) : <li className="px-2.5 py-1.5 text-[13px] text-ink-3">{empty}</li>}
        </ul>
      )}
    </div>
  );
}
