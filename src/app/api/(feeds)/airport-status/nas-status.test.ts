import { describe, expect, it } from 'vitest';
import {
  delaySeverity,
  isPartialClosure,
  notamWindow,
  parseMinutes,
  parseNasStatus,
  placeAirport,
  placeDelays,
  NAS_STATUS_URL,
} from './nas-status';

// Verbatim from nasstatus.faa.gov, 2026-10-12.
const LIVE = `<AIRPORT_STATUS_INFORMATION><Update_Time>Mon Oct 12 20:22:48 2026 GMT</Update_Time><Dtd_File>http://www.fly.faa.gov/AirportStatus.dtd</Dtd_File><Delay_type><Name>Ground Stop Programs</Name><Ground_Stop_List><Program><ARPT>RDU</ARPT><Reason>equipment outage</Reason><End_Time>5:00 pm EDT</End_Time></Program></Ground_Stop_List></Delay_type><Delay_type><Name>Ground Delay Programs</Name><Ground_Delay_List><Ground_Delay><ARPT>DEN</ARPT><Reason>runway construction</Reason><Avg>56 minutes</Avg><Max>1 hour and 44 minutes</Max></Ground_Delay><Ground_Delay><ARPT>RDU</ARPT><Reason>equipment outage</Reason><Avg>2 hours and 14 minutes</Avg><Max>5 hours and 56 minutes</Max></Ground_Delay><Ground_Delay><ARPT>SAN</ARPT><Reason>airport volume</Reason><Avg>58 minutes</Avg><Max>1 hour and 50 minutes</Max></Ground_Delay><Ground_Delay><ARPT>BOS</ARPT><Reason>low ceilings</Reason><Avg>1 hour and 15 minutes</Avg><Max>6 hours and 27 minutes</Max></Ground_Delay></Ground_Delay_List></Delay_type><Delay_type><Name>General Arrival/Departure Delay Info</Name><Arrival_Departure_Delay_List><Delay><ARPT>TEB</ARPT><Reason>VOL:INDIVIDUAL RELEASES</Reason><Arrival_Departure Type="Departure"><Min>31 minutes</Min><Max>45 minutes</Max><Trend>Increasing</Trend></Arrival_Departure></Delay></Arrival_Departure_Delay_List></Delay_type><Delay_type><Name>Airport Closures</Name><Airport_Closure_List><Airport><ARPT>LAX</ARPT><Reason>!LAX 05/277 LAX AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC 24HR PPR CTC ATLANTIC AVIATION 310-258-9884 OR SIGNATURE AVIATION 310-410-9605 2605271826-2705281600</Reason><Start>May 27 at 18:26 UTC.</Start><Reopen>May 28 at 16:00 UTC.</Reopen></Airport><Airport><ARPT>SAN</ARPT><Reason>!SAN 10/004 SAN AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC PPR 619-298-7704 2610011633-2701010800</Reason><Start>Oct 01 at 16:33 UTC.</Start><Reopen>Jan 01 at 08:00 UTC.</Reopen></Airport><Airport><ARPT>PHL</ARPT><Reason>!PHL 09/263 PHL AD AP CLSD TO NON SKED ACFT WINGSPAN MORE THAN 214FT AND TAIL HGT MORE THAN 66FT. 2609301806-2610311200</Reason><Start>Sep 30 at 18:06 UTC.</Start><Reopen>Oct 31 at 12:00 UTC.</Reopen></Airport></Airport_Closure_List></Delay_type></AIRPORT_STATUS_INFORMATION>`;

const SOURCE = 'https://nasstatus.faa.gov/';

