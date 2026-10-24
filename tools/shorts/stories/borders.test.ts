import { describe, expect, it } from 'vitest';
import { bordersProblem } from './borders';

const legs = [{ id: 'y1914', year: '1914', gone: ['Kingdom of Kongo'] }];
const lines = (line: string, hook = 'Africa, 1870 to 1914.') => ({ hook, lines: { y1914: line }, outro: 'Scrub through it yourself on TAKIP.' });

describe('bordersProblem', () => {
  it('passes a line that names its year and what is on the map', () => {
    expect(bordersProblem(lines('By 1914, the Belgian Congo and French West Africa are on the map.'), legs)).toBeNull();
  });
  it('rejects rankings and talk of the screen', () => {
    expect(bordersProblem(lines('In 1914, French Africa covers more of the screen.'), legs)).toMatch(/cover/);
    expect(bordersProblem(lines('In 1914, Britain takes the lead.'), legs)).toMatch(/lead/);
    expect(bordersProblem(lines('In 1914 it is all on the map.', 'Watch one empire dominate Africa.'), legs)).toMatch(/hook/);
    expect(bordersProblem(lines('By 1914, the Congo joins the Belgian Empire.'), legs)).toMatch(/join/);
  });
  it('calls a state gone only when the data says so', () => {
    expect(bordersProblem(lines('By 1914, the Belgian Congo leaves the map.'), legs)).toMatch(/gone/);
    expect(bordersProblem(lines('By 1914, the Kingdom of Kongo is gone.'), legs)).toBeNull();
  });
  it('wants the year in every line', () => {
    expect(bordersProblem(lines('The Belgian Congo is on the map.'), legs)).toMatch(/1914/);
  });
});

describe('regions', () => {
  it('keeps Africa to the states that mostly lie on it', async () => {
    const { regionOf } = await import('./borders');
    const square = (x: number, y: number) => ({ type: 'Polygon' as const, coordinates: [[[x - 1, y - 1], [x + 1, y - 1], [x + 1, y + 1], [x - 1, y + 1], [x - 1, y - 1]]] as [number, number][][] });
    expect(regionOf('africa', square(-5.8, 35.7))).toBe(true); // Tangier
    expect(regionOf('africa', square(24.8, 35.2))).toBe(false); // Crete
    expect(regionOf('africa', square(14.4, 35.9))).toBe(false); // Malta
    expect(regionOf('europe', square(9.5, 34.5))).toBe(false); // Tunisia
    expect(regionOf('europe', square(10, 51))).toBe(true); // Germany
  });
  it('keeps the Asian regions off their neighbours at the frame edge', async () => {
    const { regionOf } = await import('./borders');
    const square = (x: number, y: number) => ({ type: 'Polygon' as const, coordinates: [[[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5], [x - 0.5, y - 0.5]]] as [number, number][][] });
    expect(regionOf('southeast-asia', square(96, 4.5))).toBe(true); // Aceh
    expect(regionOf('southeast-asia', square(132, 34))).toBe(false); // western Japan
    expect(regionOf('east-asia', square(127, 37))).toBe(true); // Korea
    expect(regionOf('east-asia', square(106, 16))).toBe(false); // central Vietnam
    expect(regionOf('arabia', square(46.7, 24.7))).toBe(true); // Riyadh
    expect(regionOf('arabia', square(35, 31.5))).toBe(false); // Israel
    expect(regionOf('iran', square(51.7, 32.7))).toBe(true); // Isfahan
    expect(regionOf('iran', square(44.4, 33.3))).toBe(false); // Baghdad
    expect(regionOf('south-asia', square(78, 22))).toBe(true); // India
    expect(regionOf('south-asia', square(88, 31))).toBe(false); // Tibet
    expect(regionOf('mena', square(14, 37.5))).toBe(true); // Sicily
    expect(regionOf('mena', square(12.5, 41.9))).toBe(false); // Rome
    expect(regionOf('west-africa', square(-3, 13))).toBe(true); // the Niger bend
    expect(regionOf('west-africa', square(-6, 33))).toBe(false); // Morocco
  });
});

