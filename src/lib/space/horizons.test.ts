import { describe, expect, it } from 'vitest';
import { coverageGap, horizonsUrl, jdFromMs, longitudeSense, msFromJd, parseMajorBodies, parseObserver, parseVectors, vectorParams } from './horizons';

const VECTORS = `
Target body name: James Webb Space Telescope (spacecraft) (-170) {source: JWST_merged}
            JDTDB,            Calendar Date (TDB),                      X,                      Y,                      Z,                     VX,                     VY,                     VZ,
**************************************************************************************************************************************************************************************************
$$SOE
2461325.500000000, A.D. 2026-Oct-12 00:00:00.0000,  1.427206054198491E+08,  4.795028532391611E+07,  1.106842031541765E+05, -1.005054938753657E+01,  2.854401387085247E+01, -1.208590745726017E-01,
2461326.000000000, A.D. 2026-Oct-12 12:00:00.0000,  1.422811195082219E+08,  4.918149270371831E+07,  1.054439444309548E+05, -1.029589201077094E+01,  2.845597357171390E+01, -1.217369372595183E-01,
$$EOE
**************************************************************************************************************************************************************************************************
`;

const OBSERVER = `
Target pole/equ : IAU_MARS                        {West-longitude positive}
*************************************************************************************
 Date__(UT)__HR:MN:SC.fff, , , ObsSub-LON, ObsSub-LAT,             delta,     deldot,
*************************************************************************************
$$SOE
 2026-Oct-12 00:00:00.000, , , 289.518876,  -1.372493,  0.00002447418059,  0.0300052,
 2026-Oct-12 01:00:00.000, , , 124.612587,  -9.367155,  0.00002444621419, -0.0309123,
$$EOE
`;

const MB = [
  '*******************************************************************************',
  ' Multiple major-bodies match string "*"',
  '',
  '  ID#      Name                               Designation  IAU/aliases/other   ',
  '  -------  ---------------------------------- -----------  ------------------- ',
  '      301  Moon                                            Luna                 ',
  '      -48  Hubble Space Telescope (spacecraft)1990-037B    HST                  ',
  '      -74  Mars Reconnaissance Orbiter (spacec2005-029A    MRO                  ',
  '    -1024  Artemis II (spacecraft)            2026-069A    Integrity Orion EM-2 ',
  ' -9901491  Tianwen-1 (spacecraft)             2020-049A                         ',
  '920003548                                                                       ',
  ' ',
  '   Number of matches =         829 . Use ID# to make unique selection.',
].join('\n');

describe('horizonsUrl', () => {
  it('quotes each value and asks for a grid of epochs', () => {
    const url = horizonsUrl(vectorParams('-170', { start: 2461325.5, stop: 2461326.5, stepMinutes: 60 }));
    const q = new URL(url).searchParams;
    expect(q.get('format')).toBe('json');
    expect(q.get('COMMAND')).toBe("'-170'");
    expect(q.get('START_TIME')).toBe("'JD2461325.500000'");
    expect(q.get('STEP_SIZE')).toBe("'60m'");
    expect(q.get('CENTER')).toBe("'500@10'");
    expect(url.length).toBeLessThan(400);
  });
});

describe('parseVectors', () => {
  it('reads position and velocity rows', () => {
    const rows = parseVectors(VECTORS);
    expect(rows).toHaveLength(2);
    expect(rows[0].jd).toBe(2461325.5);
    expect(rows[0].pos[0]).toBeCloseTo(1.427206054198491e8, 0);
    expect(rows[1].vel[2]).toBeCloseTo(-0.1217369, 6);
  });

  it('returns nothing for an error reply', () => {
    expect(parseVectors('No ephemeris for target "Mir (spacecraft)" after A.D. 2001-MAR-23')).toEqual([]);
  });
});

describe('parseObserver', () => {
  it('keys rows by the CSV header', () => {
    const rows = parseObserver(OBSERVER);
    expect(rows).toHaveLength(2);
    expect(rows[0]['Date__(UT)__HR:MN:SC.fff']).toBe('2026-Oct-12 00:00:00.000');
    expect(Number(rows[0]['ObsSub-LON'])).toBeCloseTo(289.518876);
    expect(Number(rows[1]['ObsSub-LAT'])).toBeCloseTo(-9.367155);
  });
});

describe('longitudeSense', () => {
  it('reads the target frame’s longitude direction', () => {
    expect(longitudeSense(OBSERVER)).toBe('west');
    expect(longitudeSense('Target pole/equ : MOON_ME                         {East-longitude positive}')).toBe('east');
    expect(longitudeSense('no header')).toBeNull();
  });
});

describe('coverageGap', () => {
  it('reads where an ephemeris starts', () => {
    const gap = coverageGap('No ephemeris for target "Artemis II (spacecraft)" prior to A.D. 2026-APR-02 01:58:32.3050 TDB');
    expect(gap?.kind).toBe('before');
    expect(gap?.boundary.toISOString()).toBe('2026-04-02T01:58:32.000Z');
  });

  it('reads where an ephemeris ends', () => {
    const gap = coverageGap('No ephemeris for target "Mariner 2 (spacecraft)" after A.D. 1963-JAN-01 00:00:00.0000 TDB');
    expect(gap).toEqual({ kind: 'after', boundary: new Date('1963-01-01T00:00:00Z') });
  });

  it('ignores other errors', () => {
    expect(coverageGap('Cannot interpret date')).toBeNull();
  });
});

describe('parseMajorBodies', () => {
  it('splits columns, including names that run into the designation', () => {
    const bodies = parseMajorBodies(MB);
    expect(bodies.map(b => b.id)).toEqual([301, -48, -74, -1024, -9901491, 920003548]);
    expect(bodies[1]).toEqual({ id: -48, name: 'Hubble Space Telescope (spacecraft)', designation: '1990-037B', aliases: 'HST' });
    expect(bodies[2]).toMatchObject({ name: 'Mars Reconnaissance Orbiter (spacec', designation: '2005-029A', aliases: 'MRO' });
    expect(bodies[3].aliases).toBe('Integrity Orion EM-2');
    expect(bodies[5].name).toBe('');
  });
});

describe('Julian dates', () => {
  it('round-trips through epoch milliseconds', () => {
    const ms = Date.UTC(2026, 9, 12);
    expect(jdFromMs(ms)).toBe(2461325.5);
    expect(msFromJd(2461325.5)).toBe(ms);
  });
});
