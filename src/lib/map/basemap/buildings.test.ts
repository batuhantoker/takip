import { describe, expect, it } from 'vitest';
import { MAP_INK } from '@/lib/map/style/tokens';
import { BUILDING_DEFAULTS, buildingColor, MIN_OPACITY, sanitizeBuildingStyle } from './buildings';

describe('building looks', () => {
  it('keeps Stone grey and lets a colour look rise to its hue, then ink', () => {
    expect(buildingColor('stone', '#52C1D6')).toEqual(['interpolate-lab', ['linear'], ['get', 'render_height'], 0, MAP_INK.surface3, 150, MAP_INK.ink3]);
    const sand = buildingColor('sand', '#52C1D6');
    expect(sand).toContain(MAP_INK.sand);
    expect(sand.at(-1)).toBe(MAP_INK.ink1);
    expect(buildingColor('accent', '#52C1D6')).toContain('#52C1D6');
  });

  it('reads a stored look back safely', () => {
    expect(sanitizeBuildingStyle(null)).toEqual(BUILDING_DEFAULTS);
    expect(sanitizeBuildingStyle({ look: 'rainbow', opacity: 'x' })).toEqual(BUILDING_DEFAULTS);
    expect(sanitizeBuildingStyle({ look: 'violet', opacity: 0 })).toEqual({ look: 'violet', opacity: MIN_OPACITY });
    expect(sanitizeBuildingStyle({ look: 'accent', opacity: 4 })).toEqual({ look: 'accent', opacity: 1 });
  });
});
