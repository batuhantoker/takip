import { createRoute, OpenAPIHono, z, type RouteHandler } from '@hono/zod-openapi';
import { advisoriesFor } from '@takip/connectors/advisories/lookup';
import type { Advisory } from '@takip/connectors/advisories/types';
import { ATTRIBUTION } from '@takip/connectors/nominatim';
import { streetCrimeNear } from '@takip/connectors/police-uk';
import { displacementFor } from '@takip/connectors/unhcr';
import { ErrorBody, json, queryParam } from '../schemas';
import { placeAt } from './place';
import { RegionDossier, type DossierLocation } from './schemas';
import { countryFacts } from './wikidata';
import { wikipediaSummary } from './wikipedia';

/**
 * TAKIP — Region Dossier API
 * Provides country intelligence for any coordinate (double right-click on map)
 * Fix #115: Steps 2-4 now run in parallel via Promise.allSettled
 */

export const regionDossierRoute = createRoute({
  method: 'get',
  path: '/region-dossier',
  tags: ['Regions'],
  summary: 'Describe the place at a point',
  description:
    'The panel behind a double right-click on the map: the city and country a point falls in (Photon, over ' +
    "OpenStreetMap), the country's facts and head of state (Wikidata), a Wikipedia summary, UK, US and Australian " +
    'travel advice, UNHCR displacement figures and, in England, Wales and Northern Ireland, street crime within a ' +
    'mile (data.police.uk). A source that failed is named in `unavailable`. The US and Australian advice get 2.5 s: ' +
    'a slower issuer serves its last good copy, or is named unavailable if it has never answered.',
  request: {
    query: z.object({
      lat: queryParam().openapi({ param: { required: true }, description: 'Latitude; read as 0 when missing.', example: '50.4501' }),
      lng: queryParam().openapi({ param: { required: true }, description: 'Longitude; read as 0 when missing.', example: '30.5234' }),
    }),
  },
  responses: {
    200: {
      description:
        'The dossier. One that found no place (open sea, or a failed lookup) is sent with Cache-Control: no-store.',
      content: json(RegionDossier),
    },
    500: { description: 'The dossier could not be put together.', content: json(ErrorBody) },
  },
});

export const regionDossier: RouteHandler<typeof regionDossierRoute> = async c => {
  const query = c.req.valid('query');
  const lat = parseFloat(query.lat || '0');
  const lng = parseFloat(query.lng || '0');

  try {
    // Step 1: Which place was clicked (must complete first — other steps depend on it).
    const place = await placeAt(lat, lng);

    let countryName = '';
    let countryCode = '';
    let locationInfo: DossierLocation = {};

    if (place) {
      countryName = place.country || '';
      countryCode = (place.countrycode || '').toUpperCase();
      locationInfo = {
        city: place.city || '',
        state: place.state || '',
        country: countryName,
        country_code: countryCode,
        // Photon's own `name` is the nearest building or street, not the place.
        // A city-state is its own country, and "Singapore, Singapore" says it twice.
        display_name: [...new Set([place.city, place.state, countryName].filter(Boolean))].join(', '),
      };
    }

    // Steps 2-5: Run in PARALLEL after geocode
    const [wikiResult, wdResult, adviceResult, unhcrResult, crimeResult] = await Promise.allSettled([
      // Step 2: Fetch Wikipedia summary
      wikipediaSummary(locationInfo.city || countryName),
      // Step 3: Country facts and head of state.
      countryName ? countryFacts(countryName) : Promise.resolve(null),
      // Steps 4-5: UK, US and Australian travel advice and UNHCR displacement, by ISO code.
      countryCode ? advisoriesFor(countryCode, 2_500) : Promise.resolve(null),
      countryCode ? displacementFor(countryCode) : Promise.resolve(null),
      // Step 6: street crime, England, Wales and Northern Ireland only.
      countryCode === 'GB' ? streetCrimeNear(lat, lng) : Promise.resolve(null),
    ]);

    const wikiSummary = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
    const facts       = wdResult.status   === 'fulfilled' ? wdResult.value   : null;

    const countryData = facts?.country ?? null;
    const headOfState = facts?.head_of_state ?? null;
    const advice = adviceResult.status === 'fulfilled' ? adviceResult.value : null;
    const travelAdvice: Advisory[] = advice?.advisories ?? [];
    const displacement = unhcrResult.status === 'fulfilled' ? unhcrResult.value : null;
    const streetCrime = crimeResult.status === 'fulfilled' ? crimeResult.value : null;
    // A source that failed is named, so its silence never reads as "no warning" or "no displacement".
    const unavailable = [
      ...(adviceResult.status === 'rejected' ? ['Travel advice'] : (advice?.sources ?? []).filter(s => !s.ok).map(s => s.issuer)),
      unhcrResult.status === 'rejected' && 'UNHCR',
      crimeResult.status === 'rejected' && 'data.police.uk',
    ].filter((s): s is string => !!s);

    return c.json({
      coordinates: { lat, lng },
      location: locationInfo,
      country: countryData,
      head_of_state: headOfState,
      wikipedia: wikiSummary,
      travel_advice: travelAdvice,
      displacement,
      street_crime: streetCrime,
      unavailable,
      /** The place this dossier is about was named by OpenStreetMap. */
      attribution: ATTRIBUTION,
      timestamp: new Date().toISOString(),
    }, 200, {
      /* Only a dossier that found its place is worth keeping. An empty one
         is either open sea or a lookup that failed — Photon has its bad
         moments — and cached publicly it would be handed back for an hour,
         stale-while-revalidate, to the next click on that spot. */
      'Cache-Control': place
        ? 'public, s-maxage=3600, stale-while-revalidate=7200'
        : 'no-store',
    });
  } catch (error) {
    console.error('Region dossier error:', error);
    return c.json({ error: 'Failed to fetch region data' }, 500);
  }
};

export function regionDossierRoutes() {
  return new OpenAPIHono().openapi(regionDossierRoute, regionDossier);
}
