import { describe, expect, it } from 'vitest';
import { fireIncidentFeatures, fireIncidentPopupHtml, type FireIncidentRow } from './fire-incidents';

const FIRE: FireIncidentRow = {
  id: '2026_BC_2026-C10467', name: 'Swede Creek', agency: 'British Columbia', lat: 53.9, lng: -124.6, sizeHa: 1815,
  stage: 'OC', stageLabel: 'Out of control', cause: 'Natural', updated: '2026-10-01T08:00:00Z', ofNote: true,
  url: 'https://wildfiresituation.nrs.gov.bc.ca/incidents?fireYear=2026&incidentNumber=C10467',
};

describe('fireIncidentFeatures', () => {
  it('colours by stage of control and carries the size for the radius', () => {
    const [f] = fireIncidentFeatures([FIRE, { ...FIRE, lat: NaN }]);
    expect(f.geometry.coordinates).toEqual([-124.6, 53.9]);
    expect(f.properties).toMatchObject({ color: '#FF1744', size: 1815 });
  });
});

describe('fireIncidentPopupHtml', () => {
  it('shows stage, size and the fire-of-note flag', () => {
    const html = fireIncidentPopupHtml({ ...FIRE });
    expect(html).toContain('Out of control');
    expect(html).toContain('1,815 ha');
    expect(html).toContain('FIRE OF NOTE');
  });

  it('shows an unknown size as unknown, not zero', () => {
    expect(fireIncidentPopupHtml({ ...FIRE, sizeHa: null })).toContain('—');
  });
});
