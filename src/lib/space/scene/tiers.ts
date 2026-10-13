import { AU_KM, LY_KM } from '@/lib/space/astro';

/**
 * How visible each layer is at a camera distance from the Sun. Everything
 * hands over in log space, so the wheel crosses from the planets to the
 * galaxy without a cut.
 */

/** 0 at `from` km, 1 at `to` km (either order), eased, in log space. */
export function ramp(km: number, from: number, to: number): number {
  const t = (Math.log10(Math.max(km, 1)) - Math.log10(from)) / (Math.log10(to) - Math.log10(from));
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

const AU = AU_KM, LY = LY_KM;

export interface TierFades {
  /** Planet orbits and the Sun's glow, across the solar system. */
  planets: number;
  craft: number;
  /** Dwarf planets and the interstellar visitors' paths. */
  outer: number;
  belt: number;
  heliosphere: number;
  oort: number;
  /** The flat bright-star sky; the 3D stars take over from it once loaded. */
  backdrop: number;
  stars: number;
  /** Brightness every star keeps once the camera is out among them. */
  starFloor: number;
  figures: number;
  milkyWaySky: number;
  disc: number;
  localGroup: number;
  /** 2MASS galaxies, SDSS galaxies and quasars, the cosmic microwave background. */
  localGalaxies: number;
  deepGalaxies: number;
  cmb: number;
}

export function tierFades(sunKm: number, starsLoaded: boolean): TierFades {
  const starsIn = starsLoaded ? ramp(sunKm, 2_000 * AU, 10_000 * AU) : 0;
  return {
    planets: ramp(sunKm, 1e13, 1e12),
    craft: ramp(sunKm, 1e12, 3e11),
    outer: ramp(sunKm, 0.6 * LY, 0.1 * LY),
    belt: ramp(sunKm, 12 * AU, 35 * AU) * ramp(sunKm, LY, 0.2 * LY),
    heliosphere: ramp(sunKm, 25 * AU, 60 * AU) * ramp(sunKm, 0.3 * LY, 0.08 * LY),
    oort: ramp(sunKm, 800 * AU, 4_000 * AU) * ramp(sunKm, 20 * LY, 4 * LY),
    backdrop: 1 - starsIn,
    stars: starsIn * ramp(sunKm, 40_000 * LY, 8_000 * LY),
    starFloor: 0.1 * ramp(sunKm, 0.05 * LY, LY),
    figures: starsIn * ramp(sunKm, 2_000 * LY, 400 * LY),
    milkyWaySky: ramp(sunKm, 30 * AU, 120 * AU) * ramp(sunKm, 3_000 * LY, 400 * LY),
    disc: ramp(sunKm, 1_500 * LY, 10_000 * LY) * ramp(sunKm, 50e6 * LY, 5e6 * LY),
    localGroup: ramp(sunKm, 1_500 * LY, 8_000 * LY) * ramp(sunKm, 400e6 * LY, 40e6 * LY),
    localGalaxies: ramp(sunKm, 3e6 * LY, 25e6 * LY),
    deepGalaxies: ramp(sunKm, 150e6 * LY, 1.2e9 * LY),
    cmb: ramp(sunKm, 3e9 * LY, 15e9 * LY),
  };
}
