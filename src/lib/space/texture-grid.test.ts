import { describe, expect, it } from 'vitest';
import { textureGrid } from './texture-grid';
import { TEXTURES } from './worlds';

describe('textureGrid', () => {
  it('covers a Trek level exactly', () => {
    expect(textureGrid(TEXTURES.moon.source, 2)).toEqual({ cols: 8, rows: 4, width: 2048, height: 1024 });
    expect(textureGrid(TEXTURES.mars.source, 3)).toEqual({ cols: 16, rows: 8, width: 4096, height: 2048 });
  });

  it('crops the overhang of GIBS’ 288° matrix', () => {
    expect(textureGrid(TEXTURES.earth.source, 2)).toEqual({ cols: 5, rows: 3, width: 2560, height: 1280 });
    expect(textureGrid(TEXTURES.earth.source, 3)).toEqual({ cols: 10, rows: 5, width: 5120, height: 2560 });
  });
});