describe('parseNasStatus', () => {
  const status = parseNasStatus(LIVE);
  const byId = Object.fromEntries(status.delays.map(d => [d.id, d]));

  it('reads every block in the live feed', () => {
    expect(status.updated).toBe('2026-10-12T20:22:48.000Z');
    expect(status.unknownBlocks).toEqual([]);
    expect(status.delays.map(d => d.id)).toEqual([
      'faa-ground_stop-RDU',
      'faa-ground_delay-DEN',
      'faa-ground_delay-RDU',
      'faa-ground_delay-SAN',
      'faa-ground_delay-BOS',
      'faa-departure_delay-TEB',
      'faa-closure-LAX',
      'faa-closure-SAN',
      'faa-closure-PHL',
    ]);
  });

  it('grades a ground stop as severe and keeps its local end time', () => {
    expect(byId['faa-ground_stop-RDU']).toEqual({
      id: 'faa-ground_stop-RDU', code: 'RDU', type: 'ground_stop', severity: 'severe',
      reason: 'equipment outage', endTime: '5:00 pm EDT', source: SOURCE,
    });
  });

  it('grades ground delays on their average', () => {
    expect(byId['faa-ground_delay-DEN']).toEqual({
      id: 'faa-ground_delay-DEN', code: 'DEN', type: 'ground_delay', severity: 'major',
      reason: 'runway construction', avgDelayMin: 56, maxDelayMin: 104, source: SOURCE,
    });
    expect(byId['faa-ground_delay-BOS']).toMatchObject({ severity: 'severe', avgDelayMin: 75, maxDelayMin: 387 });
  });

  it('grades an arrival/departure delay on the midpoint of min and max, without inventing an average', () => {
    expect(byId['faa-departure_delay-TEB']).toEqual({
      id: 'faa-departure_delay-TEB', code: 'TEB', type: 'departure_delay', severity: 'moderate',
      reason: 'VOL:INDIVIDUAL RELEASES', minDelayMin: 31, maxDelayMin: 45, trend: 'increasing', source: SOURCE,
    });
  });

  it('marks NOTAM closures limited to some aircraft as partial and minor', () => {
    expect(byId['faa-closure-SAN']).toMatchObject({
      severity: 'minor', partial: true, endTime: 'Jan 01 at 08:00 UTC',
      startsAt: '2026-10-01T16:33:00.000Z', endsAt: '2027-01-01T08:00:00.000Z',
    });
    expect(byId['faa-closure-LAX']).toMatchObject({ partial: true, endsAt: '2027-05-28T16:00:00.000Z' });
  });

  it('grades a full closure as severe', () => {
    const xml = LIVE.replace('AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC 24HR PPR', 'AD AP CLSD');
    expect(parseNasStatus(xml).delays.find(d => d.id === 'faa-closure-LAX')).toMatchObject({ severity: 'severe', partial: false });
  });

  it('reads an arrival delay and both directions at one airport', () => {
    const xml = `<AIRPORT_STATUS_INFORMATION><Delay_type><Name>General Arrival/Departure Delay Info</Name><Arrival_Departure_Delay_List><Delay><ARPT>ORD</ARPT><Reason>WX:Thunderstorms &amp; wind</Reason><Arrival_Departure Type="Arrival"><Min>16 minutes</Min><Max>30 minutes</Max><Trend>Decreasing</Trend></Arrival_Departure><Arrival_Departure Type="Departure"><Min>1 hour</Min><Max>1 hour and 30 minutes</Max><Trend>Increasing</Trend></Arrival_Departure></Delay></Arrival_Departure_Delay_List></Delay_type></AIRPORT_STATUS_INFORMATION>`;
    expect(parseNasStatus(xml).delays.map(d => [d.id, d.severity, d.reason])).toEqual([
      ['faa-arrival_delay-ORD', 'minor', 'WX:Thunderstorms & wind'],
      ['faa-departure_delay-ORD', 'severe', 'WX:Thunderstorms & wind'],
    ]);
  });

  it('treats a quiet feed as an empty list, not a failure', () => {
    expect(parseNasStatus('<AIRPORT_STATUS_INFORMATION><Update_Time>Mon Oct 12 05:00:00 2026 GMT</Update_Time></AIRPORT_STATUS_INFORMATION>'))
      .toEqual({ updated: '2026-10-12T05:00:00.000Z', delays: [], unknownBlocks: [] });
  });

  it('reports unknown blocks and skips airspace flow programmes', () => {
    const xml = `<AIRPORT_STATUS_INFORMATION><Delay_type><Name>Airspace Flow Programs</Name><Airspace_Flow_List><Airspace_Flow><CTL_Element>FCAA05</CTL_Element></Airspace_Flow></Airspace_Flow_List></Delay_type><Delay_type><Name>Deicing</Name><Deicing_List><Item><ARPT>MSP</ARPT></Item></Deicing_List></Delay_type></AIRPORT_STATUS_INFORMATION>`;
    expect(parseNasStatus(xml)).toMatchObject({ delays: [], unknownBlocks: ['Deicing'] });
  });

  it('throws on something that is not the status document', () => {
    expect(() => parseNasStatus('<html><body>Service Unavailable</body></html>')).toThrow();
  });
});

