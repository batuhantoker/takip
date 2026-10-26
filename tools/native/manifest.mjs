import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const KINDS = [
  [/^TAKIP-(\d+\.\d+\.\d+)-android\.apk$/, 'android', 'apk', () => 'universal'],
  [/^TAKIP-(\d+\.\d+\.\d+)-mac-([a-z0-9_]+)\.dmg$/, 'macos', 'dmg', m => m[2]],
  [/^TAKIP-(\d+\.\d+\.\d+)-win-([a-z0-9_]+)\.exe$/, 'windows', 'exe', m => m[2]],
  [/^TAKIP-(\d+\.\d+\.\d+)-linux-([a-z0-9_]+)\.AppImage$/, 'linux', 'appimage', m => m[2]],
  [/^TAKIP-(\d+\.\d+\.\d+)-linux-([a-z0-9_]+)\.deb$/, 'linux', 'deb', m => m[2]],
];

/** What a build's file name says it is (src/lib/platform/native/downloads.ts reads the same), or null for files the page doesn't offer. */
export function describeFile(name) {
  for (const [pattern, platform, kind, arch] of KINDS) {
    const m = pattern.exec(name);
    if (m) return { platform, kind, arch: arch(m), version: m[1] };
  }
  return null;
}

/** The newest file of each platform, kind and arch; on a tie the earlier entry wins, so list fresh files first. */
export function newestOnly(files) {
  const order = v => v.split('.').reduce((n, part) => n * 1000 + Number(part), 0);
  const best = new Map();
  for (const f of files) {
    const key = `${f.platform}/${f.kind}/${f.arch}`;
    if (!best.has(key) || order(f.version) > order(best.get(key).version)) best.set(key, f);
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function sha256(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path).on('data', d => hash.update(d)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });
}
