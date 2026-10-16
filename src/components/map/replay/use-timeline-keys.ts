'use client';

import { useEffect, useEffectEvent } from 'react';

// Keys typed into a field, or pressed on a control that answers them itself, are not the timeline's.
const OWN_KEYS = 'input, textarea, select, button, a, [contenteditable="true"], [role="slider"], [role="menu"], [role="dialog"]';
// No button or slider answers "," or ".", so the jumps still work with the track or a timeline button focused.
const TYPING = 'input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"]';

/** While a timeline shows: Space plays and pauses, J opens "Go to", "," and "." jump back and ahead. The focused track handles its own arrows. */
export function useTimelineKeys(onTogglePlay: () => void, onGoTo: () => void, onJump?: (dir: -1 | 1) => void) {
  const toggle = useEffectEvent(onTogglePlay);
  const goTo = useEffectEvent(onGoTo);
  const jump = useEffectEvent((dir: -1 | 1) => onJump?.(dir));
  const canJump = !!onJump;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.documentElement.hasAttribute('data-ai-theater')) return;
      const target = e.target instanceof Element ? e.target : null;
      if (canJump && (e.key === ',' || e.key === '.')) {
        if (target?.closest(TYPING)) return;
        e.preventDefault();
        jump(e.key === ',' ? -1 : 1);
        return;
      }
      if (target?.closest(OWN_KEYS)) return;
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
  }, [canJump]);
}
