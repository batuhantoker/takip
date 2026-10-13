'use client';

import { useEffect, useState } from 'react';
import { applySettings, loadSavedSettings } from '@/lib/style-tokens';

export type ThemeId = 'core' | 'ghost';

/** Core or Ghost, as a class on <body>, plus any saved Style Studio overrides. */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>('core');

  useEffect(() => {
    document.body.className = theme === 'core' ? '' : `theme-${theme}`;
  }, [theme]);

  /* Style Studio overrides are inline on <body>, so they survive the theme
     swap above and only need reapplying once per load. */
  useEffect(() => {
    const saved = loadSavedSettings();
    if (saved) applySettings(saved);
  }, []);

  return [theme, setTheme] as const;
}
