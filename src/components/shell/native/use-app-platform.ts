'use client';

import { useSyncExternalStore } from 'react';
import type { AppPlatform } from '@/lib/platform/native/shell';

const never = () => () => {};

/** The app this page runs in (layout.tsx marks <html data-app>), or null in a browser. */
export function useAppPlatform(): AppPlatform | null {
  return useSyncExternalStore(never, () => (document.documentElement.dataset.app as AppPlatform | undefined) ?? null, () => null);
}

/** Whether /download has anything to get yet (layout.tsx marks <html data-apps>). */
export function useAppsOut(): boolean {
  return useSyncExternalStore(never, () => document.documentElement.dataset.apps !== undefined, () => false);
}
