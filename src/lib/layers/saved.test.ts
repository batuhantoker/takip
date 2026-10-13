import { describe, it, expect } from 'vitest';
import { parseLayers } from './saved';

const known = { flights: false, cctv: true, satellites: true };

describe('parseLayers', () => {
  it('reads what was stored', () => {
    expect(parseLayers(JSON.stringify({ flights: true, cctv: false }), known)).toEqual({ flights: true, cctv: false });
  });

  it('drops layers that no longer exist and values that are not on/off', () => {
    expect(parseLayers(JSON.stringify({ flights: true, retired_layer: true, cctv: 'yes', satellites: 1 }), known)).toEqual({ flights: true });
  });

  it('does not treat inherited properties as layers', () => {
    expect(parseLayers('{"__proto__":true,"toString":true}', known)).toEqual({});
  });

  it('returns nothing for missing or malformed storage', () => {
    expect(parseLayers(null, known)).toEqual({});
    expect(parseLayers('not json', known)).toEqual({});
    expect(parseLayers('[true]', known)).toEqual({});
    expect(parseLayers('null', known)).toEqual({});
  });
});
