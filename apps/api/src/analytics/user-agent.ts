export type Agent = { browser: string; os: string; device: 'mobile' | 'tablet' | 'desktop' };

// Order matters: Edge and Chrome-on-iOS also say "Chrome"/"Safari", and every Chromium says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\/|Chromium\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const OSES: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux|CrOS|X11/, 'Linux'],
];

/** Coarse browser, OS and device class, enough for a breakdown; anything unrecognised is 'Other'. */
export function parseUserAgent(ua: string | null | undefined): Agent {
  const s = ua ?? '';
  const browser = BROWSERS.find(([re]) => re.test(s))?.[1] ?? 'Other';
  const os = OSES.find(([re]) => re.test(s))?.[1] ?? 'Other';
  const device = /iPad|Tablet/.test(s) || (/Android/.test(s) && !/Mobile/.test(s)) ? 'tablet' : /Mobi|iPhone|iPod/.test(s) ? 'mobile' : 'desktop';
  return { browser, os, device };
}

const HINTED_OS: Record<string, string> = { Windows: 'Windows', macOS: 'macOS', Linux: 'Linux', 'Chrome OS': 'Linux', 'Chromium OS': 'Linux', Android: 'Android' };

/**
 * A Chromium passing for another browser: the client hints it sends with every request (Sec-CH-UA, Sec-CH-UA-Platform)
 * name another system or version than its user agent does. Headless Chrome given a desktop user agent keeps its real hints.
 */
export function disguisedAgent(ua: string | null | undefined, brands: string | undefined, platform: string | undefined) {
  if (!ua) return false;
  const { os } = parseUserAgent(ua);
  const hinted = HINTED_OS[platform?.replaceAll('"', '') ?? ''];
  // Android's "desktop site" sends a Linux user agent.
  if (hinted && os !== 'Other' && hinted !== os && !(hinted === 'Android' && os === 'Linux')) return true;
  const version = /Chrome\/(\d+)/.exec(ua)?.[1];
  const hintedVersion = brands && /"Chromium";v="(\d+)"/.exec(brands)?.[1];
  return !!version && !!hintedVersion && version !== hintedVersion;
}
