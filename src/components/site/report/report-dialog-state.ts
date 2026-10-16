import { useSyncExternalStore } from 'react';

/** `point`: where on the map the reporter right-clicked, when they started there. */
export type ReportRequest = { ts: number; point?: { lat: number; lng: number } };

/* One dialog for the whole page, as account-dialog-state.ts: the More menu and the map's right-click menu both
   open it, and only the page holds the map state a report attaches. */
let current: ReportRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function showReportDialog(point?: { lat: number; lng: number }) {
  current = { ts: Date.now(), ...(point && { point }) };
  emit();
}

export function closeReportDialog() {
  current = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReportDialog() {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
