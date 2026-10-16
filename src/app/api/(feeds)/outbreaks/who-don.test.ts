import { describe, expect, it } from 'vitest';
import { fetchWhoDon, mapDonItem, parseWhoDon, splitDonTitle } from './who-don';

// Verbatim from the DON OData API, 2026-10-12.
const RESPONSE = {
  '@odata.context': 'http://www.who.int/api/emergencies/$metadata#diseaseoutbreaknews(Title,ItemDefaultUrl,PublicationDateAndTime)',
  value: [
    { ItemDefaultUrl: '/2026-DON620', PublicationDateAndTime: '2026-10-10T15:00:00Z', Title: 'Pneumonia of undetermined etiology - the Russian Federation' },
    { ItemDefaultUrl: '/2026-DON613', PublicationDateAndTime: '2026-07-17T16:13:00Z', Title: 'Ebola disease caused by Bundibugyo virus, Democratic Republic of the Congo & Uganda' },
    { ItemDefaultUrl: '/2026-DON611', PublicationDateAndTime: '2026-07-02T18:00:00Z', Title: 'Hantavirus outbreak linked to cruise ship travel, Multi-locations' },
    { ItemDefaultUrl: '/2026-DON603', PublicationDateAndTime: '2026-05-21T22:00:47Z', Title: 'Ebola disease caused by Bundibugyo virus – Democratic Republic of the Congo' },
    { ItemDefaultUrl: '/2026-DON597', PublicationDateAndTime: '2026-04-10T13:51:44Z', Title: 'Avian Influenza A(H9N2) - Italy' },
    { ItemDefaultUrl: '/2026-DON596', PublicationDateAndTime: '2026-03-13T19:00:00Z', Title: 'International food safety event: Infant formula and products containing arachidonic acid oil contaminated with cereulide toxin - Multi-country' },
    { ItemDefaultUrl: '/2026-DON592', PublicationDateAndTime: '2026-01-26T19:00:00Z', Title: 'Marburg virus disease- Ethiopia' },
    { ItemDefaultUrl: '/2025-DON591', PublicationDateAndTime: '2025-12-24T05:38:07Z', Title: 'Middle East respiratory syndrome coronavirus - Global update' },
  ],
};

describe('splitDonTitle', () => {
  it('splits on the last spaced dash, then on the last comma', () => {
    expect(splitDonTitle('Marburg virus disease- Ethiopia')).toEqual({ subject: 'Marburg virus disease', place: 'Ethiopia' });
    expect(splitDonTitle('Crimean-Congo haemorrhagic fever - Iraq')).toEqual({ subject: 'Crimean-Congo haemorrhagic fever', place: 'Iraq' });
    expect(splitDonTitle('Ebola disease caused by Bundibugyo virus, Democratic Republic of the Congo & Uganda'))
      .toEqual({ subject: 'Ebola disease caused by Bundibugyo virus', place: 'Democratic Republic of the Congo & Uganda' });
    expect(splitDonTitle('Cholera')).toBeNull();
  });
});

describe('parseWhoDon', () => {
  const notices = parseWhoDon(RESPONSE);

  it('maps a post to a notice with the full item URL', () => {
    expect(notices[0]).toEqual({
      source: 'WHO',
      title: 'Pneumonia of undetermined etiology - the Russian Federation',
      url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON620',
      published: '2026-10-10T15:00:00.000Z',
      disease: 'Undiagnosed illness',
      countries: [{ iso2: 'RU', name: 'Russian Federation' }],
      unmatched: [],
      level: null,
    });
  });

  it('reads every title shape WHO uses', () => {
    expect(notices.map(n => [n.disease, n.countries.map(c => c.iso2).join('+')])).toEqual([
      ['Undiagnosed illness', 'RU'],
      ['Ebola', 'CD+UG'],
      ['Hantavirus', ''],
      ['Ebola', 'CD'],
      ['Avian influenza', 'IT'],
      [null, ''],
      ['Marburg', 'ET'],
      ['MERS', ''],
    ]);
    expect(notices.flatMap(n => n.unmatched)).toEqual([]);
  });

  it('throws on an unexpected shape and skips untitled rows', () => {
    expect(() => parseWhoDon({})).toThrow();
    expect(mapDonItem({ ItemDefaultUrl: '/x' })).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live DON API', async () => {
  const notices = await fetchWhoDon();
  expect(notices.length).toBeGreaterThan(10);
}, 60_000);
