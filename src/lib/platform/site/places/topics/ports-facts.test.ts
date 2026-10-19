import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import type { NearPort, PlacePorts } from './ports-data';
import { coverageOf, leadPort, portKind, portsIndexable, portStory, renderSentence, renderStory, type PortSentence } from './ports-facts';

const EN = createTranslator('en', {});
const AIS = { hours: 24, from: '2026-10-12T22:00:00.000Z', to: '2026-10-19T14:00:00.000Z' };
const ID = 1;

const port = (over: Partial<NearPort>): NearPort => ({
  wpi: 100, name: 'Harbour', km: 2, facilities: [], ice: false, vts: false, at: [4.48, 51.9], home: ID, ...over,
});
const place = (over: Partial<PlacePorts>): PlacePorts => ({ id: ID, ports: [], ais: AIS, wpi: '2026-10-19', ...over });

const ROTTERDAM = place({
  ports: [
    port({ wpi: 31140, name: 'Rotterdam', km: 2.5, size: 'large', type: 'river-basins', facilities: ['repairs', 'dry-dock'], channelM: 11, heard: 1787 }),
    port({ wpi: 31130, name: 'Schiedam', km: 6, size: 'very-small', home: 2 }),
  ],
  major: { name: 'Rotterdam', type: 'container', volume: '14.5M TEU', rank: 8, km: 2.9, at: [4.5, 51.9], home: ID, heard: 1989 },
});
const ISTANBUL = place({
  ports: [
    port({ wpi: 43420, name: 'Istanbul', km: 1.5, size: 'large', type: 'canal-lake', channelM: 12.5, heard: 11 }),
    port({ wpi: 44540, name: 'Haydarpasa', km: 5.8, size: 'medium', type: 'breakwater', heard: 11 }),
  ],
  chokepoint: { name: 'Turkish Straits', km: 16 },
});
const SCIACCA = place({ ports: [port({ wpi: 40190, name: 'Sciacca', km: 1, size: 'small', type: 'breakwater', use: 'fishing', channelM: 4.5, heard: 0 })] });

describe('leadPort', () => {
  it('leads with a harbour credited to the place, then the biggest, then the nearest', () => {
    const d = place({ ports: [port({ wpi: 1, km: 1, size: 'large', home: 9 }), port({ wpi: 2, km: 4, size: 'small' }), port({ wpi: 3, km: 3, size: 'medium' })] });
    expect(leadPort(d)?.wpi).toBe(3);
  });

  it('does not pass over a nearer unrated harbour for a very small one', () => {
    const d = place({ ports: [port({ wpi: 1, km: 2 }), port({ wpi: 2, km: 9, size: 'very-small' })] });
    expect(leadPort(d)?.wpi).toBe(1);
  });
});

describe('portKind', () => {
  it('tells a container hub, a town on a strait and a fishing harbour apart', () => {
    expect(portKind(ROTTERDAM)).toBe('container-hub');
    expect(portKind(ISTANBUL)).toBe('strait');
    expect(portKind(SCIACCA)).toBe('fishing');
  });

  it('calls a big harbour with oil terminals an energy port, and one with cargo berths a cargo port', () => {
    expect(portKind(place({ ports: [port({ size: 'medium', facilities: ['oil', 'container'] })] }))).toBe('energy-port');
    expect(portKind(place({ ports: [port({ size: 'medium', facilities: ['container'] })] }))).toBe('cargo');
    expect(portKind(place({ ports: [port({ size: 'small', facilities: ['container'] })] }))).toBe('harbour');
  });

  it('is only on the strait close to it', () => {
    expect(portKind({ ...SCIACCA, chokepoint: { name: 'Strait of Hormuz', km: 80 } })).toBe('fishing');
  });
});

describe('coverageOf', () => {
  it('reads few ships at a big port as thin reception, not a quiet harbour', () => {
    expect(coverageOf(ISTANBUL)).toBe('thin');
    expect(coverageOf(place({ ports: [port({ size: 'small', heard: 11 })] }))).toBe('heard');
  });

  it('counts at the map’s own point for a major port', () => {
    expect(coverageOf(ROTTERDAM)).toBe('busy');
    expect(coverageOf(SCIACCA)).toBe('silent');
    expect(coverageOf({ ...SCIACCA, ais: undefined })).toBe('unknown');
  });
});

describe('portsIndexable', () => {
  it('indexes a medium or large harbour credited to the place, where AIS is heard', () => {
    expect(portsIndexable(ROTTERDAM)).toBe(true);
    expect(portsIndexable(ISTANBUL)).toBe(true);
  });

  it('leaves out a district whose harbour is credited to the city', () => {
    expect(portsIndexable({ ...ISTANBUL, ports: ISTANBUL.ports.map(p => ({ ...p, home: 745044 })) })).toBe(false);
  });

  it('takes a small harbour only when AIS hears it busy', () => {
    expect(portsIndexable(place({ ports: [port({ size: 'small', heard: 49 })] }))).toBe(false);
    expect(portsIndexable(place({ ports: [port({ size: 'small', heard: 50 })] }))).toBe(true);
  });

  it('leaves out a port where AIS hears almost nothing, unless no sample was taken', () => {
    const dark = place({ ports: [port({ size: 'large', heard: 9 })] });
    expect(portsIndexable(dark)).toBe(false);
    expect(portsIndexable({ ...dark, ais: undefined })).toBe(true);
  });
});