describe('parseMinutes', () => {
  it('reads the FAA prose durations', () => {
    expect(['56 minutes', '1 hour and 44 minutes', '2 hours and 14 minutes', '1 hour', '5 hrs'].map(parseMinutes)).toEqual([56, 104, 134, 60, 300]);
    expect(parseMinutes('soon')).toBeNull();
    expect(parseMinutes(undefined)).toBeNull();
  });
});

describe('delaySeverity', () => {
  it('follows the 15/25/45/60 minute bands', () => {
    expect([10, 15, 24, 25, 44, 45, 59, 60, 300].map(delaySeverity)).toEqual([
      'minor', 'minor', 'minor', 'moderate', 'moderate', 'major', 'major', 'severe', 'severe',
    ]);
  });
});

describe('NOTAM helpers', () => {
  it('reads the effective window, including PERM and estimated ends', () => {
    expect(notamWindow('... 2609301806-2610311200')).toEqual({ startsAt: '2026-09-30T18:06:00.000Z', endsAt: '2026-10-31T12:00:00.000Z' });
    expect(notamWindow('... 2609301806-2610311200EST')).toMatchObject({ endsAt: '2026-10-31T12:00:00.000Z' });
    expect(notamWindow('... 2609301806-PERM')).toEqual({ startsAt: '2026-09-30T18:06:00.000Z', endsAt: undefined });
    expect(notamWindow('no window')).toEqual({});
  });

  it('tells a restriction from a full closure', () => {
    expect(isPartialClosure('AD AP CLSD TO NON SKED TRANSIENT GA ACFT')).toBe(true);
    expect(isPartialClosure('AD AP CLSD TO ALL ACFT')).toBe(false);
    expect(isPartialClosure('AD AP CLSD')).toBe(false);
  });
});

describe('placement', () => {
  it('places codes from the local airport table and keeps the rest unplaced', () => {
    const { airports, unplaced } = placeDelays(parseNasStatus(LIVE).delays, code =>
      ({ RDU: { name: 'Raleigh-Durham', lat: 35.8776, lng: -78.7875 }, BOS: { name: 'Logan Intl', lat: 42.3656, lng: -71.0096 } } as Record<string, { name: string; lat: number; lng: number }>)[code] ?? null);
    expect(airports.map(a => a.id)).toEqual(['faa-ground_delay-BOS', 'faa-ground_stop-RDU', 'faa-ground_delay-RDU']);
    expect(airports[0]).toMatchObject({ name: 'Logan Intl', lat: 42.3656, lng: -71.0096 });
    expect(unplaced).toHaveLength(6);
    expect(unplaced[0]).not.toHaveProperty('lat');
  });

  it('only accepts US airports from the shared table', () => {
    expect(placeAirport('DEN')).toMatchObject({ icao: 'KDEN' });
    expect(placeAirport('SJU')).toMatchObject({ country: 'PR' });
    expect(placeAirport('LHR')).toBeNull();
    expect(placeAirport('ZZZ')).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live NAS status feed', async () => {
  const res = await fetch(NAS_STATUS_URL, { signal: AbortSignal.timeout(15_000) });
  expect(parseNasStatus(await res.text()).updated).not.toBeNull();
});
