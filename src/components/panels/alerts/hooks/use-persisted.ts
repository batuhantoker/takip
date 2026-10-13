'use client';

import { useCallback, useState } from 'react';

/** A choice worth keeping between visits. Storage may be missing or full; the choice still works for the session. */
export function usePersisted<T>(key: string, fallback: T, valid: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw == null ? null : JSON.parse(raw);
      return valid(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback((next: T) => {
    setValue(next);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode or quota */ }
  }, [key]);
  return [value, set] as const;
}
