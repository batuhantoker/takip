import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppPlatform } from './shell';

export type DownloadKind = 'apk' | 'dmg' | 'exe' | 'appimage' | 'deb';
export type DownloadFile = { platform: AppPlatform; kind: DownloadKind; arch: string; name: string; version: string; bytes: number; sha256: string; signed: boolean };
/** latest.json, written beside the files by tools/native/publish.mjs. */
export type Downloads = { date: string; files: DownloadFile[] };

const PLATFORMS: AppPlatform[] = ['ios', 'android', 'macos', 'windows', 'linux'];
const KINDS: DownloadKind[] = ['apk', 'dmg', 'exe', 'appimage', 'deb'];
// The names the route serves; anything else in the folder stays unreachable.
const NAME = /^TAKIP-(\d+\.\d+\.\d+)-[A-Za-z0-9_.-]+\.(?:apk|dmg|exe|AppImage|deb)$/;

export const MIME: Record<DownloadKind, string> = {
  apk: 'application/vnd.android.package-archive',
  dmg: 'application/x-apple-diskimage',
  exe: 'application/vnd.microsoft.portable-executable',
  appimage: 'application/octet-stream',
  deb: 'application/vnd.debian.binary-package',
};

export function parseDownloads(raw: unknown): Downloads | null {
  if (!raw || typeof raw !== 'object') return null;
  const { date, files } = raw as Record<string, unknown>;
  if (typeof date !== 'string' || !Array.isArray(files)) return null;
  const valid = files.filter((f): f is DownloadFile => !!f && typeof f === 'object'
    && PLATFORMS.includes(f.platform) && KINDS.includes(f.kind) && typeof f.arch === 'string'
    && typeof f.name === 'string' && NAME.test(f.name) && Number.isFinite(f.bytes) && /^[0-9a-f]{64}$/.test(f.sha256))
    .map(f => ({ ...f, version: NAME.exec(f.name)![1], signed: f.signed === true }));
  return { date, files: valid };
}

/** Where the files live: DOWNLOADS_DIR on the server, data/downloads in dev. */
export const downloadsDir = () => process.env.DOWNLOADS_DIR || path.join(process.cwd(), 'data/downloads');

let cached: { at: number; value: Promise<Downloads | null> } | null = null;

/** Every page asks (the links to /download show once there is something to get), so a read lasts a minute. */
export function readDownloads(): Promise<Downloads | null> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  // A missing or half-written file reads as nothing, never as an error every page would throw.
  const value = readFile(path.join(downloadsDir(), 'latest.json'), 'utf8').then(text => parseDownloads(JSON.parse(text))).catch(() => null);
  cached = { at: Date.now(), value };
  return value;
}

/** Store listings, set once each app is live; read at request time so they need no rebuild. */
export const storeLinks = (): Partial<Record<AppPlatform, string>> => ({
  ...(process.env.APP_STORE_URL ? { ios: process.env.APP_STORE_URL } : {}),
  ...(process.env.PLAY_STORE_URL ? { android: process.env.PLAY_STORE_URL } : {}),
});

/** Whether there is anything to get yet: a file on /download or a store listing. */
export async function appsOut(): Promise<boolean> {
  return Object.keys(storeLinks()).length > 0 || ((await readDownloads())?.files.length ?? 0) > 0;
}

/** The visitor's own system, so its download comes first. iPadOS asks for desktop pages as a Mac, and is taken for one. */
export function visitorPlatform(userAgent: string | null): AppPlatform | null {
  if (!userAgent) return null;
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  if (/Windows NT/.test(userAgent)) return 'windows';
  if (/Mac OS X|Macintosh/.test(userAgent)) return 'macos';
  if (/Linux|X11|CrOS/.test(userAgent)) return 'linux';
  return null;
}
