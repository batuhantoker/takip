import { describe, expect, it } from 'vitest';
import { cdcCountryList, fetchCdcNotices, parseCdcNotices } from './cdc-notices';

// Verbatim items from notices.xml, 2026-10-12.
const item = (title: string, description: string, link: string, pubDate: string) => `
                <item>
                    <title>${title}</title>
                    <description><![CDATA[${description}]]></description>
                    <link>${link}</link>
                    <pubDate>${pubDate}</pubDate>
                    <guid>${link}</guid>
                </item> `;

const FEED = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="https://www.w3.org/2005/Atom">
    <channel>
        <title>Travel Notices - CDC Travelers&#39; Health </title>
        ${item('Level 1 - Global Dengue', 'Dengue is a year-round risk in many parts of the world, with outbreaks commonly occurring every 2–5 years. Travelers to risk areas should prevent mosquito bites.  Country List :  Colombia, Vietnam, Maldives, Bolivia, Cambodia, Kenya, Malaysia, Sri Lanka, Bangladesh, Costa Rica, Marshall Islands, Vanuatu Country List :  Colombia, Vietnam, Maldives, Bolivia, Cambodia, Kenya, Malaysia, Sri Lanka, Bangladesh, Costa Rica, Marshall Islands, Vanuatu, Cuba, Ecua Country List :  Colombia, Vietnam, Maldives, Bolivia, Cambodia, Kenya, Malaysia, Sri Lanka, Bangladesh, Costa Rica, Marshall Islands, Vanuatu, Cuba, Ecuador, including the Galápagos Islands, Panama', 'https://wwwnc.cdc.gov/travel/notices/level1/dengue-global', 'Fri, 02 Oct 2026 04:00:00 GMT')}
        ${item('Level 2 - Yellow Fever in Colombia', 'An increased number of cases of yellow fever have been reported in Colombia.', 'https://wwwnc.cdc.gov/travel/notices/level2/yellow-fever-colombia', 'Fri, 18 Sep 2026 04:00:00 GMT')}
        ${item('Level 2 - Ebola Bundibugyo Virus Disease in the Democratic Republic of the Congo and Uganda', 'CDC recommends practicing enhanced precautions for travel to Uganda or to provinces in the Democratic Republic of the Congo (DRC) not affected by the current Bundibugyo virus disease (BVD) outbreak. Country List :  Democratic Republic of the Congo, Uganda Country List :  Democratic Republic of the Congo, Uganda', 'https://wwwnc.cdc.gov/travel/notices/level2/ebola-drc-uganda', 'Fri, 28 Aug 2026 04:00:00 GMT')}
        ${item('Level 4 - Ebola Bundibugyo Virus Disease in Ituri and Nord-Kivu Provinces of the Democratic Republic of the Congo', 'CDC recommends avoiding all travel to Ituri and Nord-Kivu (North-Kivu) provinces in the Democratic Republic of the Congo (DRC) due to the current Bundibugyo virus disease (BVD) outbreak unless traveling for humanitarian aid or emergency response.', 'https://wwwnc.cdc.gov/travel/notices/level4/ebola-drc-provinces', 'Tue, 04 Aug 2026 04:00:00 GMT')}
        ${item('Level 3 - Ebola Bundibugyo Virus Disease in Haut-U&#233;l&#233; and Tshopo Provinces of the Democratic Republic of the Congo', 'CDC recommends avoiding nonessential travel to Haut-Uélé and Tshopo provinces in the Democratic Republic of the Congo (DRC) due to the current Bundibugyo virus disease (BVD) outbreak.', 'https://wwwnc.cdc.gov/travel/notices/level3/ebola-democratic-republic-of-the-congo', 'Tue, 04 Aug 2026 04:00:00 GMT')}
        ${item('Level 1 - Diphtheria in Sub-Saharan Africa', 'There are outbreaks of diphtheria in several countries in Africa. Vaccination against diphtheria is essential to protect against the disease.  Country List :  Chad, Guinea, Niger, Nigeria, Mali, Mauritania, Somalia Country List :  Chad, Guinea, Niger, Nigeria, Mali, Mauritania, Somalia, Senega Country List :  Chad, Guinea, Niger, Nigeria, Mali, Mauritania, Somalia, Senegal', 'https://wwwnc.cdc.gov/travel/notices/level1/diphtheria-sub-saharan-africa', 'Tue, 25 Aug 2026 04:00:00 GMT')}
        ${item('Level 2 - Malaria in Mayotte', 'Increased cases of malaria have been reported in Mayotte. Malaria is spread by the bite of infected mosquitoes. ', 'https://wwwnc.cdc.gov/travel/notices/level2/malaria-mayotte', 'Tue, 02 Jun 2026 04:00:00 GMT')}
    </channel>
</rss>`;

describe('parseCdcNotices', () => {
  const notices = parseCdcNotices(FEED);

  it('maps a single-country notice', () => {
    expect(notices[1]).toEqual({
      source: 'CDC',
      title: 'Level 2 - Yellow Fever in Colombia',
      url: 'https://wwwnc.cdc.gov/travel/notices/level2/yellow-fever-colombia',
      published: '2026-09-18T04:00:00.000Z',
      disease: 'Yellow fever',
      countries: [{ iso2: 'CO', name: 'Colombia' }],
      unmatched: [],
      level: 2,
    });
  });

  it('reads the last, complete copy of the country list', () => {
    expect(notices[0].countries.map(c => c.iso2)).toEqual(['CO', 'VN', 'MV', 'BO', 'KH', 'KE', 'MY', 'LK', 'BD', 'CR', 'MH', 'VU', 'CU', 'EC', 'PA']);
    expect(notices[5].countries.map(c => c.iso2)).toEqual(['TD', 'GN', 'NE', 'NG', 'ML', 'MR', 'SO', 'SN']);
    expect(notices.flatMap(n => n.unmatched)).toEqual([]);
  });

  it('keeps each province notice with its own level', () => {
    expect(notices.slice(2, 5).map(n => [n.level, n.disease, n.countries.map(c => c.iso2).join('+')]))
      .toEqual([[2, 'Ebola', 'CD+UG'], [4, 'Ebola', 'CD'], [3, 'Ebola', 'CD']]);
    expect(notices[4].title).toContain('Haut-Uélé');
  });

  it('places overseas departments as themselves', () => {
    expect(notices[6].countries).toEqual([{ iso2: 'YT', name: 'Mayotte' }]);
  });

  it('throws on a non-RSS answer', () => {
    expect(() => parseCdcNotices('<html><body>Service unavailable</body></html>')).toThrow();
  });
});

describe('cdcCountryList', () => {
  it('returns null when there is no list', () => {
    expect(cdcCountryList('There is an outbreak of chikungunya in Nicaragua.')).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live CDC notices feed', async () => {
  const notices = await fetchCdcNotices();
  expect(notices.length).toBeGreaterThan(5);
  expect(notices.every(n => n.level != null && n.level >= 1 && n.level <= 4)).toBe(true);
}, 60_000);