describe('renames', () => {
  it('pairs a state gone with a new one on the same ground, not one swallowed by a bigger state', async () => {
    const { renames } = await import('./borders');
    const at = (cells: Record<string, number[]>) => ({ all: Object.keys(cells), notable: [], cells });
    const before = at({ Czechoslovakia: [1, 2, 3, 4, 5], 'Beylik of Tunis': [10, 11, 12] });
    const after = at({ 'Czechoslovak Socialist Republic': [1, 2, 3, 4, 6], 'French Africa': [10, 11, 12, 20, 21, 22, 23, 24, 25] });
    expect(renames(before, after, ['Czechoslovakia', 'Beylik of Tunis'], ['Czechoslovak Socialist Republic', 'French Africa']))
      .toEqual([['Czechoslovakia', 'Czechoslovak Socialist Republic']]);
    // a successor on the same ground keeps no root of the name, so it stays gone and new
    const raj = at({ 'British Empire': [1, 2, 3, 4, 5] });
    const india = at({ 'Republic of India': [1, 2, 3, 4, 5] });
    expect(renames(raj, india, ['British Empire'], ['Republic of India'])).toEqual([]);
    expect(renames(at({ 'Kingdom of Portugal': [1, 2, 3] }), at({ 'Portuguese Republic': [1, 2, 3] }), ['Kingdom of Portugal'], ['Portuguese Republic']))
      .toEqual([['Kingdom of Portugal', 'Portuguese Republic']]);
  });
  it('pairs a state that grew as it changed its name, but not one split off with a side of its own', async () => {
    const { renames } = await import('./borders');
    const at = (cells: Record<string, number[]>) => ({ all: Object.keys(cells), notable: [], cells });
    const republic = at({ 'Roman Republic': [1, 2, 3, 4] });
    const empire = at({ 'Roman Empire': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
    expect(renames(republic, empire, ['Roman Republic'], ['Roman Empire'])).toEqual([['Roman Republic', 'Roman Empire']]);
    expect(renames(at({ 'Tsardom of Russia': [1, 2, 3] }), at({ 'Russian Empire': [1, 2, 3, 4, 5, 6, 7, 8] }), ['Tsardom of Russia'], ['Russian Empire']))
      .toEqual([['Tsardom of Russia', 'Russian Empire']]);
    expect(renames(empire, at({ 'Eastern Roman Empire': [7, 8, 9, 10] }), ['Roman Empire'], ['Eastern Roman Empire'])).toEqual([]);
  });
});

describe('counting states', () => {
  it('rejects a count of states the frame cannot back', () => {
    expect(bordersProblem(lines('In 1914, nine states are gone.'), legs)).toMatch(/count/);
    expect(bordersProblem(lines('Africa, 1870 to 1914.', 'Africa had 66 states in 1870.'), legs)).toMatch(/count/);
  });
});

describe('bordersProblem and states that only left the frame', () => {
  const legs = [{ id: 'y1920', year: '1920', gone: ['Austria-Hungary'], left: ['Ottoman Empire'] }];
  const lines = (y1920: string) => ({ hook: 'Today: the Balkans.', outro: '', lines: { y1920 } });
  it('refuses calling a state gone when it still exists elsewhere', () => {
    expect(bordersProblem(lines('By 1920, the Ottoman Empire and Austria-Hungary are gone.'), legs)).toMatch(/Ottoman Empire/);
  });
  it('lets it be out of the region, and a real ending be gone', () => {
    expect(bordersProblem(lines('By 1920, Austria-Hungary is gone, and the Ottoman Empire is out of the Balkans.'), legs)).toBeNull();
    expect(bordersProblem(lines('By 1920, Austria-Hungary is gone.'), legs)).toBeNull();
  });
});

describe('bordersProblem and states that only came into the frame', () => {
  const legs = [{ id: 'y1890', year: '1890', gone: ['Tokugawa Shogunate'], entered: ['Russian Empire'] }];
  const lines = (y1890: string) => ({ hook: 'Today: Japan.', outro: '', lines: { y1890 } });
  it('refuses telling a state as new when it existed elsewhere before', () => {
    expect(bordersProblem(lines('1890: the Tokugawa Shogunate is gone. The Empire of Japan and Russian Empire appear.'), legs)).toMatch(/Russian Empire/);
  });
  it('lets it reach the region', () => {
    expect(bordersProblem(lines('1890: the Tokugawa Shogunate is gone, and the Russian Empire reaches the region.'), legs)).toBeNull();
  });
});
