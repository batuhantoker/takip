import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES, shipColor, shipFilter } from './filter';

const allOn = Object.fromEntries(SHIP_CLASSES.map(c => [c.key, true]));

describe('shipFilter', () => {
  it('shows every class when every toggle is on', () => {
    expect(shipFilter(allOn)).toEqual(['in', ['get', 'type'], ['literal', SHIP_CLASSES.map(c => c.type)]]);
  });

  it('drops a class whose toggle is off', () => {
    const filter = shipFilter({ ...allOn, ships_fishing: false });
    expect(JSON.stringify(filter)).not.toContain('"fishing"');
    expect(JSON.stringify(filter)).toContain('"cargo"');
  });

  it('treats a toggle the saved settings predate as on', () => {
    expect(shipFilter({})).toEqual(shipFilter(allOn));
  });

  it('adds a speed floor for underway only', () => {
    expect(shipFilter({ ...allOn, ships_underway: true })).toEqual([
      'all',
      ['in', ['get', 'type'], ['literal', SHIP_CLASSES.map(c => c.type)]],
      ['>=', ['coalesce', ['get', 'speed'], 0], 0.5],
    ]);
  });
});

describe('shipColor', () => {
  it('falls back to grey for anything unclassified', () => {
    expect(shipColor('tanker')).toBe('#D49A4E');
    expect(shipColor(undefined)).toBe('#7F8B96');
  });
});
