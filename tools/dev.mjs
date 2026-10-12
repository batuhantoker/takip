import { spawn } from 'node:child_process';

// `npm run dev`: the web app and the accounts api in one terminal. Ctrl-C stops both.
const args = process.argv.slice(2);
const web = spawn('next', ['dev', ...args], { stdio: 'inherit' });
const api = spawn('npm', ['run', 'dev', '-w', '@takip/api'], { stdio: 'inherit' });

// The map still works without the api (only sign-in needs it), e.g. when one is already running elsewhere.
api.on('exit', code => {
  if (code) console.error(`[dev] api stopped (exit ${code}); sign-in is unavailable until it runs again.`);
});

web.on('exit', code => {
  api.kill('SIGTERM');
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    web.kill(signal);
    api.kill(signal);
  });
}
