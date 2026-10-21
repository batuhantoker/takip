import { msg } from '@/lib/core/i18n/translator';

/** How TAKIP describes itself to search engines and link previews. Keep it true of what the map shows today. */
export const SITE_NAME = 'TAKIP';

// Keywords first: nobody searches for the name yet.
export const SITE_TITLE = msg('Live map of flights, ships, satellites and cameras · TAKIP');

// Search results cut a description past ~130 characters.
export const SITE_DESCRIPTION = msg(
  'Live flights, ships, satellites, public cameras, earthquakes and weather on one free world map, with replay and a history atlas.',
);

export const SITE_PITCH = msg('a free live map of public data: flights, ships, satellites, cameras, weather and earthquakes');

/**
 * schema.org for every page: the site and who publishes it.
 * No WebApplication node: Google requires a rating or review on one, and TAKIP has none to show.
 */
export function siteJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: SITE_NAME,
        url: origin,
        description: SITE_DESCRIPTION,
        publisher: { '@id': `${origin}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: SITE_NAME,
        url: origin,
        logo: `${origin}/android-chrome-512x512.png`,
      },
    ],
  };
}
