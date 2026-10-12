import { describe, expect, it } from 'vitest';
import { mergeIdentity } from './identity';

describe('mergeIdentity', () => {
  const trace = { registration: 'VP-BMG', typeCode: 'B77L', model: 'BOEING 777-200LR' };
  const db = { manufacturer: 'Boeing', type: '777F', icao_type: 'B77L', registration: 'VP-BMG', registered_owner: 'Silk Way West Airlines' };

  it('prefers the trace, taking the operator from adsbdb', () => {
    expect(mergeIdentity(trace, db, null)).toEqual({ ...trace, operator: 'Silk Way West Airlines' });
  });

  it('builds the model from adsbdb when there is no trace', () => {
    expect(mergeIdentity(null, db, null).model).toBe('Boeing 777F');
  });

  // 801904 (IGO527Y): no registration in the trace, unknown to adsbdb, named by adsb.fi.
  it('fills what the others leave blank from adsb.fi', () => {
    const blank = { registration: null, typeCode: null, model: null };
    expect(mergeIdentity(blank, undefined, { r: 'VT-NOH ', t: 'A21N', desc: 'AIRBUS A-321neo' })).toEqual({
      registration: 'VT-NOH', typeCode: 'A21N', model: 'AIRBUS A-321neo', operator: null,
    });
  });

  it('is all null when nobody knows the airframe', () => {
    expect(mergeIdentity(null, null, null)).toEqual({ registration: null, typeCode: null, model: null, operator: null });
  });
});
