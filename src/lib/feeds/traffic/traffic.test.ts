import { describe, expect, it } from 'vitest';
import { trafficPopupHtml, trafficRoadName, trafficTip } from './describe';
import { decodeLine, encodeLine, lineLengthM, simplifyLine, type NdwSite } from './sources/ndw-sites';
import { createNdwScanner, ndwSegments, parseNdwBlock, type NdwReading } from './sources/ndw';
import { ODS_CITIES, odsExportUrl, odsSegments } from './sources/opendatasoft';
import { clampView, isTooWide, levelFromPct } from './types';

// A real block from reistijden_meetgegevens.xml.gz (2026-10-15), with the usual time halved for a slow road.
const block = (site: string, travel: string, usual = '34.164963', time = '2026-10-15T21:10:00Z', inputs = '95') =>
  `<roa:siteMeasurements><roa:measurementSiteReference targetClass="roa:MeasurementSite" id="${site}" version="1"/>`
  + '<roa:physicalQuantity index="1"><roa:physicalQuantity xsi:type="roa:SinglePhysicalQuantity"><roa:basicData xsi:type="roa:TravelTimeData">'
  + `<roa:travelTimeType>reconstituted</roa:travelTimeType><roa:travelTime accuracy="100.0" numberOfInputValuesUsed="${inputs}" supplierCalculatedDataQuality="64.18896"><roa:duration>${travel}</roa:duration></roa:travelTime>`
  + `<roa:normallyExpectedTravelTime accuracy="100.0" numberOfInputValuesUsed="95"><roa:duration>${usual}</roa:duration></roa:normallyExpectedTravelTime>`
  + `</roa:basicData></roa:physicalQuantity></roa:physicalQuantity><roa:measurementTimeDefault><roa:timeValue>${time}</roa:timeValue></roa:measurementTimeDefault></roa:siteMeasurements>`;

const NOW = Date.parse('2026-10-15T21:12:00Z');
const SITE: NdwSite = { name: 'Heemstedestraat_Hoofddorpplein_Westlandgracht', lengthM: 237, coords: [[4.849505, 52.351593], [4.846023, 52.351582]] };

describe('NDW readings', () => {
  it('reads the site, minute, travel time, usual time and probe count', () => {
    expect(parseNdwBlock(block('ABM01_1084_1086', '26.477848'))).toEqual({
      site: 'ABM01_1084_1086', at: '2026-10-15T21:10:00Z', travelS: 26.477848, usualS: 34.164963, inputs: 95,
    });
  });

  it('drops blocks with no data', () => {
    expect(parseNdwBlock(block('A', '-1'))).toBeNull();
    expect(parseNdwBlock(block('A', '20').replace('<roa:travelTimeType>', '<roa:dataError>true</roa:dataError><roa:travelTimeType>'))).toBeNull();
  });

  it('finds every block however the stream is cut', () => {
    const xml = `<mc:payload>${block('A', '30')}${block('B', '40')}${block('C', '50')}</mc:payload>`;
    const seen: string[] = [];
    const scanner = createNdwScanner(r => seen.push(r.site));
    for (let i = 0; i < xml.length; i += 97) scanner.push(xml.slice(i, i + 97));
    scanner.end();
    expect(seen).toEqual(['A', 'B', 'C']);
  });

  it('keeps only slow roads, joined to their line, with speed and percentage of usual', () => {
    const r = (site: string, travelS: number, extra: Partial<NdwReading> = {}): NdwReading => ({ site, at: '2026-10-15T21:10:00Z', travelS, usualS: 34, inputs: 95, ...extra });
    const sites = new Map([['slow', SITE], ['jam', SITE], ['free', SITE], ['thin', SITE], ['old', SITE]]);
    const segs = ndwSegments([
      r('slow', 60), r('jam', 100), r('free', 30), r('thin', 100, { inputs: 3 }), r('old', 100, { at: '2026-10-15T20:30:00Z' }), r('unknown', 100),
    ], sites, NOW);
    expect(segs.map(s => [s.id, s.level, s.pctOfUsual, s.kmh])).toEqual([['ndw:slow', 'slow', 57, 14], ['ndw:jam', 'jam', 34, 9]]);
    expect(segs[0].coords).toBe(SITE.coords);
  });
});

