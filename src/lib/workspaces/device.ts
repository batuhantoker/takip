import { DEVICE_KEYS, hasDeviceState, readDeviceState } from './stored-parts';
import type { WorkspaceStateV1 } from './state';

/** What this device remembers about workspaces, in its own localStorage. */

export const IMPORTED_NAME = 'Imported from this device';

const OFFERED_KEY = 'takip.workspaces.import-offered';
const CURRENT_KEY = 'takip.workspaces.current';
// The device's own keys, kept aside while a shared workspace is on screen (the page persists what it shows).
const BACKUP_KEY = 'takip.workspaces.shared-backup';

const safely = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** The first sign-in on a device with something saved locally offers it once, whatever the answer. */
export const shouldOfferImport = (storage: Storage) =>
  safely(() => storage.getItem(OFFERED_KEY) === null && hasDeviceState(storage), false);

export const markImportOffered = (storage: Storage) => safely(() => storage.setItem(OFFERED_KEY, String(Date.now())), undefined);

/**
 * Saves this device's state as a new workspace, once: a second call while or after the first runs
 * returns null instead of making a duplicate.
 */
export function createImporter<T>(storage: Storage, create: (name: string, state: WorkspaceStateV1) => Promise<T>) {
  let started: Promise<T> | null = null;
  return (): Promise<T> | null => {
    if (started) return null;
    markImportOffered(storage);
    started = create(IMPORTED_NAME, readDeviceState(storage));
    return started;
  };
}

/** The workspace this device last had open, per account. */
export function readCurrent(storage: Storage, userId: string): string | null {
  return safely(() => {
    const saved = JSON.parse(storage.getItem(CURRENT_KEY) ?? 'null') as { userId?: unknown; id?: unknown } | null;
    return saved?.userId === userId && typeof saved.id === 'string' ? saved.id : null;
  }, null);
}

export function writeCurrent(storage: Storage, userId: string, id: string | null) {
  safely(() => (id ? storage.setItem(CURRENT_KEY, JSON.stringify({ userId, id })) : storage.removeItem(CURRENT_KEY)), undefined);
}

/** Keeps the device's own keys before a shared workspace replaces what the page shows; the first backup wins. */
export function backUpDevice(storage: Storage) {
  safely(() => {
    if (storage.getItem(BACKUP_KEY) !== null) return;
    storage.setItem(BACKUP_KEY, JSON.stringify(Object.fromEntries(DEVICE_KEYS.map(key => [key, storage.getItem(key)]))));
  }, undefined);
}

/** Puts the backed-up keys back, if any; true when it did. */
export function restoreDevice(storage: Storage): boolean {
  return safely(() => {
    const raw = storage.getItem(BACKUP_KEY);
    if (raw === null) return false;
    for (const [key, value] of Object.entries(JSON.parse(raw) as Record<string, string | null>)) {
      if (!DEVICE_KEYS.includes(key)) continue;
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    }
    storage.removeItem(BACKUP_KEY);
    return true;
  }, false);
}
