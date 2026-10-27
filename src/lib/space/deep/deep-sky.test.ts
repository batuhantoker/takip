import { describe, expect, it } from 'vitest';
import { LY_KM, norm, sub } from '../astro';
import { DEEP_SKY, DEEP_SKY_PLACED, deepSkyImage, pixelOffset, placement, skyToPixel } from './deep-sky';
import { DEEP_SKY_IMAGES } from './deep-sky.generated';
import { NEARBY_GALAXIES } from './features';

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('deep-sky pictures', () => {
  it('has a picture for every object and an object for every picture', () => {
    expect(DEEP_SKY.filter(o => !deepSkyImage(o.id)).map(o => o.id)).toEqual([]);
    expect(Object.keys(DEEP_SKY_IMAGES).filter(id => !DEEP_SKY.some(o => o.id === id))).toEqual([]);
  });

  it('joins Local Group pictures to galaxies that exist', () => {
    for (const o of DEEP_SKY.filter(x => x.feature)) expect(NEARBY_GALAXIES.some(g => g.id === o.feature)).toBe(true);
  });

  // Centroids measured on public/data/sky/deep/pleiades.jpg; SIMBAD J2000 positions. Catches a flipped or turned picture.
  it('lands the Pleiades on their stars', () => {
    const img = deepSkyImage('pleiades')!;
    const stars: [string, number, number, number, number][] = [
      ['Alcyone', 56.8711, 24.1051, 811.5, 213.7], ['Merope', 56.5816, 23.9484, 587.6, 580.2],
      ['Maia', 56.4566, 24.3678, 1170.5, 746.5], ['Taygeta', 56.3021, 24.4672, 1307.2, 945.1],
    ];
    for (const [, ra, dec, x, y] of stars) {
      const [px, py] = skyToPixel(img, ra, dec);
      expect(Math.hypot(px - x, py - y)).toBeLessThan(6);
    }
  });

  it('inverts its own projection', () => {
    const img = deepSkyImage('whirlpool-galaxy')!;
    const r = Math.PI / 180, ra = 202.4696 * r, dec = 47.1952 * r, a0 = img.ra * r, d0 = img.dec * r;
    const den = Math.sin(dec) * Math.sin(d0) + Math.cos(dec) * Math.cos(d0) * Math.cos(ra - a0);
    const o = pixelOffset(img, ...skyToPixel(img, 202.4696, 47.1952));
    expect(o.east).toBeCloseTo(Math.cos(dec) * Math.sin(ra - a0) / den, 9);
    expect(o.north).toBeCloseTo((Math.sin(dec) * Math.cos(d0) - Math.cos(dec) * Math.sin(d0) * Math.cos(ra - a0)) / den, 9);
  });

  it('hangs each picture square to the line of sight at its distance', () => {
    for (const { object, image, place } of DEEP_SKY_PLACED) {
      const { corners, centre, normal } = place;
      expect(Math.abs(dot(sub(corners[0], centre), normal)) / place.widthKm).toBeLessThan(1e-6);
      expect(dot(centre, normal) / (object.ly * LY_KM)).toBeCloseTo(1, 6);
      expect(norm(sub(corners[1], corners[0])) / (image.width * image.arcsecPerPx / 206_264.8 * object.ly * LY_KM)).toBeCloseTo(1, 4);
    }
  });

  it('turns each picture as it lies on the sky', () => {
    for (const id of ['pleiades', 'whirlpool-galaxy', 'cosmic-cliffs']) {
      const img = deepSkyImage(id)!;
      const p = placement(img, 1_000);
      const up = sub(p.corners[0], p.corners[3]);
      // The same picture with north straight up gives the sky's up at that spot.
      const n = placement({ ...img, northLeftDeg: 0 }, 1_000);
      const upNorth = sub(n.corners[0], n.corners[3]);
      expect(dot(up, upNorth) / (norm(up) * norm(upNorth))).toBeCloseTo(Math.cos(img.northLeftDeg * Math.PI / 180), 6);
    }
  });
});
