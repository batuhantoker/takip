/**
 * TI's browser storage moved from takip.oi.* to takip.ai.* on 2026-10-16. What is still under an old
 * name moves over once, in both stores, and kept chat turns change role from "oi" to "ai" on the way.
 */
const OLD = 'takip.oi.';
const NEW = 'takip.ai.';

/** Moves the old keys; a value already under the new name wins. Returns how many moved. */
export function migrateStorage(stores: (Storage | null | undefined)[]): number {
  let moved = 0;
  for (const s of stores) {
    if (!s) continue;
    // Read the keys first: removing while walking by index would skip some.
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(OLD)) keys.push(k);
    }
    for (const k of keys) {
      const value = s.getItem(k);
      const to = NEW + k.slice(OLD.length);
      if (value !== null && s.getItem(to) === null) {
        s.setItem(to, value.replace(/"role":"oi"/g, '"role":"ai"'));
        moved++;
      }
      s.removeItem(k);
    }
  }
  return moved;
}
