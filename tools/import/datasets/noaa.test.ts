import { describe, expect, it } from 'vitest';
import { Prec } from '@takip/core/time';
import { utc } from '../dates';
import { nceiTime } from './noaa';

describe('nceiTime', () => {
  it('reads NCEI BCE years, which have no year 0', () => {
    expect(nceiTime({ year: -1610 })).toEqual({ t: utc(-1609), prec: Prec.year });
    expect(nceiTime({ year: 79, month: 8, day: 24 })).toEqual({ t: utc(79, 8, 24), prec: Prec.day });
  });
});
