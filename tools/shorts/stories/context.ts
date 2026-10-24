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
  /** Replaces what `once` kept, for facts that are retold as of each filming (a live tour's counts). */
  keep<T>(name: string, value: T): void;
  /** What `once` kept under a name, if anything: a cut whose sampling has changed since keeps the years its lines tell. */
  peek<T>(name: string): T | undefined;
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
  // a long cut samples and words its story differently, so it keeps its own caches beside the short's
  const path = (name: string) => join(dir, `cache.${name}${args.length === 'long' ? '.long' : ''}.json`);
  return {
    dir,
    base,
    args,
    async once<T>(name: string, make: () => Promise<T>) {
      if (existsSync(path(name))) return JSON.parse(readFileSync(path(name), 'utf8')) as T;
      const value = await make();
      writeFileSync(path(name), JSON.stringify(value, null, 2) + '\n');
      return value;
    },
    keep(name, value) {
      writeFileSync(path(name), JSON.stringify(value, null, 2) + '\n');
    },
    peek<T>(name: string) {
      return existsSync(path(name)) ? (JSON.parse(readFileSync(path(name), 'utf8')) as T) : undefined;
    },
  };
}
