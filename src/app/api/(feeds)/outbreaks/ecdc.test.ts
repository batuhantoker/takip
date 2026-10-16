import { describe, expect, it } from 'vitest';
import { ECDC_TERMS, fetchEcdcFeed, parseEcdcFeed } from './ecdc';

// Verbatim items from taxonomy terms 1310 and 1295, 2026-10-12 (descriptions trimmed).
const item = (title: string, link: string, pubDate: string) => `<item>
  <title>${title}</title>
  <link>${link}</link>
  <description>&lt;p&gt;…&lt;/p&gt;
</description>
  <pubDate>${pubDate}</pubDate>
    <dc:creator>ECDC</dc:creator>
    <guid isPermaLink="true">${link}</guid>
    </item>`;

const FEED = `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0" xml:base="https://www.ecdc.europa.eu/en">
  <channel>
    <title>Epidemiological update</title>
    ${item('Ebola disease outbreak in the Democratic Republic of the Congo', 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda', 'Mon, 12 Oct 2026 17:36:21 +0200')}
    ${item('MERS-CoV worldwide overview', 'https://www.ecdc.europa.eu/en/middle-east-respiratory-syndrome-coronavirus-mers-cov-situation-update', 'Tue, 29 Sep 2026 14:20:22 +0200')}
    ${item('Epidemiological update – 11 August 2026: Imported case of Andes hantavirus in the EU/EEA', 'https://www.ecdc.europa.eu/en/news-events/epidemiological-update-11-august-2026-imported-case-andes-hantavirus-eueea', 'Thu, 20 Aug 2026 13:39:42 +0200')}
    ${item('Threat assessment brief – Ebola disease outbreak caused by Bundibugyo virus – Democratic Republic of the Congo and Uganda – 2026', 'https://www.ecdc.europa.eu/en/publications-data/threat-assessment-brief-ebola-disease-outbreak-caused-bundibugyo-virus-democratic', 'Thu, 21 May 2026 18:19:06 +0200')}
    ${item('Epidemiological update: Shigellosis and other gastrointestinal infections in travellers returning from Cabo Verde', 'https://www.ecdc.europa.eu/en/news-events/epidemiological-update-shigellosis-and-other-gastrointestinal-infections-travellers', 'Wed, 18 Mar 2026 10:32:55 +0100')}
    ${item('Rapid risk assessment – Clusters of dermatophilosis in five EU/EEA countries in 2025–2026', 'https://www.ecdc.europa.eu/en/publications-data/rapid-risk-assessment-clusters-dermatophilosis-five-eueea-countries-2025-2026', 'Wed, 17 Jun 2026 09:56:48 +0200')}
  </channel>
</rss>`;

describe('parseEcdcFeed', () => {
  const notices = parseEcdcFeed(FEED);

  it('maps an item with countries from its title', () => {
    expect(notices[0]).toEqual({
      source: 'ECDC',
      title: 'Ebola disease outbreak in the Democratic Republic of the Congo',
      url: 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
      published: '2026-10-12T15:36:21.000Z',
      disease: 'Ebola',
      countries: [{ iso2: 'CD', name: 'Democratic Republic of the Congo' }],
      unmatched: [],
      level: null,
    });
  });

  it('finds every country named, and none in worldwide or EU/EEA items', () => {
    expect(notices.map(n => [n.disease, n.countries.map(c => c.iso2).join('+')])).toEqual([
      ['Ebola', 'CD'],
      ['MERS', ''],
      ['Hantavirus', ''],
      ['Ebola', 'CD+UG'],
      ['Shigellosis', 'CV'],
      [null, ''],
    ]);
  });

  it('throws on a non-RSS answer', () => {
    expect(() => parseEcdcFeed('<html></html>')).toThrow();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live ECDC feeds', async () => {
  for (const term of ECDC_TERMS) expect((await fetchEcdcFeed(term.id)).length).toBeGreaterThan(0);
}, 60_000);
