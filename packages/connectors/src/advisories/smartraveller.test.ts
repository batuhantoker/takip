import { describe, expect, it } from 'vitest';
import { fetchSmartraveller, parseSmartraveller, smartravellerLevel } from './smartraveller';

// Verbatim items from the Wayback copy of index.rss, 2026-10-01 (descriptions trimmed).
const FEED = `<?xml version="1.0"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:ta="http://www.smartraveller.gov.au/schema/rss/travel_advisories/" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <channel>
    <title>Travel Advisories</title>
<item>
  <title>Bahrain</title>
  <link>https://www.smartraveller.gov.au/destinations/middle-east/bahrain</link>
  <description>We&#x2019;ve reviewed our advice for Bahrain and have lowered the overall travel advice level. We now advise reconsider your need to travel overall due to the unpredictable security situation in the region.&lt;br&gt; &lt;br&gt; Military strikes and reprisal at</description>
  <pubDate>01 Oct 2026 22:00:00 AEST</pubDate>
    <dc:creator>Smartraveller</dc:creator>
    <guid isPermaLink="false">e782e316-d079-4e97-828a-3a2a2b5fe173</guid>
    <ta:warnings>
                        <dc:coverage>Bahrain</dc:coverage>
                        <ta:level>4/5</ta:level>
                        <dc:description>Reconsider your need to travel</dc:description>
                    </ta:warnings>
    </item>
<item>
  <title>Palestine</title>
  <link>https://www.smartraveller.gov.au/destinations/middle-east/palestine</link>
  <description>We've reviewed our travel advice for Palestine. We continue to advise do not travel to Gaza and the West Bank (excluding Jerusalem) overall</description>
  <pubDate>14 Sep 2026 22:00:00 AEST</pubDate>
    <ta:warnings>
                        <dc:coverage>Palestine</dc:coverage>
                        <ta:level>5/5</ta:level>
                        <dc:description>Do not travel</dc:description>
                    </ta:warnings>
    </item>
<item>
  <title>C&#xF4;te d'Ivoire (Ivory Coast)</title>
  <link>https://www.smartraveller.gov.au/destinations/africa/cote-divoire-ivory-coast</link>
  <description>We've reviewed our advice for C&#xF4;te d'Ivoire. There was no change to the overall level of our advice.</description>
  <pubDate>07 Sep 2026 22:00:00 AEST</pubDate>
    <ta:warnings>
                        <dc:coverage>C&#xF4;te d'Ivoire (Ivory Coast)</dc:coverage>
                        <ta:level>3/5</ta:level>
                        <dc:description>Exercise a high degree of caution</dc:description>
                    </ta:warnings>
    </item>
<item>
  <title>North Korea (Democratic People's Republic of Korea)</title>
  <link>https://www.smartraveller.gov.au/destinations/asia/north-korea-democratic-peoples-republic-korea</link>
  <description>We continue to advise do not travel to North Korea. Travel within the country is severely restricted</description>
  <pubDate>31 Mar 2026 23:00:00 AEDT</pubDate>
    <ta:warnings>
                        <dc:coverage>North Korea (Democratic People's Republic of Korea)</dc:coverage>
                        <ta:level>5/5</ta:level>
                        <dc:description>Do not travel</dc:description>
                    </ta:warnings>
    </item>
<item>
  <title>Crisis alert</title>
  <link>https://www.smartraveller.gov.au/destinations/asia/crisis-alert</link>
  <description>Australian crisis response teams have been deployed to Nepal and Tibet, China to help with search and rescue efforts.</description>
  <pubDate>07 Sep 2026 22:00:00 AEST</pubDate>
    <ta:warnings>
                        <dc:coverage>Crisis alert</dc:coverage>
                        <ta:level>3/5</ta:level>
                        <dc:description>Exercise a high degree of caution</dc:description>
                    </ta:warnings>
    </item>
<item>
  <title>No travel advice</title>
  <link>https://www.smartraveller.gov.au/destinations/no-travel-advice</link>
  <description>  </description>
  <pubDate/>
    <ta:warnings>
                        <dc:coverage>No travel advice</dc:coverage>
                        <ta:level>1/5</ta:level>
                        <dc:description/>
                    </ta:warnings>
    </item>
  </channel>
</rss>`;

describe('parseSmartraveller', () => {
  const { advisories, unmatched } = parseSmartraveller(FEED);

  it('maps an item to the FCDO-shaped row', () => {
    expect(advisories[0]).toEqual({
      issuer: 'Australia Smartraveller',
      iso2: 'BH',
      country: 'Bahrain',
      level: 2,
      label: 'Reconsider your need to travel',
      statuses: ['4/5'],
      change: 'We’ve reviewed our advice for Bahrain and have lowered the overall travel advice level.',
      updated_at: '2026-10-01T12:00:00.000Z',
      url: 'https://www.smartraveller.gov.au/destinations/middle-east/bahrain',
    });
  });

  it('decodes names and resolves the bracketed forms', () => {
    expect(advisories.map(a => [a.iso2, a.country, a.level])).toEqual([
      ['BH', 'Bahrain', 2],
      ['PS', 'Palestine', 4],
      ['CI', "Côte d'Ivoire (Ivory Coast)", 1],
      ['KP', "North Korea (Democratic People's Republic of Korea)", 4],
    ]);
    expect(advisories[3].updated_at).toBe('2026-03-31T12:00:00.000Z');
  });

  it('skips the crisis-alert and no-advice pages without calling them unmatched', () => {
    expect(advisories.some(a => /crisis|no travel/i.test(a.country))).toBe(false);
    expect(unmatched).toEqual([]);
  });

  it('throws on a feed with no items', () => {
    expect(() => parseSmartraveller('<rss><channel></channel></rss>')).toThrow();
  });
});

describe('smartravellerLevel', () => {
  it('maps the four public levels, by wording first', () => {
    expect(smartravellerLevel('2/5', 'Exercise normal safety precautions')).toBe(0);
    expect(smartravellerLevel('3/5', 'Exercise a high degree of caution')).toBe(1);
    expect(smartravellerLevel('4/5', 'Reconsider your need to travel')).toBe(2);
    expect(smartravellerLevel('5/5', 'Do not travel')).toBe(4);
    expect(smartravellerLevel('5/5', '')).toBe(4);
  });

  it('scores unknown wording as against travel to parts, never as safe', () => {
    expect(smartravellerLevel('', 'Something new')).toBe(3);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live Smartraveller feed', async () => {
  const { advisories } = await fetchSmartraveller();
  expect(advisories.length).toBeGreaterThan(150);
}, 60_000);
