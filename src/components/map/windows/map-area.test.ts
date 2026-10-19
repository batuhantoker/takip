import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAP } from '@/components/map/windows/lib/geometry';
import { getArea } from './map-area';

const W = 1280, H = 800;
type Box = { top: number; bottom: number; height: number };
let corners: Record<string, Box | undefined>;
let rootVars: Record<string, string>;
let free: (Box & { right: number })[];

const box = (top: number, height: number): Box => ({ top, bottom: top + height, height });

beforeEach(() => {
  corners = {};
  rootVars = {};
  free = [];
  const main = { vars: { '--shell-left': '72px' } };
  const root = { vars: rootVars };
  vi.stubGlobal('window', { innerWidth: W, innerHeight: H });
  vi.stubGlobal('getComputedStyle', (el: { vars: Record<string, string> }) => ({ getPropertyValue: (name: string) => el.vars[name] ?? '' }));
  vi.stubGlobal('document', {
    documentElement: root,
    querySelectorAll: (selector: string) => (selector === '[data-free]' ? free.map(r => ({ getBoundingClientRect: () => r })) : []),
    querySelector: (selector: string) => {
      if (selector === 'main') return main;
      const corner = /data-corner="([a-z-]+)"/.exec(selector)?.[1];
      const r = corner ? corners[corner] : undefined;
      return r ? { getBoundingClientRect: () => r } : null;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('map area', () => {
  it('runs the window column from under the top-right corner to above the bottom-right one', () => {
    corners['top-right'] = box(12, 38);
    corners['bottom-right'] = box(600, 160);
    expect(getArea()).toMatchObject({ left: 72, bottom: H - 28, colTop: 50 + GAP, colBottom: 600 - GAP, colRight: W - 12 });
  });

  it('uses the whole height when the right-hand corners are empty', () => {
    corners['top-right'] = box(12, 0);
    expect(getArea()).toMatchObject({ colTop: 12, colBottom: H - 28 - GAP });
  });

  it('takes a hidden status bar’s 0 px as 0, not as the default', () => {
    rootVars['--shell-foot'] = '0px';
    expect(getArea().bottom).toBe(H);
  });

  it('keeps the column clear of a piece placed by hand near the right edge, but not of one far from it', () => {
    free.push({ ...box(100, 40), right: W - 20 }, { ...box(650, 60), right: W - 100 }, { ...box(300, 40), right: 400 });
    expect(getArea()).toMatchObject({ colTop: 140 + GAP, colBottom: 650 - GAP });
  });

  it('lets a timeline’s height win over the status bar', () => {
    rootVars['--shell-foot'] = '28px';
    rootVars['--shell-bottom'] = '68px';
    expect(getArea().bottom).toBe(H - 68);
  });
});
