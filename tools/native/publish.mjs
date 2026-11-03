#!/usr/bin/env node
// Puts the app files on takip.dev/download. Nothing here runs on its own: a release is published only by hand.
//
//   node tools/native/publish.mjs collect                      the builds on this machine (apps/desktop/dist, the release APK)
//   node tools/native/publish.mjs collect --release apps-v1.2.0  the files CI attached to that GitHub release
//   node tools/native/publish.mjs push                         copies data/downloads to the NUC (DOWNLOADS_DIR there)
//
// collect copies into data/downloads, writes latest.json and drops files it no longer lists. Add
// --signed macos,windows once those builds are signed, so the page stops warning about them. A file already
// published under the same name with other contents is refused (caches keep it an hour): bump the version.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os, { tmpdir } from 'node:os';
import path from 'node:path';
import { describeFile, newestOnly, sha256 } from './manifest.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(REPO, 'data/downloads');
const nucFile = path.join(os.homedir(), '.config/takip/nuc');
const NUC = process.env.NUC ?? (existsSync(nucFile) ? readFileSync(nucFile, 'utf8').trim() : undefined);
// Signed builds and their releases run on the private repo, which holds the signing secrets.
const GH_REPO = 'batuhantoker/takip-private';

const [command, ...args] = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function localBuilds() {
  const found = [];
  const dist = path.join(REPO, 'apps/desktop/dist');
  if (existsSync(dist)) for (const name of readdirSync(dist)) if (describeFile(name)) found.push(path.join(dist, name));
  // Only a release-signed APK: a debug one couldn't be updated by the next release.
  const apk = path.join(REPO, 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk');
  if (existsSync(apk)) {
    const { version } = JSON.parse(readFileSync(path.join(REPO, 'apps/mobile/package.json'), 'utf8'));
    const named = path.join(mkdtempSync(path.join(tmpdir(), 'takip-apk-')), `TAKIP-${version}-android.apk`);
    copyFileSync(apk, named);
    found.push(named);
  }
  return found;
}

function releaseBuilds(tag) {
  const dir = mkdtempSync(path.join(tmpdir(), 'takip-release-'));
  execFileSync('gh', ['release', 'download', tag, '--repo', GH_REPO, '--dir', dir, '--pattern', 'TAKIP-*'], { stdio: 'inherit' });
  return readdirSync(dir).filter(describeFile).map(name => path.join(dir, name));
}

async function collect() {
  const tag = flag('release');
  const signed = new Set((flag('signed') ?? '').split(',').filter(Boolean));
  const sources = tag ? releaseBuilds(tag) : localBuilds();
  if (!sources.length) throw new Error(tag ? `no TAKIP-* files on release ${tag}` : 'no builds found; run the app builds first');

  mkdirSync(OUT, { recursive: true });
  const previous = existsSync(path.join(OUT, 'latest.json')) ? JSON.parse(readFileSync(path.join(OUT, 'latest.json'), 'utf8')).files : [];
  const fresh = [];
  for (const source of sources) {
    const name = path.basename(source);
    const info = describeFile(name);
    const sum = await sha256(source);
    // Caches keep a file by its name: new contents need a new version.
    const published = previous.find(p => p.name === name);
    if (published && published.sha256 !== sum && !args.includes('--replace')) {
      throw new Error(`${name} is already published with other contents; bump the version (or pass --replace)`);
    }
    copyFileSync(source, path.join(OUT, name));
    // An APK is always signed (release builds only); the desktop builds say so on the command line.
    fresh.push({ name, ...info, bytes: statSync(source).size, sha256: sum, signed: info.kind === 'apk' || signed.has(info.platform) });
  }
  const kept = previous.filter(p => existsSync(path.join(OUT, p.name)) && !fresh.some(f => f.name === p.name));
  const files = newestOnly([...fresh, ...kept]);
  for (const name of readdirSync(OUT)) if (describeFile(name) && !files.some(f => f.name === name)) rmSync(path.join(OUT, name));
  // Written beside it and renamed, so the site never reads half a manifest.
  writeFileSync(path.join(OUT, 'latest.json.tmp'), `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), files }, null, 2)}\n`);
  renameSync(path.join(OUT, 'latest.json.tmp'), path.join(OUT, 'latest.json'));
  for (const f of files) console.log(`${f.name}  ${(f.bytes / 1e6).toFixed(1)} MB${f.signed ? '' : '  (unsigned)'}`);
}

function push() {
  if (!existsSync(path.join(OUT, 'latest.json'))) throw new Error('nothing collected; run collect first');
  if (!NUC) throw new Error(`set NUC, or write the NUC's ssh target (user@host) to ${nucFile}`);
  execFileSync('ssh', [NUC, 'mkdir -p ~/takip/data/downloads'], { stdio: 'inherit' });
  // The files first and the manifest last, so the page never lists a file that isn't there yet.
  execFileSync('rsync', ['-av', '--exclude', 'latest.json', `${OUT}/`, `${NUC}:takip/data/downloads/`], { stdio: 'inherit' });
  execFileSync('rsync', ['-av', path.join(OUT, 'latest.json'), `${NUC}:takip/data/downloads/latest.json`], { stdio: 'inherit' });
  execFileSync('ssh', [NUC, `cd ~/takip/data/downloads && for f in TAKIP-*; do grep -q "\\"$f\\"" latest.json || rm -f "$f"; done`], { stdio: 'inherit' });
}

if (command === 'collect') await collect();
else if (command === 'push') push();
else {
  console.error('usage: node tools/native/publish.mjs collect [--release <tag>] [--signed macos,windows] | push');
  process.exit(1);
}
