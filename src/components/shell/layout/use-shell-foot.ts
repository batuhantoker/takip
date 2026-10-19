'use client';

import { useEffect } from 'react';

/**
 * How tall the desktop's bottom edge is (the status bar, or a timeline's strip), as --shell-foot on <html>:
 * the sidebar, the panel column and panels portalled to <body> all stop above it. Null leaves the default.
 */
export function useShellFoot(px: number | null) {
  useEffect(() => {
    const root = document.documentElement.style;
    if (px === null) root.removeProperty('--shell-foot');
    else root.setProperty('--shell-foot', `${px}px`);
    return () => { root.removeProperty('--shell-foot'); };
  }, [px]);
}
