/** What a story or tour gets to build its scene with. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Scene } from '../scene';

export interface Context {
  /** The short's folder. */
  dir: string;
  /** The running app, e.g. http://localhost:3000. */
  base: string;
  /** Options from the command line (--from 252 → { from: '252' }). */
  args: Record<string, string>;
  /** Runs `make` once per short and keeps its result, so re-rendering uses the same data and the same wording. */
  once<T>(name: string, make: () => Promise<T>): Promise<T>;
}

export interface Maker {
  id: string;
  kind: Scene['kind'];
  /** One line for `shorts list`. */
  about: string;
  /** Named variants (`--preset`), each its own story in the library. */
  presets?: string[];
  make(ctx: Context): Promise<Scene>;
}

export function context(dir: string, base: string, args: Record<string, string>): Context {
  return {
    dir,
    base,
    args,
    async once<T>(name: string, make: () => Promise<T>) {
      const path = join(dir, `cache.${name}.json`);
      if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as T;
      const value = await make();
      writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
      return value;
    },
  };
}
