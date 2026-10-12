import { describe, expect, it } from 'vitest';
import { fetchUsAdvisories, parseUsAdvisories, US_LEVELS } from './us-state';

// Verbatim items from TAsTWs.xml, 2026-10-12 (descriptions trimmed).
const item = (title: string, link: string, pubDate: string, level: string, tag: string) => `<item>
      <title>${title}</title>
      <link>${link}</link>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[<p><b>Reconsider Travel </b>to …</p>]]></description>
      <category domain="Threat-Level">${level}</category>
      <category domain="Country-Tag">${tag}</category>
      <category domain="Keyword">advisory</category>
      <guid>${link}</guid>
      <dc:identifier>${tag},advisory</dc:identifier>
    </item>`;

const NEW = 'https://travel.state.gov/content/tsg_aem/us/en/home/international-travel/travel-advisories';
const OLD = 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0"><channel>
${item('Saudi Arabia - Level 3: Reconsider Travel', `${NEW}/destination.sau.html`, 'Mon, 12 Oct 2026', 'Level 3: Reconsider Travel', 'SA')}
${item('Israel - Level 3: Reconsider Travel - Level 3: Reconsider Travel', `${OLD}/israel-west-bank-and-gaza-travel-advisory.html`, 'Wed, 26 Aug 2026', 'Level 3: Reconsider Travel', 'IS')}
${item('West Bank - Level 3: Reconsider Travel', `${OLD}/west-bank.html`, 'Wed, 26 Aug 2026', 'Level 3: Reconsider Travel', 'IS')}
${item('Gaza - Level 4: Do Not Travel', `${OLD}/Gaza.html`, 'Wed, 26 Aug 2026', 'Level 4: Do Not Travel', 'IS')}
${item('Mexico Travel Advisory - Level 2: Exercise Increased Caution', `${NEW}/destination.mex.html`, 'Fri, 29 May 2026', 'Level 2: Exercise Increased Caution', 'MX')}
${item('Cambodia - Level 2: Exercise Increased Caution', `${NEW}/destination.khm.html`, 'Tue, 15 Sep 2026', 'Level 2: Exercise Increased Caution', 'KH')}
${item('Cambodia - Level 2: Exercise Increased Caution', `${OLD}/cambodia-travel-advisory.html`, 'Fri, 25 Jul 2025', 'Level 2: Exercise Increased Caution', 'CB')}
${item('Côte d’Ivoire - Level 2: Exercise Increased Caution', `${NEW}/destination.civ.html`, 'Wed, 18 Feb 2026', 'Level 2: Exercise Increased Caution', 'IV')}
${item('Burma - Level 4: Do Not Travel', `${NEW}/destination.mmr.html`, 'Fri, 08 May 2026', 'Level 4: Do Not Travel', 'MM')}
${item('Burma - Level 4: Do Not Travel', `${OLD}/burma-travel-advisory.html`, 'Fri, 08 May 2026', 'Level 4: Do Not Travel', 'BM')}
${item('French West Indies - Level 1: Exercise Normal Precautions', `${OLD}/french-west-indies-travel-advisory.html`, 'Thu, 22 Aug 2024', 'Level 1: Exercise Normal Precautions', 'A3')}
</channel></rss>`;

describe('parseUsAdvisories', () => {
  const { advisories, unmatched } = parseUsAdvisories(FEED);
  const find = (country: string) => advisories.filter(a => a.country === country);

  it('maps an item to the FCDO-shaped row', () => {
    expect(find('Saudi Arabia')).toEqual([{
      issuer: 'US State Department',
      iso2: 'SA',
      country: 'Saudi Arabia',
      level: 2,
      label: 'Reconsider Travel',
      statuses: ['Level 3: Reconsider Travel'],
      change: null,
      updated_at: '2026-10-12',
      url: `${NEW}/destination.sau.html`,
    }]);
  });

  it('reads the country from the title, not the FIPS-flavoured Country-Tag', () => {
    expect(find('Israel')[0]).toMatchObject({ iso2: 'IL', level: 2 });
    expect(find('Côte d’Ivoire')[0].iso2).toBe('CI');
    expect(find('Mexico')[0]).toMatchObject({ iso2: 'MX', level: 1, label: 'Exercise Increased Caution' });
  });

  it('keeps Gaza and the West Bank as separate PS rows', () => {
    expect(advisories.filter(a => a.iso2 === 'PS').map(a => [a.country, a.level])).toEqual([['West Bank', 2], ['Gaza', 4]]);
  });

  it('drops the older copy of a repeated destination', () => {
    expect(find('Cambodia')).toHaveLength(1);
    expect(find('Cambodia')[0].updated_at).toBe('2026-09-15');
    expect(find('Burma')).toHaveLength(1);
  });

  it('reports a name it cannot resolve instead of dropping it', () => {
    expect(unmatched).toEqual(['French West Indies']);
    expect(advisories).toHaveLength(8);
  });

  it('throws on a feed with no items', () => {
    expect(() => parseUsAdvisories('<rss><channel></channel></rss>')).toThrow();
  });
});

describe('US_LEVELS', () => {
  it('keeps the four State levels distinct and in order on the 0–4 scale', () => {
    expect([1, 2, 3, 4].map(n => US_LEVELS[n])).toEqual([0, 1, 2, 4]);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live State Department feed', async () => {
  const { advisories, unmatched } = await fetchUsAdvisories();
  expect(advisories.length).toBeGreaterThan(150);
  expect(unmatched.length).toBeLessThan(5);
}, 60_000);
