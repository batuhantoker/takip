'use client';

import { useCallback, useState } from 'react';

/** A timeline choice kept between visits, such as its range. Without storage it still holds for the visit. */
export function useRemembered<T extends string>(key: string, fallback: T, options: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return options.find(o => o === saved) ?? fallback;
    } catch {
      return fallback;
    }
  });
  const remember = useCallback((next: T) => {
    setValue(next);
    try { window.localStorage.setItem(key, next); } catch { /* storage blocked */ }
  }, [key]);
  return [value, remember] as const;
}
