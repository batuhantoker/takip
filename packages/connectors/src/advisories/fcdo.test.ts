import { describe, expect, it } from 'vitest';
import { FCDO_SLUG_OVERRIDES, fcdoSlugFor, fetchFcdoAdvisory, mapFcdoPage, rankStatuses } from './fcdo';

// The 226 country slugs in the gov.uk travel-advice index, 2026-10-12.
const INDEX_SLUGS = new Set<string>([
  'eritrea', 'solomon-islands', 'saudi-arabia', 'thailand', 'mexico', 'panama', 'tanzania', 'peru',
  'bangladesh', 'kenya', 'chile', 'uganda', 'azerbaijan', 'bahrain', 'democratic-republic-of-the-congo',
  'ethiopia', 'palestine', 'belgium', 'albania', 'israel', 'iraq', 'iran', 'new-caledonia', 'egypt',
  'algeria', 'ukraine', 'turkey', 'switzerland', 'sweden', 'spain', 'slovenia', 'slovakia', 'serbia',
  'san-marino', 'romania', 'russia', 'portugal', 'poland', 'norway', 'north-macedonia', 'netherlands',
  'montenegro', 'monaco', 'moldova', 'mayotte', 'malta', 'luxembourg', 'lithuania', 'liechtenstein',
  'latvia', 'kosovo', 'italy', 'ireland', 'iceland', 'hungary', 'greece', 'gibraltar', 'germany', 'georgia',
  'france', 'finland', 'estonia', 'denmark', 'czechia', 'cyprus', 'croatia', 'bulgaria',
  'bosnia-and-herzegovina', 'belarus', 'austria', 'armenia', 'andorra', 'wallis-and-futuna', 'vietnam',
  'vanuatu', 'uzbekistan', 'tuvalu', 'turkmenistan', 'tonga', 'togo', 'timor-leste', 'tajikistan', 'taiwan',
  'sri-lanka', 'south-korea', 'singapore', 'seychelles', 'samoa', 'pitcairn-island', 'philippines',
  'papua-new-guinea', 'palau', 'pakistan', 'north-korea', 'new-zealand', 'nepal', 'nauru', 'myanmar',
  'mongolia', 'jordan', 'federated-states-of-micronesia', 'kuwait', 'lebanon', 'libya', 'mauritania',
  'morocco', 'oman', 'qatar', 'syria', 'marshall-islands', 'united-arab-emirates', 'maldives',
  'western-sahara', 'yemen', 'malaysia', 'anguilla', 'antigua-and-barbuda', 'macao', 'aruba', 'bahamas',
  'barbados', 'belize', 'laos', 'bermuda', 'bonaire-st-eustatius-saba', 'kyrgyzstan',
  'british-virgin-islands', 'kiribati', 'canada', 'cayman-islands', 'costa-rica', 'kazakhstan', 'cuba',
  'curacao', 'dominica', 'dominican-republic', 'el-salvador', 'grenada', 'guadeloupe', 'guatemala', 'haiti',
  'india', 'honduras', 'jamaica', 'martinique', 'montserrat', 'nicaragua', 'st-kitts-and-nevis', 'st-lucia',
  'st-maarten', 'st-martin-and-st-barthelemy', 'st-pierre-and-miquelon', 'st-vincent-and-the-grenadines',
  'trinidad-and-tobago', 'turks-and-caicos-islands', 'usa', 'argentina', 'bolivia', 'brazil',
  'antarctica-british-antarctic-territory', 'japan', 'colombia', 'ecuador', 'indonesia', 'falkland-islands',
  'french-guiana', 'hong-kong', 'guyana', 'paraguay', 'french-polynesia',
  'south-georgia-and-south-sandwich-islands', 'st-helena-ascension-and-tristan-da-cunha', 'fiji', 'suriname',
  'uruguay', 'venezuela', 'angola', 'benin', 'botswana', 'burkina-faso', 'burundi', 'cameroon',
  'cook-islands-tokelau-and-niue', 'cape-verde', 'comoros', 'central-african-republic', 'chad', 'congo',
  'cote-d-ivoire', 'djibouti', 'equatorial-guinea', 'china', 'eswatini', 'cambodia', 'brunei',
  'british-indian-ocean-territory', 'bhutan', 'gabon', 'the-gambia', 'ghana', 'guinea', 'guinea-bissau',
  'australia', 'afghanistan', 'lesotho', 'liberia', 'madagascar', 'malawi', 'mali', 'mauritius',
  'mozambique', 'namibia', 'niger', 'nigeria', 'reunion', 'rwanda', 'sao-tome-and-principe', 'senegal',
  'sierra-leone', 'somalia', 'south-africa', 'south-sudan', 'sudan', 'tunisia', 'zambia', 'zimbabwe',
]);

