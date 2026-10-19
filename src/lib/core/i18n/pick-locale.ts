import { COUNTRY_LANGUAGES } from './country-languages';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';

/**
 * The browser's languages, best first, as lower-case base codes. Traditional Chinese reads as 'zh-hant', and so
 * does a bare 'zh' listed after it: that browser asked for Traditional, which TAKIP doesn't ship.
 */
export function browserLanguages(header: string | null | undefined): string[] {
  if (!header) return [];
  const ranked = header.split(',').map((part, i) => {
    const [tag, ...params] = part.trim().split(';');
    const q = params.map(p => p.trim()).find(p => p.startsWith('q='));
    return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) : 1, i };
  }).filter(r => r.tag && r.tag !== '*' && r.q > 0 && Number.isFinite(r.q));
  ranked.sort((a, b) => b.q - a.q || a.i - b.i);
  const out: string[] = [];
  let traditional = false;
  for (const { tag } of ranked) {
    const [base, ...rest] = tag.split('-');
    let code = base;
    if (base === 'zh') {
      if (rest.some(s => ['tw', 'hk', 'mo', 'hant'].includes(s))) traditional = true;
      else if (rest.some(s => ['cn', 'sg', 'hans'].includes(s))) traditional = false;
      code = traditional ? 'zh-hant' : 'zh';
    }
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

/** An ISO country code from the edge (Cloudflare, Vercel, CloudFront); nothing for unknown or Tor. */
export function edgeCountry(headers: Pick<Headers, 'get'>): string | null {
  for (const name of ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country']) {
    const v = headers.get(name)?.trim().toUpperCase();
    if (v && /^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1') return v;
  }
  return null;
}

/**
 * Which language to show: an explicit pick, else the country's (the browser chooses among a multilingual
 * country's languages), else the browser's, else English. A spoofed country only changes the spoofer's view.
 */
export function pickLocale({ saved, country, acceptLanguage }: { saved?: string | null; country?: string | null; acceptLanguage?: string | null }): Locale {
  if (isLocale(saved)) return saved;
  const browser = browserLanguages(acceptLanguage);
  const spoken = (country && COUNTRY_LANGUAGES[country.toUpperCase()]) || [];
  const shared = spoken.find(lang => isLocale(lang) && browser.includes(lang));
  if (isLocale(shared)) return shared;
  if (isLocale(spoken[0])) return spoken[0];
  return browser.find(isLocale) ?? DEFAULT_LOCALE;
}
