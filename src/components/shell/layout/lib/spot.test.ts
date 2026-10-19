import { describe, expect, it } from 'vitest';
import { boxAt, presetSpot, snapTo, spotFromBox, spotStyle } from './spot';

// 1208 × 872 after a 72 px sidebar and a 28 px status bar.
const area = { left: 72, top: 0, right: 1280, bottom: 872 };
const sized = (left: number, top: number, w = 100, h = 40) => ({ left, top, right: left + w, bottom: top + h });

describe('spotFromBox', () => {
  it('hangs a piece from the third of the map its middle is in', () => {
    expect(spotFromBox(sized(84, 12, 420, 38), area)).toEqual({ anchor: 'top-left', x: 12, y: 12 });
    expect(spotFromBox(sized(1140, 700, 100, 60), area)).toEqual({ anchor: 'bottom-right', x: 40, y: 112 });
    expect(spotFromBox(sized(626, 20), area)).toEqual({ anchor: 'top', x: 0, y: 20 });
    expect(spotFromBox(sized(700, 450), area)).toEqual({ anchor: 'center', x: 74, y: 34 });
    expect(spotFromBox(sized(100, 400), area).anchor).toBe('left');
  });

  it('keeps a piece dragged past the edge inside the map', () => {
    expect(spotFromBox(sized(1250, -40), area)).toEqual({ anchor: 'top-right', x: 0, y: 0 });
    expect(spotFromBox(sized(0, 860), area)).toEqual({ anchor: 'bottom-left', x: 0, y: 0 });
  });

  it('is the inverse of boxAt', () => {
    for (const box of [sized(300, 300), sized(1000, 50), sized(640, 780), sized(90, 820)]) {
      expect(boxAt(spotFromBox(box, area), 100, 40, area)).toEqual(box);
    }
  });
});

describe('snapTo', () => {
  it('takes the nearest preset place within reach', () => {
    const middleTop = boxAt(presetSpot('top'), 100, 40, area);
    expect(snapTo(sized(middleTop.left + 20, middleTop.top + 15), area)).toEqual({ anchor: 'top', x: 0, y: 12 });
    expect(snapTo(sized(area.right - 112 - 10, area.bottom - 52 + 10), area)).toEqual({ anchor: 'bottom-right', x: 12, y: 12 });
  });

  it('leaves a piece far from every preset where it is', () => {
    expect(snapTo(sized(300, 300), area)).toBeNull();
  });
});

describe('spotStyle', () => {
  it('measures left and bottom from the panel and the status bar, as the corners do', () => {
    expect(spotStyle({ anchor: 'top-left', x: 12, y: 30 })).toEqual({ left: 'calc(var(--shell-left, 0px) + 12px)', top: 30 });
    expect(spotStyle({ anchor: 'bottom-right', x: 40, y: 8 })).toEqual({ right: 40, bottom: 'calc(var(--shell-bottom, var(--shell-foot, 28px)) + 8px)' });
  });

  it('centres a piece on a middle', () => {
    expect(spotStyle({ anchor: 'top', x: -10, y: 12 })).toEqual({
      left: 'calc(var(--shell-left, 0px) + (100% - var(--shell-left, 0px)) / 2 + -10px)', top: 12, transform: 'translate(-50%, 0)',
    });
    expect(spotStyle({ anchor: 'center', x: 0, y: 0 }).transform).toBe('translate(-50%, -50%)');
    expect(spotStyle({ anchor: 'right', x: 12, y: 5 })).toMatchObject({ right: 12, transform: 'translate(0, -50%)' });
  });
});
