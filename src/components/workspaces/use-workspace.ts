import { useEffect, useRef, useSyncExternalStore, type DependencyList } from 'react';
import { notifyWorkspaceChanged, registerWorkspacePart, type WorkspacePart } from '@/lib/workspaces/parts';
import { INITIAL_SNAPSHOT, workspaceSession } from '@/lib/workspaces/session';
import type { PartName } from '@/lib/workspaces/state';

const subscribe = (listener: () => void) => workspaceSession().subscribe(listener);
const snapshot = () => workspaceSession().get();
const serverSnapshot = () => INITIAL_SNAPSHOT;

/** The current workspace, its save state, and any shared view. */
export function useWorkspace() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/**
 * Plugs one part of the page into saved workspaces: `get` reads it for saving, `set` writes it when a
 * workspace opens. `deps` are what the part is read from; a change to them may autosave.
 */
export function useWorkspacePart<K extends PartName>(name: K, part: WorkspacePart<K>, deps: DependencyList) {
  const latest = useRef(part);
  useEffect(() => {
    latest.current = part;
  });
  useEffect(() => registerWorkspacePart(name, { get: () => latest.current.get(), set: value => latest.current.set(value) }), [name]);
  useEffect(notifyWorkspaceChanged, deps);
}
