import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, type Translate } from '@/lib/core/i18n/translator';

const ENGLISH = createTranslator(DEFAULT_LOCALE, {});

/** "Chrome on macOS" from a user agent, for the account's list of signed-in devices. */
export function describeDevice(userAgent: string | null | undefined, t: Translate = ENGLISH): string {
  const ua = userAgent ?? '';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  // Order matters: iOS and Android agents also mention Mac OS X and Linux.
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : null;
  if (browser && os) return t('{browser} on {os}', { browser, os });
  return browser ?? os ?? t('Unknown device');
}

const UNITS = [
  ['minute', 60],
  ['hour', 60 * 60],
  ['day', 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
] as const;

/** "5 minutes ago", "yesterday", "2 months ago". */
export function timeAgo(date: Date | string, now = Date.now(), t: Translate = ENGLISH): string {
  const seconds = (now - new Date(date).getTime()) / 1000;
  if (seconds < 60) return t('just now');
  const format = new Intl.RelativeTimeFormat(t.intl, { numeric: 'auto' });
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [unit, size] = UNITS[i];
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  }
  return t('just now');
}