// Verbatim from /api/content/foreign-travel-advice/ukraine, 2026-10-12 (fields we read).
const UKRAINE = {
  title: 'Ukraine travel advice',
  public_updated_at: '2026-10-02T09:30:25+01:00',
  details: {
    alert_status: ['avoid_all_travel_to_parts', 'avoid_all_but_essential_travel_to_parts'],
    change_description: "Updated information about the Russian invasion of Ukraine ('Warnings and insurance' page).",
    country: { name: 'Ukraine', slug: 'ukraine', synonyms: [] },
  },
};

describe('mapFcdoPage', () => {
  it('ranks the worst status on the page', () => {
    expect(mapFcdoPage('ua', UKRAINE)).toEqual({
      issuer: 'UK FCDO',
      iso2: 'UA',
      country: 'Ukraine',
      level: 3,
      label: 'Advises against all travel to parts',
      statuses: ['avoid_all_travel_to_parts', 'avoid_all_but_essential_travel_to_parts'],
      change: "Updated information about the Russian invasion of Ukraine ('Warnings and insurance' page).",
      updated_at: '2026-10-02T09:30:25+01:00',
      url: 'https://www.gov.uk/foreign-travel-advice/ukraine',
    });
  });

  it('reads an empty status list as no warning', () => {
    const page = { ...UKRAINE, details: { ...UKRAINE.details, alert_status: [] } };
    expect(mapFcdoPage('UA', page)).toMatchObject({ level: 0, statuses: [] });
  });

  it('throws on a page without a country', () => {
    expect(() => mapFcdoPage('UA', { details: {} })).toThrow();
  });
});

describe('rankStatuses', () => {
  it('scores an unknown token as against all travel to parts, never as safe', () => {
    expect(rankStatuses(['something_new']).level).toBe(3);
    expect(rankStatuses(['avoid_all_but_essential_travel_to_parts', 'something_new']).level).toBe(3);
    expect(rankStatuses(['avoid_all_travel_to_whole_country', 'something_new']).level).toBe(4);
  });
});

describe('fcdoSlugFor', () => {
  it('resolves every hand-picked override to a real page', () => {
    for (const [iso, slug] of Object.entries(FCDO_SLUG_OVERRIDES)) {
      expect(INDEX_SLUGS.has(slug), `${iso} → ${slug}`).toBe(true);
      expect(fcdoSlugFor(iso, INDEX_SLUGS)).toBe(slug);
    }
  });

  it('matches countries by their English name', () => {
    expect(fcdoSlugFor('ci', INDEX_SLUGS)).toBe('cote-d-ivoire');
    expect(fcdoSlugFor('XK', INDEX_SLUGS)).toBe('kosovo');
    expect(fcdoSlugFor('KR', INDEX_SLUGS)).toBe('south-korea');
  });

  it('has no page for the UK itself, or for codes that are not countries', () => {
    expect(fcdoSlugFor('GB', INDEX_SLUGS)).toBeNull();
    expect(fcdoSlugFor('ZZ', INDEX_SLUGS)).toBeNull();
  });

  it('covers every page in the index', () => {
    const codes = [...Array(26 * 26)].map((_, i) => String.fromCharCode(65 + Math.floor(i / 26), 65 + (i % 26)));
    const covered = new Set(codes.map(c => fcdoSlugFor(c, INDEX_SLUGS)).filter(Boolean));
    expect([...INDEX_SLUGS].filter(s => !covered.has(s))).toEqual([]);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads live advice for Ukraine and Japan', async () => {
  const ua = await fetchFcdoAdvisory('UA');
  expect(ua?.level).toBeGreaterThanOrEqual(3);
  const jp = await fetchFcdoAdvisory('JP');
  expect(jp?.url).toBe('https://www.gov.uk/foreign-travel-advice/japan');
  expect(await fetchFcdoAdvisory('GB')).toBeNull();
}, 30_000);
