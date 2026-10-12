import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import type { IngestCtx } from './context';

export const lockPath = (ctx: IngestCtx) => join(ctx.layout.dbDir, 'ingest.lock');

/** One worker per data directory (§7.3). A lock left by a dead process is taken over. */
export function acquireLock(path: string): () => void {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, 'wx');
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return () => {
        try {
          unlinkSync(path);
        } catch {
          // Already gone.
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const pid = Number(readFileSync(path, 'utf8'));
      if (pid && isAlive(pid)) throw new Error(`another ingest worker is running (pid ${pid}, lock ${path})`);
      unlinkSync(path);
    }
  }
  throw new Error(`could not take ${path}`);
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
