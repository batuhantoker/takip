import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT, backToCorners, cornerOf, fromStudio, isDefault, isShown, menuCornerOf, moveBy, moveToCorner, normalize, placeFreely, resetForm, restore,
  setRailBreak, setShown, setStatusSide, sideOf,
} from './model';

describe('normalize', () => {
  it('gives the designed layout for nothing saved or something unreadable', () => {
    expect(normalize(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(normalize('nonsense')).toEqual(DEFAULT_LAYOUT);
    expect(normalize({ desktop: [], phone: 3 })).toEqual(DEFAULT_LAYOUT);
  });

  it('round-trips a saved layout unchanged', () => {
    const saved = moveToCorner(setShown(DEFAULT_LAYOUT, 'desktop', 'status:clock', false), 'search', 'top-right');
    expect(normalize(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('drops unknown and repeated ids', () => {
    const l = normalize({
      desktop: { hidden: ['rail:alerts', 'rail:alerts', 'rail:nope', 7], rail: ['alerts', 'alerts', 'bogus', 'layers'] },
      phone: { hidden: ['logo', 'statusbar'], bar: ['route', 'route'] },
    });
    expect(l.desktop.hidden).toEqual(['rail:alerts']);
    expect(l.desktop.rail[0]).toBe('alerts');
    expect(l.desktop.rail.indexOf('alerts')).toBeLessThan(l.desktop.rail.indexOf('layers'));
    expect(l.desktop.rail).toHaveLength(8);
    expect(new Set(l.desktop.rail).size).toBe(l.desktop.rail.length);
    expect(l.phone.hidden).toEqual(['logo']);
    expect(l.phone.bar.filter(id => id === 'route')).toHaveLength(1);
    expect(l.phone.bar).toHaveLength(8);
  });

  it('puts an id missing from the saved order back after the one it follows by default', () => {
    expect(normalize({ desktop: { rail: ['recon', 'layers', 'alerts'] } }).desktop.rail)
      .toEqual(['recon', 'arcgis', 'layers', 'alerts', 'draw', 'history', 'space', 'directions']);
  });

  it('keeps a piece moved to another corner or side there, and restores one missing from all of them', () => {
    const l = normalize({
      desktop: {
        corners: { 'top-left': [], 'top-right': ['search', 'showing'], 'bottom-left': ['switcher'], 'bottom-right': ['controls'] },
        status: { left: ['clock'], right: ['live'] },
      },
    });
    expect(l.desktop.corners).toEqual({ 'top-left': [], 'top-right': ['search', 'showing'], 'bottom-left': ['switcher'], 'bottom-right': ['controls', 'scale'] });
    expect(l.desktop.status.left).toEqual(['position', 'place', 'clock']);
    expect(l.desktop.status.right).toEqual(['quake', 'live', 'tracked', 'shortcuts']);
  });

  it('keeps a saved empty set of gaps rather than restoring the default ones', () => {
    expect(normalize({ desktop: { railBreaks: [] } }).desktop.railBreaks).toEqual([]);
    expect(normalize({ desktop: {} }).desktop.railBreaks).toEqual(['history', 'recon']);
  });
});

describe('restore', () => {
  it('leaves a complete list alone', () => {
    expect(restore(['b', 'a'], ['a', 'b'])).toEqual(['b', 'a']);
  });
  it('puts a first item first', () => {
    expect(restore(['b'], ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('fromStudio', () => {
  it('carries Style studio’s zoom buttons switch over', () => {
    expect(isShown(fromStudio({ mapControls: false }), 'desktop', 'control:zoom')).toBe(false);
    expect(fromStudio({ mapControls: true })).toEqual(DEFAULT_LAYOUT);
    expect(fromStudio(null)).toEqual(DEFAULT_LAYOUT);
  });
});

describe('changes', () => {
  it('hides and shows a piece per form', () => {
    const hidden = setShown(DEFAULT_LAYOUT, 'phone', 'overlay:showing', false);
    expect(isShown(hidden, 'phone', 'overlay:showing')).toBe(false);
    expect(isShown(hidden, 'desktop', 'overlay:showing')).toBe(true);
    expect(isShown(setShown(hidden, 'phone', 'overlay:showing', true), 'phone', 'overlay:showing')).toBe(true);
    expect(setShown(setShown(hidden, 'phone', 'overlay:showing', false), 'phone', 'overlay:showing', false).phone.hidden).toEqual(['overlay:showing']);
  });

  it('moves within a list and holds at the ends', () => {
    expect(moveBy(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
    expect(moveBy(['a', 'b', 'c'], 'c', 5)).toEqual(['a', 'b', 'c']);
    expect(moveBy(['a', 'b', 'c'], 'b', -9)).toEqual(['b', 'a', 'c']);
    expect(moveBy(['a'], 'z', 1)).toEqual(['a']);
  });

  it('moves a status piece to the inner end of the other side', () => {
    const l = setStatusSide(DEFAULT_LAYOUT, 'clock', 'left');
    expect(l.desktop.status.left).toEqual(['position', 'place', 'clock']);
    expect(sideOf(l, 'clock')).toBe('left');
    expect(setStatusSide(l, 'position', 'right').desktop.status.right[0]).toBe('position');
    expect(setStatusSide(l, 'clock', 'left')).toBe(l);
  });

  it('moves a map piece into another corner after what is there', () => {
    const l = moveToCorner(DEFAULT_LAYOUT, 'showing', 'bottom-left');
    expect(l.desktop.corners['top-right']).toEqual([]);
    expect(l.desktop.corners['bottom-left']).toEqual(['switcher', 'showing']);
    expect(cornerOf(l, 'showing')).toBe('bottom-left');
  });

  it('sets and clears a sidebar gap', () => {
    expect(setRailBreak(DEFAULT_LAYOUT, 'history', false).desktop.railBreaks).toEqual(['recon']);
    expect(setRailBreak(DEFAULT_LAYOUT, 'alerts', true).desktop.railBreaks).toEqual(['history', 'recon', 'alerts']);
  });

  it('resets one form without touching the other', () => {
    const both = setShown(setShown(DEFAULT_LAYOUT, 'desktop', 'statusbar', false), 'phone', 'logo', false);
    const reset = resetForm(both, 'desktop');
    expect(isDefault(reset, 'desktop')).toBe(true);
    expect(isShown(reset, 'phone', 'logo')).toBe(false);
  });
});

describe('placed by hand', () => {
  const spot = { anchor: 'bottom-left' as const, x: 300, y: 40 };

  it('keeps a valid spot and drops a broken one', () => {
    const l = normalize({ desktop: { free: { showing: spot, search: { anchor: 'middle', x: 1, y: 1 }, scale: { anchor: 'top-left', x: 'a', y: 2 }, nope: spot } } });
    expect(l.desktop.free).toEqual({ showing: spot });
    expect(normalize({ desktop: { free: { showing: { ...spot, x: -50, y: 1e9 } } } }).desktop.free.showing).toEqual({ ...spot, x: 0, y: 4000 });
  });

  it('lets only a middle take a side', () => {
    expect(normalize({ desktop: { free: { showing: { anchor: 'top', x: -200, y: -5 } } } }).desktop.free.showing).toEqual({ anchor: 'top', x: -200, y: 0 });
  });

  it('reads a spot saved with only a corner', () => {
    expect(normalize({ desktop: { free: { showing: { corner: 'top-right', x: 20, y: 30 } } } }).desktop.free.showing).toEqual({ anchor: 'top-right', x: 20, y: 30 });
  });

  it('opens a placed piece’s menus toward the middle, and a corner pick puts it back in a stack', () => {
    const placed = placeFreely(DEFAULT_LAYOUT, 'showing', spot);
    expect(menuCornerOf(placed, 'showing')).toBe('bottom-left');
    expect(menuCornerOf(placeFreely(DEFAULT_LAYOUT, 'showing', { anchor: 'right', x: 12, y: 0 }), 'showing')).toBe('top-right');
    expect(menuCornerOf(placed, 'search')).toBe('top-left');
    const back = moveToCorner(placed, 'showing', 'top-right');
    expect(back.desktop.free).toEqual({});
    expect(back.desktop.corners['top-right']).toEqual(['showing']);
  });

  it('puts everything back in its corner', () => {
    const placed = placeFreely(placeFreely(DEFAULT_LAYOUT, 'showing', spot), 'search', { anchor: 'top', x: 0, y: 12 });
    expect(isDefault(backToCorners(placed), 'desktop')).toBe(true);
  });
});
