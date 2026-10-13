'use client';

import { useEffect, useEffectEvent } from 'react';

// Keys typed into a field, or pressed on a control that answers them itself, are not the timeline's.
const OWN_KEYS = 'input, textarea, select, button, a, [contenteditable="true"], [role="slider"], [role="menu"], [role="dialog"]';

/** While a timeline shows: Space plays and pauses, J opens "Go to". The focused track handles its own arrows. */
export function useTimelineKeys(onTogglePlay: () => void, onGoTo: () => void) {
  const toggle = useEffectEvent(onTogglePlay);
  const goTo = useEffectEvent(onGoTo);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest(OWN_KEYS)) return;
      if (document.documentElement.hasAttribute('data-oi-theater')) return;
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        goTo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
