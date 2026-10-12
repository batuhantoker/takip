import { useSyncExternalStore } from 'react';

export type WorkspaceDialog =
  | { kind: 'name'; mode: 'save-as' | 'new' | 'copy' }
  | { kind: 'share' }
  | { kind: 'open' };

/* One host for the dialogs: the chip may be mounted twice (desktop and phone), and a hidden one can't show them. */
let current: WorkspaceDialog | null = null;
const listeners = new Set<() => void>();

export function showWorkspaceDialog(dialog: WorkspaceDialog | null) {
  current = dialog;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWorkspaceDialog() {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