describe('levels', () => {
  it('tints below 65% of usual, and harder below 40%', () => {
    expect([levelFromPct(80), levelFromPct(64), levelFromPct(39)]).toEqual([null, 'slow', 'jam']);
  });
});

describe('site lines', () => {
  it('round-trips through the delta encoding at about a metre', () => {
    const line: [number, number][] = [[4.849505, 52.351593], [4.846023, 52.351582], [4.84, 52.36]];
    expect(decodeLine(encodeLine(line))).toEqual(line.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]));
  });

  it('simplifies a straight run to its ends but keeps a bend', () => {
    const straight: [number, number][] = [[5, 52], [5.001, 52], [5.002, 52]];
    expect(simplifyLine(straight, 2)).toEqual([[5, 52], [5.002, 52]]);
    const bend: [number, number][] = [[5, 52], [5.001, 52.001], [5.002, 52]];
    expect(simplifyLine(bend, 2)).toHaveLength(3);
    expect(lineLengthM(straight)).toBeCloseTo(137, 0);
  });
});

describe('Opendatasoft cities', () => {
  const rennes = ODS_CITIES.find(c => c.id === 'rennes')!;
  const feature = (props: Record<string, unknown>) => ({
    type: 'Feature', geometry: { type: 'LineString', coordinates: [[-1.6961, 48.0732], [-1.6956, 48.0747]] },
    properties: { predefinedlocationreference: '11652', denomination: 'Route départementale 837', datetime: '2026-10-15T23:08:00+02:00', averagevehiclespeed: 45, trafficstatus: 'heavy', vehicleprobemeasurement: 4, ...props },
  });

  it('asks only for congested rows and the fields it reads', () => {
    const url = new URL(odsExportUrl(rennes));
    expect(url.searchParams.get('where')).toBe('trafficstatus in ("heavy","congested","impossible")');
    expect(url.searchParams.get('select')).toContain('geo_shape');
  });

  it('maps the provider class and skips thin, stale or unclassed rows', () => {
    const segs = odsSegments(rennes, { features: [
      feature({}), feature({ trafficstatus: 'congested', predefinedlocationreference: '2' }),
      feature({ vehicleprobemeasurement: 1 }), feature({ datetime: '2026-10-15T22:00:00+02:00' }), feature({ trafficstatus: 'freeFlow' }),
    ] }, NOW);
    expect(segs.map(s => [s.id, s.level, s.status, s.kmh, s.at])).toEqual([
      ['rennes:11652', 'slow', 'heavy', 45, '2026-10-15T21:08:00.000Z'],
      ['rennes:2', 'jam', 'congested', 45, '2026-10-15T21:08:00.000Z'],
    ]);
  });
});

describe('describe', () => {
  it('says speed and percentage of usual for NDW, and the class for a city', () => {
    const tip = trafficTip({ id: 'ndw:x', name: SITE.name, kmh: 34, pctOfUsual: 60, at: '2026-10-15T21:10:00Z' }, NOW);
    expect(tip).toEqual({ key: 'traffic:ndw:x', name: 'Heemstedestraat Hoofddorpplein Westlandgracht', meta: '34 km/h, 60% of usual · measured 2 min ago' });
    expect(trafficTip({ id: 'rennes:1', kmh: 16, status: 'heavy', at: '2026-10-15T21:12:00Z' }, NOW).meta).toBe('16 km/h · heavy · measured just now');
  });

  it('leaves bare site codes unnamed', () => {
    expect(trafficRoadName({ name: '0010vwd0548ra0' })).toBeUndefined();
  });

  it('shows the usual speed only where the provider has one', () => {
    expect(trafficPopupHtml({ source: 'ndw', kmh: 30, pctOfUsual: 50, at: '2026-10-15T21:10:00Z' }, NOW)).toContain('60 km/h');
    expect(trafficPopupHtml({ source: 'nantes', kmh: 9, status: 'Saturé', level: 'jam', at: '2026-10-15T21:10:00Z' }, NOW)).not.toContain('Of usual');
  });
});

describe('view', () => {
  it('cuts a wide view around its centre', () => {
    expect(clampView([0, 50, 10, 54], [5, 52])).toEqual([3.5, 51, 6.5, 53]);
    expect(isTooWide([0, 50, 10, 54])).toBe(true);
  });
});
