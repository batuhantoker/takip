import { describe, expect, it } from 'vitest';
import { groupHosts, splitCsv } from './exoplanets';

const CSV = `pl_name,hostname,ra,dec,sy_dist,sy_vmag,pl_orbper,pl_rade,pl_bmasse,disc_year,discoverymethod
"Proxima Cen b","Proxima Cen",217.3934657,-62.6761821,1.30119000,11.1300000,11.18465000000,,1.07000000,2016,"Radial Velocity"
"Proxima Cen d","Proxima Cen",217.3934657,-62.6761821,1.30119000,11.1300000,5.12200000000,,0.26000000,2022,"Radial Velocity"
"HD 2039 b","HD 2039",6.0851069,-56.6499880,85.69220000,9.0000000,1120.00000000000,12.70000000,1999.15070000,2002,"Radial Velocity"
"Lost b","Lost",1,2,,,1,,,2020,"Transit"`;

describe('splitCsv', () => {
  it('keeps commas inside quotes', () => {
    expect(splitCsv('"a, b",2,"c"')).toEqual(['a, b', '2', 'c']);
  });
});

describe('groupHosts', () => {
  it('groups planets by host, nearest first, dropping hosts with no distance', () => {
    const hosts = groupHosts(CSV);
    expect(hosts.map(h => h.name)).toEqual(['Proxima Cen', 'HD 2039']);
    expect(hosts[0].ly).toBeCloseTo(4.24, 2);
    expect(hosts[0].planets).toHaveLength(2);
    expect(hosts[0].planets[0]).toEqual(['Proxima Cen b', 11.185, null, 1.07, 2016, 'Radial Velocity']);
  });
});
