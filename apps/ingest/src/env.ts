import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/** The repo's .env.local, then .env, as Next reads them. Earlier files and real env vars win. */
export function loadEnvFiles() {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(join(repoRoot, file))) process.loadEnvFile(join(repoRoot, file));
  }
}

// npm runs this workspace from apps/ingest; relative paths in .env mean the repo root, as they do for Next.
const fromRoot = (path: string) => (isAbsolute(path) ? path : resolve(repoRoot, path));

// OSIRIS_* are the pre-rename names; a deployed .env may still use them.
export function ingestEnv(source: NodeJS.ProcessEnv = process.env) {
  const dataDir = fromRoot(source.TAKIP_DATA_DIR || source.OSIRIS_DATA_DIR || 'data');
  return {
    dataDir,
    archiveDir: fromRoot(source.TAKIP_ARCHIVE_DIR || source.OSIRIS_ARCHIVE_DIR || join(dataDir, 'archive')),
    webUrl: source.TAKIP_WEB_URL || source.OSIRIS_WEB_URL || undefined,
  };
}
