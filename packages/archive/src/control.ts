import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Which sources the recorder writes, as set in the admin console (catalog.db meta_source.record).
 * A file rather than a database read, so the web process never loads a native SQLite module.
 */
export type Control = { v: 1; updatedAt: number; sources: Record<string, { record: boolean }> };

export const controlFile = (dir: string) => join(dir, 'control.json');

/** Atomic: readers see the old file or the new one, never half of one. */
export function writeControl(dir: string, sources: Control['sources'], now = Date.now()) {
  mkdirSync(dir, { recursive: true });
  const file = controlFile(dir);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ v: 1, updatedAt: now, sources } satisfies Control));
  renameSync(tmp, file);
}

/** Sources switched off; empty when there is no file, so a missing file records everything. */
export function readDisabled(dir: string): { disabled: Set<string>; mtimeMs: number } {
  try {
    const file = controlFile(dir);
    const mtimeMs = statSync(file).mtimeMs;
    const control = JSON.parse(readFileSync(file, 'utf8')) as Control;
    return { disabled: new Set(Object.entries(control.sources).filter(([, s]) => !s.record).map(([src]) => src)), mtimeMs };
  } catch {
    return { disabled: new Set(), mtimeMs: 0 };
  }
}
