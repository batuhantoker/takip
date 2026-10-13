'use client';

import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION, type IconType } from './class-names';
import { Kbd } from './kbd';

/** One action in a Popover menu: icon, words, an optional key or value on the right. */
export function MenuItem({ icon: Icon, children, hint, kbd, onSelect, danger, selected, disabled, href, external }: {
  icon?: IconType;
  children: ReactNode;
  /** Quiet text on the right, such as the current value. */
  hint?: ReactNode;
  kbd?: string;
  onSelect?: () => void;
  danger?: boolean;
  /** For a choice among several: draws it as the current one. */
  selected?: boolean;
  disabled?: boolean;
  href?: string;
  external?: boolean;
}) {
  const cls = cx(
    'flex h-8 w-full items-center gap-2.5 rounded-control px-2 text-left text-body whitespace-nowrap',
    danger ? 'text-red hover:bg-red/10' : selected ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1',
    'disabled:cursor-not-allowed disabled:opacity-40',
    FOCUS_RING,
    TRANSITION,
  );
  const body = (
    <>
      {Icon && <Icon aria-hidden className="size-4 shrink-0 text-current opacity-80" strokeWidth={1.75} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-small text-ink-3">{hint}</span>}
      {kbd && <Kbd size="sm">{kbd}</Kbd>}
    </>
  );
  if (href) {
    return (
      <a role="menuitem" href={href} className={cls} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} onClick={onSelect}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" role={selected === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={selected} disabled={disabled} onClick={onSelect} className={cls}>
      {body}
    </button>
  );
}

/** A hairline between groups of menu items. */
export function MenuDivider() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-line" />;
}
