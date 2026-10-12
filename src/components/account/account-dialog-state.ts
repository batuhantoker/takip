import { useSyncExternalStore } from 'react';

export type View =
  | { kind: 'sign-in'; notice?: string }
  | { kind: 'sign-up' }
  | { kind: 'forgot'; notice?: string }
  | { kind: 'new-password'; token: string }
  | { kind: 'settings'; notice?: string }
  | { kind: 'two-factor' }
  | { kind: 'sent'; title: string; body: string };

/* One dialog for the whole page: on phones the desktop status cluster is mounted but hidden, so a
   dialog owned by its button would open out of sight. */
let current: View | null = null;
const listeners = new Set<() => void>();

export function showAccountDialog(view: View | null) {
  current = view;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAccountDialog() {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
