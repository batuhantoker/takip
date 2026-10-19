import { msg } from '@/lib/core/i18n/translator';

/** How TAKIP describes itself to search engines and link previews. Keep it true of what the map shows today. */
export const SITE_NAME = 'TAKIP';

export const SITE_TITLE = msg('TAKIP · Live map of flights, ships, satellites and cameras');

export const SITE_DESCRIPTION = msg(
  'Watch the world as it happens: live flights, ships, satellites, public cameras, earthquakes, weather and news on one free map, with replay and a historical atlas.',
);

export const SITE_PITCH = msg('a free live map of public data: flights, ships, satellites, cameras, weather and earthquakes');

export const FEATURES = [
  'Live aircraft from ADS-B receivers (OpenSky, adsb.fi, adsb.lol)',
  'Live ships from AIS, with traffic through the main maritime chokepoints',
  'Satellites placed from CelesTrak orbital elements, the ISS and Starlink among them',
  'Public traffic and city cameras around the world',
  'Earthquakes from USGS and EMSC, wildfires from NASA FIRMS, severe weather alerts',
  'Weather: rain radar, wind, temperature, lightning and live satellite imagery',
  'Rocket launches, the aurora forecast and a 3D view of the solar system',
  'Replay of recorded flights and ships, and a historical atlas of world borders',
];

/** schema.org for every page: the site, and the app it is. */
export function siteJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${origin}/#website`, name: SITE_NAME, url: origin, description: SITE_DESCRIPTION },
      {
        '@type': 'WebApplication',
        '@id': `${origin}/#app`,
        name: SITE_NAME,
        url: origin,
        description: SITE_DESCRIPTION,
        applicationCategory: 'ReferenceApplication',
        operatingSystem: 'Web',
        browserRequirements: 'A browser with WebGL',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: FEATURES,
        screenshot: `${origin}/og-image.png`,
      },
    ],
  };
}
