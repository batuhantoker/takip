import { describe, expect, it } from 'vitest';
import { chaseCentre } from './chase';

const view = { zoom: 5.5, pitch: 60, bearing: 0, fovDeg: 36.87, heightPx: 900 };
const RAD = Math.PI / 180;
const unit = (lng: number, lat: number) => [Math.cos(lat * RAD) * Math.cos(lng * RAD), Math.cos(lat * RAD) * Math.sin(lng * RAD), Math.sin(lat * RAD)];

describe('chaseCentre', () => {
  it('is the point under the satellite when looking straight down', () => {
    const [lng, lat] = chaseCentre(20, 20, 720_000, { ...view, pitch: 0 });
    expect(lng).toBeCloseTo(20, 9);
    expect(lat).toBeCloseTo(20, 9);
  });

  it('lies ahead of the satellite along the bearing when tilted, further the higher it is drawn', () => {
    const north = chaseCentre(20, 20, 720_000, view);
    expect(north[0]).toBeCloseTo(20, 6);
    expect(north[1]).toBeGreaterThan(20);
    const east = chaseCentre(20, 20, 720_000, { ...view, bearing: 90 });
    expect(east[0]).toBeGreaterThan(20);
    expect(chaseCentre(20, 20, 2_000_000, view)[1]).toBeGreaterThan(north[1]);
  });

  it('puts the satellite on the camera\'s line of sight to the centre', () => {
    const elevM = 720_000;
    const [lng, lat] = chaseCentre(20, 20, elevM, view);
    // Rebuild the camera the way MapLibre does: d globe radii back from the centre, tilted by the pitch, toward the bearing's opposite.
    const radiusPx = (512 * 2 ** view.zoom) / (2 * Math.PI) / Math.cos(lat * RAD);
    const d = ((0.5 / Math.tan((view.fovDeg * RAD) / 2)) * view.heightPx) / radiusPx;
    const up = unit(lng, lat);
    const north = [-Math.sin(lat * RAD) * Math.cos(lng * RAD), -Math.sin(lat * RAD) * Math.sin(lng * RAD), Math.cos(lat * RAD)];
    const p = view.pitch * RAD;
    const camera = up.map((u, i) => u * (1 + d * Math.cos(p)) - north[i] * d * Math.sin(p));
    const sat = unit(20, 20).map(v => v * (1 + elevM / 6371008.8));
    const toCentre = up.map((u, i) => u - camera[i]);
    const toSat = sat.map((s, i) => s - camera[i]);
    const cos = toCentre.reduce((s, v, i) => s + v * toSat[i], 0) / (Math.hypot(...toCentre) * Math.hypot(...toSat));
    expect(Math.acos(Math.min(1, cos)) / RAD).toBeLessThan(0.01);
  });
});
