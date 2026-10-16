import { describe, expect, it } from 'vitest';
import { ecccPageUrl, ecccSeverity, mapEcccFeature, parseEcccPage, type EcccFeature } from './eccc';

// Shaped from api.weather.gc.ca weather-alerts, 2026-10-12 (polygon simplified).
const RAINFALL: EcccFeature = {
  id: '170523781467898866202610120504_fea1-1056',
  geometry: { type: 'Polygon', coordinates: [[[-73, 46], [-72, 46], [-72, 47], [-73, 47], [-73, 46]]] },
  properties: {
    alert_code: 'RFW',
    alert_type: 'warning',
    alert_name_en: 'rainfall warning',
    publication_datetime: '2026-10-12T19:32:32.735Z',
    expiration_datetime: '2026-10-13T11:32:32.735Z',
    risk_colour_en: 'yellow',
    feature_name_en: 'Sorel - Yamaska area',
    province: 'QC',
    status_en: 'issued',
  },
};

describe('mapEcccFeature', () => {
  it('maps an alert area to a weather event at the polygon centre', () => {
    expect(mapEcccFeature(RAINFALL)).toEqual({
      id: 'eccc-170523781467898866202610120504_fea1-1056',
      title: 'Rainfall warning — Sorel - Yamaska area',
      category: 'weatherAlerts',
      type: 'Rainfall warning',
      icon: 'weather',
      severity: 'medium',
      lat: 46.5,
      lng: -72.5,
      date: '2026-10-12T19:32:32.735Z',
      expires: '2026-10-13T11:32:32.735Z',
      area: 'Sorel - Yamaska area, QC',
      source: 'https://weather.gc.ca/warnings/index_e.html?prov=qc',
      provider: 'ECCC',
    });
  });

  it('centres a multipolygon on its largest part', () => {
    const e = mapEcccFeature({
      ...RAINFALL,
      geometry: { type: 'MultiPolygon', coordinates: [
        [[[-60, 50], [-59.9, 50], [-59.9, 50.1], [-60, 50]]],
        [[[-80, 40], [-78, 40], [-78, 42], [-80, 42], [-80, 40]]],
      ] },
    });
    expect(e).toMatchObject({ lat: 41, lng: -79 });
  });

  it('drops features without an id or geometry', () => {
    expect(mapEcccFeature({ ...RAINFALL, id: undefined })).toBeNull();
    expect(mapEcccFeature({ ...RAINFALL, geometry: null })).toBeNull();
  });
});

describe('ecccSeverity', () => {
  it('grades by risk colour, then by alert type', () => {
    expect(ecccSeverity({ risk_colour_en: 'red' })).toBe('high');
    expect(ecccSeverity({ risk_colour_en: 'orange' })).toBe('high');
    expect(ecccSeverity({ risk_colour_en: 'yellow', alert_type: 'advisory' })).toBe('medium');
    expect(ecccSeverity({ risk_colour_en: null, alert_type: 'warning' })).toBe('medium');
    expect(ecccSeverity({ risk_colour_en: null, alert_type: 'statement' })).toBe('low');
  });
});

describe('ecccPageUrl and parseEcccPage', () => {
  it('pages one status at a time', () => {
    expect(ecccPageUrl('continued', 250)).toBe('https://api.weather.gc.ca/collections/weather-alerts/items?f=json&status_en=continued&limit=250&offset=250&sortby=feature_id');
  });

  it('throws on an unexpected body', () => {
    expect(() => parseEcccPage({ type: 'Exception' })).toThrow(/shape/);
    expect(parseEcccPage({ features: [] })).toEqual([]);
  });
});
