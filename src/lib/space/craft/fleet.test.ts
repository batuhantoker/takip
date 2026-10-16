import { describe, expect, it } from 'vitest';
import { AU_KM, scale } from '../astro';
import { classify, craftName, isCandidate, type Neighbours } from './fleet';
import type { Vec3 } from '../horizons';

const mb = (id: number, name: string) => ({ id, name, designation: '', aliases: '' });

describe('isCandidate', () => {
  it('keeps spacecraft and drops bodies, simulations, debris and spent stages', () => {
    expect(isCandidate(mb(-170, 'James Webb Space Telescope (spacecr'))).toBe(true);
    expect(isCandidate(mb(-143205, 'SpaceX Roadster (spacecraft)'))).toBe(true);
    expect(isCandidate(mb(301, 'Moon'))).toBe(false);
    expect(isCandidate(mb(-937001, '2017 PDC (simulation)'))).toBe(false);
    expect(isCandidate(mb(-999789, '2023 NM (debris)'))).toBe(false);
    expect(isCandidate(mb(-74900, 'MRO Centaur Stage (spacecraft)'))).toBe(false);
    expect(isCandidate(mb(-162719, 'Falcon 9 RB Booster'))).toBe(false);
    expect(isCandidate(mb(-107964, 'Atlas-Agena_RB (spacecraft)'))).toBe(false);
    expect(isCandidate(mb(-29900, 'Stardust (SRC) (spacecraft)'))).toBe(false);
    expect(isCandidate(mb(-997, 'NEOCP 6Q0B44E'))).toBe(false);
    expect(isCandidate(mb(-136134, ''))).toBe(false);
  });
});

describe('craftName', () => {
  it('drops the spacecraft tag, whole or truncated', () => {
    expect(craftName('Voyager 1 (spacecraft)')).toBe('Voyager 1');
    expect(craftName('Mars Reconnaissance Orbiter (spacec')).toBe('Mars Reconnaissance Orbiter');
    expect(craftName('BepiColombo (Spacecraft)')).toBe('BepiColombo');
    expect(craftName('Chandrayaan-2 (ORBITER) (spacecraft')).toBe('Chandrayaan-2 (ORBITER)');
    expect(craftName('Chandrayaan-3 (LANDER spacecraft)')).toBe('Chandrayaan-3 (LANDER)');
    expect(craftName('Carruthers Geocorona Observatory (s')).toBe('Carruthers Geocorona Observatory');
    expect(craftName('Aditya-L1')).toBe('Aditya-L1');
  });
});

describe('classify', () => {
  const earth: Vec3 = [AU_KM, 0, 0];
  const n: Neighbours = {
    earth,
    moon: [AU_KM + 384_400, 0, 0],
    mars: [0, 1.5 * AU_KM, 0],
    jupiter: [-5.2 * AU_KM, 0, 0],
  };
  const at = (base: Vec3, dx: number, dy = 0): Vec3 => [base[0] + dx, base[1] + dy, base[2]];

  it.each([
    ['ISS', at(earth, 6_800), 'earth-orbit'],
    ['LRO', at(n.moon, 1_800), 'moon'],
    ['TESS at apogee', at(earth, 0, 370_000), 'cislunar'],
    ['SOHO', at(earth, -1_500_000), 'sun-earth-l1'],
    ['JWST', at(earth, 1_500_000), 'sun-earth-l2'],
    ['MRO', at(n.mars!, 3_700), 'mars'],
    ['Juno', at(n.jupiter!, 4_000_000), 'jupiter'],
    ['Psyche', [0, 2.2 * AU_KM, 0] as Vec3, 'interplanetary'],
    ['New Horizons', scale([1, 0, 0], 62 * AU_KM), 'outer'],
    ['Voyager 1', scale([0, 1, 0], 168 * AU_KM), 'interstellar'],
  ] as const)('puts %s in %s', (_name, helio, region) => {
    expect(classify(helio as Vec3, n)).toBe(region);
  });
});
