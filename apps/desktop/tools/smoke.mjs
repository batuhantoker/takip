// npm run smoke -- <out.png> [dev.takip.app://…]: opens the app on TAKIP_APP_URL (default takip.dev), saves a picture, prints what the page saw.
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? 'smoke.png');
const run = spawnSync(electron, ['.', ...process.argv.slice(3)], { cwd: app, env: { ...process.env, TAKIP_SMOKE: out }, stdio: 'inherit' });
console.log(run.status === 0 ? `smoke ok: ${out}` : 'smoke failed');
process.exit(run.status ?? 1);
