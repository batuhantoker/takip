import { describe, expect, it } from 'vitest';
import { mapAnnotations, mapAnomalies, type RawAnnotation, type RawAnomaly } from './cloudflare';

// Trimmed from api.cloudflare.com/client/v4/radar/annotations/outages and /traffic_anomalies, 2026-10-21.
const ORANGE: RawAnnotation = {
  id: '1731', locations: [], locationsDetails: [],
  asnsDetails: [{ asn: '3215', name: 'Orange S.A.', location: { code: 'FR', name: 'France' } }],
  scope: null, outage: { outageCause: 'UNKNOWN', outageType: 'NETWORK' },
  description: 'Orange (AS3215) experienced a nationwide mobile network outage in France',
  startDate: '2026-10-21T09:30:00Z', endDate: null, linkedUrl: 'https://x.com/CloudflareRadar/status/2112904257230025044',
};
const SYRIA: RawAnnotation = {
  id: '1726', locations: ['SY'], locationsDetails: [{ name: 'Syria', code: 'SY' }],
  asnsDetails: [
    { asn: '29256', name: 'INT-PDN-STE-AS', location: { code: 'SY', name: 'Syria' } },
    { asn: '48065', name: 'Syriatel-AS', location: { code: 'SY', name: 'Syria' } },
  ],
  scope: null, outage: { outageCause: 'MAINTENANCE', outageType: 'NETWORK' },
  description: 'Announced maintenance by Syrian Telecom (AS29256) caused a significant drop in Internet traffic across multiple providers in Syria',
  startDate: '2026-10-19T21:00:00Z', endDate: '2026-10-19T21:45:00Z', linkedUrl: 'https://x.com/CloudflareRadar/status/2112464419267694835',
};
const GOOGLE_CLOUD: RawAnnotation = {
  id: '1727', locations: [], locationsDetails: [], asnsDetails: [],
  outage: { outageCause: 'TECHNICAL_PROBLEM', outageType: 'PLATFORM' },
  description: 'A technical problem at Google Cloud caused elevated errors and network failures for multiple services in its europe-west2 (London) region',
  startDate: '2026-10-20T05:45:00Z', endDate: '2026-10-20T14:00:00Z',
};

const ANOMALY_ORANGE: RawAnomaly = {
  uuid: '36549d1d-b2f8-46e5-91aa-778054938852', type: 'AS', startDate: '2026-10-21T09:30:00Z', endDate: null,
  locationDetails: null, asnDetails: { asn: '3215', name: 'Orange S.A.', location: { code: 'FR', name: 'France' } },
  visibleInDataSources: ['HTTP', 'NET'],
};
const ANOMALY_IRAN: RawAnomaly = {
  uuid: 'c221e00c-398c-45ef-8a22-83a1c8d193f1', type: 'AS', startDate: '2026-10-21T09:30:00Z', endDate: null,
  locationDetails: null, asnDetails: { asn: '206065', name: 'FDI', location: { code: 'IR', name: 'Iran' } },
  visibleInDataSources: ['HTTP', 'NET'],
};
const ANOMALY_GABON: RawAnomaly = {
  uuid: '8001115f-d4f0-4870-b35d-5ba891eab53b', type: 'LOCATION', startDate: '2026-10-20T13:30:00Z', endDate: '2026-10-20T14:45:00Z',
  locationDetails: { code: 'GA', name: 'Gabon' }, asnDetails: null, visibleInDataSources: ['NET', 'HTTP'],
};

describe('mapAnnotations', () => {
  it('pins a network’s outage in the network’s country, named', () => {
    const [pin] = mapAnnotations([ORANGE]);
    expect(pin).toMatchObject({
      id: '1731-FR', source: 'cloudflare', kind: 'annotation', country: 'FR', country_name: 'France',
      network: 'AS3215 Orange S.A.', cause: 'UNKNOWN', scope: 'NETWORK', ongoing: true, end: null,
    });
  });

  it('gives a country outage one pin, with the networks it names', () => {
    const pins = mapAnnotations([SYRIA]);
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ country: 'SY', network: 'AS29256 INT-PDN-STE-AS, AS48065 Syriatel-AS', ongoing: false, cause: 'MAINTENANCE' });
  });

  it('pins only the countries an annotation names, even for a network registered elsewhere', () => {
    const iraq: RawAnnotation = {
      ...SYRIA, id: '1700', locations: ['IQ'], locationsDetails: [{ code: 'IQ', name: 'Iraq' }],
      asnsDetails: [
        { asn: '51684', name: 'ASIACELL', location: { code: 'IQ', name: 'Iraq' } },
        { asn: '199739', name: 'Earthlink-DMCC-IQ', location: { code: 'AE', name: 'United Arab Emirates' } },
      ],
    };
    const pins = mapAnnotations([iraq]);
    expect(pins.map(p => [p.country, p.network])).toEqual([['IQ', 'AS51684 ASIACELL, AS199739 Earthlink-DMCC-IQ']]);
  });

  it('names no network for a country-wide outage that lists the networks it hit', () => {
    const typhoon: RawAnnotation = { ...SYRIA, locations: ['GU'], outage: { outageCause: 'WEATHER', outageType: 'NATIONWIDE' } };
    expect(mapAnnotations([typhoon])[0]).toMatchObject({ country: 'GU', network: null, scope: 'NATIONWIDE' });
  });

  it('leaves out an outage with no country', () => {
    expect(mapAnnotations([GOOGLE_CLOUD])).toEqual([]);
  });
});

describe('mapAnomalies', () => {
  const annotated = mapAnnotations([ORANGE]);

  it('skips a drop an annotation already describes and keeps the rest', () => {
    const pins = mapAnomalies([ANOMALY_ORANGE, ANOMALY_IRAN, ANOMALY_GABON], annotated);
    expect(pins.map(p => p.country)).toEqual(['IR', 'GA']);
    expect(pins[0]).toMatchObject({
      kind: 'anomaly', network: 'AS206065 FDI', ongoing: true, url: 'https://radar.cloudflare.com/as206065', seen_in: ['HTTP', 'NET'],
    });
    expect(pins[1]).toMatchObject({ network: null, ongoing: false, end: '2026-10-20T14:45:00Z', url: 'https://radar.cloudflare.com/ga' });
  });
});
