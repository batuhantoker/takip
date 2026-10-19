import type { Locale } from '@/lib/core/i18n/locales';

/** Scripts the share card's built-in font (Geist, Latin) can't draw, and the Noto family that can. */
const SCRIPT_FAMILY: Partial<Record<Locale, string>> = { ru: 'Noto Sans', ar: 'Noto Sans Arabic', zh: 'Noto Sans SC', ja: 'Noto Sans JP' };

export type OgFont = { name: string; data: ArrayBuffer; weight: 400; style: 'normal' };

const cache = new Map<string, Promise<OgFont[] | null>>();

async function subset(family: string, text: string): Promise<ArrayBuffer | null> {
  // Browsers too old for WOFF2 get WOFF, which Satori can read; text= keeps the file to these glyphs.
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0' },
    signal: AbortSignal.timeout(5_000),
  }).then(r => (r.ok ? r.text() : ''));
  const url = /src: url\((https:[^)]+)\) format\('(?:woff|truetype|opentype)'\)/.exec(css)?.[1];
  if (!url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  return res.ok ? res.arrayBuffer() : null;
}

/**
 * Fonts for a share card in `locale`, or undefined for Latin scripts (the built-in font draws them). Null when
 * the fonts can't be fetched: the caller then draws the card in English rather than in empty boxes.
 */
export async function ogFonts(locale: Locale, text: string): Promise<OgFont[] | null | undefined> {
  const family = SCRIPT_FAMILY[locale];
  if (!family) return undefined;
  const glyphs = [...new Set(text)].join('');
  const key = `${locale}:${glyphs}`;
  if (!cache.has(key)) {
    cache.set(key, Promise.all([subset('Geist', glyphs), subset(family, glyphs)])
      .then(([latin, script]) => (latin && script
        ? [{ name: 'Geist', data: latin, weight: 400, style: 'normal' } as const, { name: family, data: script, weight: 400, style: 'normal' } as const]
        : null))
      .catch(() => null));
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return cache.get(key)!;
}

export const ogFontFamily = (locale: Locale) => (SCRIPT_FAMILY[locale] ? `Geist, ${SCRIPT_FAMILY[locale]}` : 'Geist');
