import type { Metadata } from 'next';
import { ogLocale, type Locale } from '@/lib/core/i18n/locales';
import { languageAlternates, localePath } from './locale-path';

/** A reading page's metadata in one language: its own URL as canonical, every language's URL as an alternate. */
export function readingMetadata({ locale, path, title, description, image, type = 'website' }: {
  locale: Locale;
  /** The English path, /map/earthquakes. */
  path: string;
  title: string;
  description: string;
  image: string;
  type?: 'website' | 'article';
}): Metadata {
  const url = localePath(locale, path);
  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: { title, description, url, type, siteName: 'TAKIP', locale: ogLocale(locale), images: [{ url: image, width: 1200, height: 630, alt: title }] },
  };
}

/** The share card for a reading page, drawn by /og in the page's language. */
export const readingImage = (page: string, locale: Locale) => `/og?page=${encodeURIComponent(page)}&lang=${locale}`;
