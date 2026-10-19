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
