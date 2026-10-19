import { describe, expect, it } from 'vitest';
import { spotFromBox, spotStyle } from './spot';

const area = { left: 72, top: 0, right: 1280, bottom: 872 };

describe('spotFromBox', () => {
  it('hangs a piece from its nearest corner, measured in from that corner’s edges', () => {
    expect(spotFromBox({ left: 84, top: 12, right: 504, bottom: 50 }, area)).toEqual({ corner: 'top-left', x: 12, y: 12 });
    expect(spotFromBox({ left: 1100, top: 700, right: 1240, bottom: 760 }, area)).toEqual({ corner: 'bottom-right', x: 40, y: 112 });
    expect(spotFromBox({ left: 900, top: 20, right: 1000, bottom: 60 }, area).corner).toBe('top-right');
    expect(spotFromBox({ left: 100, top: 800, right: 200, bottom: 840 }, area).corner).toBe('bottom-left');
  });

  it('keeps a piece dragged past the edge inside the map', () => {
    expect(spotFromBox({ left: 1250, top: -40, right: 1350, bottom: 0 }, area)).toEqual({ corner: 'top-right', x: 0, y: 0 });
    expect(spotFromBox({ left: 0, top: 860, right: 100, bottom: 900 }, area)).toEqual({ corner: 'bottom-left', x: 0, y: 0 });
  });
});

describe('spotStyle', () => {
  it('measures left and bottom from the panel and the status bar, as the corners do', () => {
    expect(spotStyle({ corner: 'top-left', x: 12, y: 30 })).toEqual({ left: 'calc(var(--shell-left, 0px) + 12px)', top: 30 });
    expect(spotStyle({ corner: 'bottom-right', x: 40, y: 8 })).toEqual({ right: 40, bottom: 'calc(var(--shell-bottom, var(--shell-foot, 28px)) + 8px)' });
  });
});
