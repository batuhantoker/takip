import { z } from '@hono/zod-openapi';

export const DossierLocation = z
  .object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
    country_code: z.string().openapi({ description: 'ISO 3166-1 alpha-2.' }),
    display_name: z.string().openapi({ description: '"city, state, country", each named once.' }),
  })
  .partial()
  .openapi('DossierLocation', { description: 'Empty when the point names no place: open sea, or a lookup that failed.' });
export type DossierLocation = z.infer<typeof DossierLocation>;

const CountryProfile = z
  .object({
    name: z.string(),
    official_name: z.string(),
    capital: z.string().optional(),
    population: z.number().optional(),
    area: z.number().optional().openapi({ description: 'km².' }),
    region: z.string().optional().openapi({ description: 'The continent.' }),
    subregion: z.string().optional().openapi({ description: 'The continent, as region.' }),
    languages: z.array(z.string()).openapi({ description: 'Official languages, at most four.' }),
    currencies: z.array(z.string()).openapi({ description: 'At most three.' }),
    flag_url: z.string().optional(),
    timezones: z.array(z.string()).openapi({ description: 'Always empty.' }),
  })
  .openapi('CountryProfile');

const HeadOfState = z.object({ name: z.string(), position: z.string() }).openapi('HeadOfState');

const WikipediaSummary = z
  .object({
    title: z.string(),
    extract: z.string().optional().openapi({ description: 'The lead, cut to 500 characters.' }),
    thumbnail: z.string().optional(),
  })
  .openapi('WikipediaSummary');

const TravelAdvisory = z
  .object({
    issuer: z.enum(['UK FCDO', 'US State Department', 'Australia Smartraveller']),
    iso2: z.string(),
    country: z.string().openapi({ description: "The issuer's name for the place; one country can have several pages." }),
    level: z.number().int().min(0).max(4).openapi({
      description:
        "FCDO's scale: 0 no warning, 1 against all but essential travel to parts, 2 against all but essential travel, " +
        '3 against all travel to parts, 4 against all travel.',
    }),
    label: z.string().openapi({ description: "The issuer's own wording." }),
    statuses: z.array(z.string()),
    change: z.string().nullable(),
    updated_at: z.string().nullable(),
    url: z.string(),
  })
  .openapi('TravelAdvisory');

const Displacement = z
  .object({
    iso2: z.string(),
    year: z.number().int(),
    refugees_from: z.number(),
    asylum_seekers_from: z.number(),
    idps: z.number().openapi({ description: 'Displaced inside the country.' }),
    refugees_hosted: z.number(),
    asylum_seekers_hosted: z.number(),
    source: z.literal('UNHCR'),
    url: z.string(),
  })
  .openapi('Displacement');

const StreetCrime = z
  .object({
    month: z.string(),
    total: z.number().int(),
    top: z.array(z.object({ category: z.string(), label: z.string(), count: z.number().int() })),
    radius_miles: z.literal(1),
    source: z.literal('data.police.uk'),
    url: z.string(),
  })
  .openapi('StreetCrime', { description: 'Reported street crime within a mile, in the latest published month.' });

export const RegionDossier = z
  .object({
    coordinates: z.object({ lat: z.number(), lng: z.number() }),
    location: DossierLocation,
    country: CountryProfile.nullable(),
    head_of_state: HeadOfState.nullable(),
    wikipedia: WikipediaSummary.nullable(),
    travel_advice: z.array(TravelAdvisory).openapi({ description: 'UK, US and Australian advice for the country.' }),
    displacement: Displacement.nullable(),
    street_crime: StreetCrime.nullable().openapi({ description: 'England, Wales and Northern Ireland only.' }),
    unavailable: z.array(z.string()).openapi({
      description: 'Sources that failed, so their silence never reads as "no warning": an advice issuer, "Travel advice", "UNHCR" or "data.police.uk".',
    }),
    attribution: z.string().openapi({ description: 'The place was named by OpenStreetMap.' }),
    timestamp: z.string(),
  })
  .openapi('RegionDossier');