describe('portStory', () => {
  const text = (d: PlacePorts, name: string) => renderStory(portStory(d)!, name, EN).join('\n');

  it('says different things about different ports, not one paragraph with the name swapped', () => {
    const ids = (d: PlacePorts) => portStory(d)!.sentences.map(s => s.id);
    expect(ids(ROTTERDAM)[0]).toBe('hub');
    expect(ids(ISTANBUL)[0]).toBe('strait');
    expect(ids(SCIACCA)[0]).toBe('use');
    expect(text(ROTTERDAM, 'Rotterdam')).toMatch(/^Rotterdam is one of the major container ports the map marks, at 14\.5M TEU a year/);
    expect(text(ISTANBUL, 'Istanbul')).toMatch(/^Istanbul lies on the Turkish Straits/);
    expect(text(ISTANBUL, 'Istanbul')).toMatch(/heard only 11 ships within 10 km of Istanbul: reception here is patchy/);
    expect(text(SCIACCA, 'Sciacca')).toMatch(/^By the World Port Index, Sciacca is a fishing harbour\./);
    expect(text(SCIACCA, 'Sciacca')).toMatch(/Small boats need not carry AIS/);
  });

  it('names the other harbours and links a district to the place its harbour is credited to', () => {
    expect(text(ROTTERDAM, 'Rotterdam')).toContain('Also within 10 km: Schiedam (6 km).');
    const district = portStory({ ...ISTANBUL, id: 2 })!;
    expect(district.creditedTo).toBe(ID);
    expect(district.index).toBe(false);
  });

  it('writes a harbour named like the place in the place’s spelling', () => {
    const d = place({ ports: [port({ name: 'Helsingor', size: 'very-small', type: 'breakwater', heard: 125 })] });
    expect(text(d, 'Helsingør')).toMatch(/^Helsingør’s own harbour is 2 km from the centre\. The Index rates Helsingør a very small coastal harbour/);
  });

  it('warns that warships sail dark at a naval base', () => {
    const d = place({ ports: [port({ size: 'large', heard: 196 })], major: { name: 'Norfolk Naval Station', type: 'naval', fleet: 'US Atlantic Fleet', km: 3, at: [-76.33, 36.95], home: ID, heard: 196 } });
    expect(text(d, 'Norfolk')).toMatch(/^Norfolk Naval Station is a naval base, home to the US Atlantic Fleet\./);
    expect(text(d, 'Norfolk')).toContain('Warships often sail with AIS switched off');
  });

  it('fills every variable of every sentence', () => {
    const all: PortSentence[] = [
      { id: 'hub', port: 'Busan', volume: '22.7M TEU', rank: 6 }, { id: 'hub', port: 'Busan', volume: '22.7M TEU' }, { id: 'hub', port: 'Busan' },
      { id: 'energy-major', port: 'Ras Tanura', volume: '6.5M bpd' }, { id: 'energy-major', port: 'Mizushima', volume: 'Industrial' },
      { id: 'energy-terminals', port: 'X', km: 3, terminals: ['oil', 'lng'] }, { id: 'naval', port: 'X', fleet: 'Royal Navy' }, { id: 'naval', port: 'X' },
      { id: 'strait', strait: 'Danish Straits' }, { id: 'use', port: 'X', use: 'ferry' }, { id: 'use', port: 'X', use: 'military' },
      { id: 'cargo', port: 'X', facilities: ['container', 'roro'] }, { id: 'cargo', port: 'X', facilities: [] }, { id: 'nearest', port: 'X', km: 4 },
      { id: 'rating', port: 'X', size: 'medium', type: 'roadstead' }, { id: 'rating', port: 'X', type: 'typhoon' }, { id: 'rating', port: 'X', size: 'small' },
      { id: 'facilities', facilities: ['dry-bulk', 'liquid-bulk', 'breakbulk'] }, { id: 'limits', lengthM: 300, depthM: 14 }, { id: 'limits', lengthM: 300 },
      { id: 'limits', depthM: 9.4 }, { id: 'ice' }, { id: 'vts' }, { id: 'others', ports: [{ name: 'A', km: 3 }, { name: 'B', km: 7 }] },
      { id: 'major-nearby', port: 'X', km: 12 }, { id: 'chokepoint-near', strait: 'Suez Canal', km: 93 }, { id: 'ais-dark' },
      ...(['silent', 'thin', 'heard', 'busy'] as const).flatMap(level => [true, false].map(small => ({ id: 'coverage' as const, level, port: 'X', n: level === 'thin' ? 1 : 120, hours: 24, from: AIS.from, to: AIS.to, small }))),
    ];
    const out = all.map(s => renderSentence(s, 'Town', EN));
    expect(out.filter(s => /[{}]|undefined|NaN/.test(s))).toEqual([]);
    // formatRange puts thin spaces around the dash.
    expect(renderSentence(all[all.length - 3], 'Town', EN).replace(/\s/g, ' ')).toBe('In 24 hours of AIS recorded Oct 12 – 19, the map heard 120 different ships within 10 km of X.');
  });
});
