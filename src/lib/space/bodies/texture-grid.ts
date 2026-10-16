/**
 * TAKIP — which tiles of an equirectangular WMTS level make one whole-globe
 * texture, and how large that texture is before any resize.
 */

import type { EqTileSource } from '../worlds';

export interface TextureGrid {
  cols: number;
  rows: number;
  /** Pixels spanning 360° and 180° — the crop, since tiles can overhang the globe. */
  width: number;
  height: number;
}

export function textureGrid(source: EqTileSource, level: number): TextureGrid {
  const tileDeg = source.level0Deg / 2 ** level;
  const degPerPx = tileDeg / source.tileSize;
  return {
    cols: Math.ceil(360 / tileDeg - 1e-9),
    rows: Math.ceil(180 / tileDeg - 1e-9),
    width: Math.round(360 / degPerPx),
    height: Math.round(180 / degPerPx),
  };
}
