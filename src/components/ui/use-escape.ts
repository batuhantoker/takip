import { useEffect, useEffectEvent, type RefObject } from 'react';

type Entry = { run: () => void; root?: RefObject<HTMLElement | null> };

// Most recently opened last; only the top entry answers Escape.
const stack: Entry[] = [];

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  // Typing somewhere else, such as the map search, is not a request to close this.
  if (isEditable(e.target) && !top.root?.current?.contains(e.target as Node)) return;
  e.preventDefault();
  top.run();
}

/**
 * Escape closes the most recently opened surface that registered here, once.
 * Listens on window so document listeners (popovers, fields) get first say and
 * can claim the key with preventDefault.
 */
export function useEscape(onEscape: () => void, enabled = true, root?: RefObject<HTMLElement | null>) {
  const run = useEffectEvent(onEscape);
  useEffect(() => {
    if (!enabled) return;
    const entry: Entry = { run: () => run(), root };
    stack.push(entry);
    if (stack.length === 1) window.addEventListener('keydown', onKeyDown);
    return () => {
      stack.splice(stack.indexOf(entry), 1);
      if (stack.length === 0) window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, root]);
}
