/**
 * TAKIP — what the space view can centre on, and the NASA imagery its bodies wear.
 */

/**
 * Where the space camera settles: a body, or a distance from the Sun — 'solar'
 * shows the planets, 'stars' the nearest stars, 'galaxy' the Milky Way,
 * 'universe' everything out to the cosmic microwave background.
 */
export type SpaceFocus = 'earth' | 'moon' | 'mars' | 'sun' | 'solar' | 'stars' | 'galaxy' | 'universe';

/** Bodies with surface data (landing sites, orbiter ground tracks). */
export type GlobeWorldId = 'moon' | 'mars';

export function isGlobeWorld(id: string): id is GlobeWorldId {
  return id === 'moon' || id === 'mars';
}

export function isSpaceFocus(id: string): id is SpaceFocus {
  return id === 'earth' || id === 'moon' || id === 'mars' || id === 'sun' || id === 'solar' || id === 'stars' || id === 'galaxy' || id === 'universe';
}

export type TextureId = 'earth' | 'earth-night' | 'moon' | 'mars';

/**
 * A global equirectangular WMTS: tile (0, 0) has its corner at (-180°, 90°)
 * and a tile spans `level0Deg / 2^level` degrees each way.
 */
export interface EqTileSource {
  url: (level: number, row: number, col: number) => string;
  tileSize: number;
  level0Deg: number;
  /** Level for the low- and high-detail texture. */
  levels: { low: number; high: number };
}

export interface BodyTexture {
  source: EqTileSource;
  credit: string;
}

const trek = (path: string): EqTileSource => ({
  url: (l, r, c) => `https://trek.nasa.gov/tiles/${path}/1.0.0/default/default028mm/${l}/${r}/${c}.jpg`,
  tileSize: 256,
  level0Deg: 180,
  levels: { low: 2, high: 3 },
});

// GIBS' EPSG:4326 matrix is 512 px tiles of 288° at level 0, so a level overhangs the globe.
const gibs = (layer: string, time: string, ext: 'jpeg' | 'png'): EqTileSource => ({
  url: (l, r, c) => `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layer}/default/${time}/500m/${l}/${r}/${c}.${ext}`,
  tileSize: 512,
  level0Deg: 288,
  levels: { low: 2, high: 3 },
});

export const TEXTURES: Record<TextureId, BodyTexture> = {
  earth: { source: gibs('BlueMarble_NextGeneration', '2004-08', 'jpeg'), credit: 'NASA Blue Marble Next Generation via NASA GIBS' },
  'earth-night': { source: gibs('VIIRS_Black_Marble', '2016-01-01', 'png'), credit: 'NASA Black Marble (VIIRS) via NASA GIBS' },
  moon: { source: trek('Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02'), credit: 'NASA/GSFC/Arizona State University · LRO WAC via NASA Moon Trek' },
  mars: { source: trek('Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m'), credit: 'NASA/JPL/USGS · Viking MDIM 2.1 via NASA Mars Trek' },
};

export function isTextureId(id: string): id is TextureId {
  return id in TEXTURES;
}
