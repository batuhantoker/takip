import { describe, expect, it } from 'vitest';
import { mergeIdentity } from './identity';

describe('mergeIdentity', () => {
  const db = { manufacturer: 'Boeing', type: '777F', icao_type: 'B77L', registration: 'VP-BMG', registered_owner: 'Silk Way West Airlines' };

  it('takes the airframe and the operator from adsbdb', () => {
    expect(mergeIdentity(db, { r: 'XX-XXX', t: 'B738' })).toEqual({
      registration: 'VP-BMG', typeCode: 'B77L', model: 'Boeing 777F', operator: 'Silk Way West Airlines',
    });
  });

  // 801904 (IGO527Y): unknown to adsbdb, named by adsb.fi.
  it('fills what adsbdb leaves blank from adsb.fi', () => {
    expect(mergeIdentity(undefined, { r: 'VT-NOH ', t: 'A21N', desc: 'AIRBUS A-321neo' })).toEqual({
      registration: 'VT-NOH', typeCode: 'A21N', model: 'AIRBUS A-321neo', operator: null,
    });
  });

  it('is all null when nobody knows the airframe', () => {
    expect(mergeIdentity(null, null)).toEqual({ registration: null, typeCode: null, model: null, operator: null });
  });
});
