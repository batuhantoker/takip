import { describe, expect, it } from 'vitest';
import { countLayersOn } from '@/components/shell/sidebar/nav-items';
import { DEFAULT_LAYERS } from '@/lib/map/layers/defaults';
import { countRows, rowsFor } from './showing-rows';
import type { ShowingState } from './showing-state';

const state =(over: Partial<ShowingState> = {}): ShowingState => ({
  mode: 'live', time: null, projected: false, ma: null, chapter: null, layers: {}, paused: 0,
  families: [], borders: null, colouring: null, arcgis: [], areas: { count: 0, color: null }, ...over,
});

const ids = (s: ShowingState) => rowsFor(s).flatMap(g => g.rows.map(r => r.id));

describe('rowsFor', () => {
  it('lists the data layers the Layers badge counts, and no display settings or ship filters', () => {
    const layers = { ...DEFAULT_LAYERS, earthquakes: true, terrain_3d: true, day_night: true };
    const groups = rowsFor(state({ layers }));
    expect(groups.map(g => g.id)).toEqual(['layers']);
    expect(countRows(groups)).toBe(countLayersOn(layers));
    expect(ids(state({ layers }))).not.toContain('layer:ships_cargo');
    expect(ids(state({ layers }))).not.toContain('layer:terrain_3d');
  });

  it('names layers as the Layers panel does, in its order', () => {
    const rows = rowsFor(state({ layers: { earthquakes: true, maritime: true, flights: true } }))[0].rows;
    expect(rows.map(r => r.label)).toEqual(['Commercial', 'Maritime / naval', 'Earthquakes']);
    expect(rows[1].off).toEqual({ kind: 'layer', key: 'maritime' });
  });

  it('puts History first: event families, then the borders with their year; today\'s sky is left out', () => {
    const s = state({
      mode: 'history', time: Date.UTC(1981, 6, 14), families: ['terror', 'conflict'], borders: 'world-borders',
      layers: { sky_stars: true, maritime: false },
    });
    const groups = rowsFor(s);
    expect(groups.map(g => g.id)).toEqual(['events', 'borders']);
    expect(groups[0].rows.map(r => r.label)).toEqual(['Wars and battles', 'Attacks']);
    expect(groups[1].rows[0]).toMatchObject({ label: 'World borders', meta: '1981', off: { kind: 'borders', code: 'world-borders' } });
    expect(countRows(groups)).toBe(3);
    expect(rowsFor(state({ layers: { sky_stars: true } }))[0].rows.map(r => r.label)).toEqual(['Stars & planets']);
  });

  it('keeps the last borders after their last year, and BCE years as such', () => {
    const at = (year: number) => {
      const d = new Date(0);
      d.setUTCFullYear(year, 5, 1);
      return rowsFor(state({ mode: 'history', time: d.getTime(), borders: 'world-borders' }))[0].rows[0].meta;
    };
    expect(at(2030)).toBe('2024');
    expect(at(-499)).toBe('500 BCE');
    expect(at(-5000)).toBeUndefined();
  });

  it('shows wartime borders and the colouring indicator', () => {
    expect(rowsFor(state({ mode: 'history', borders: 'ww2-europe' }))[0].rows[0]).toMatchObject({ label: 'World War II in Europe', meta: '1938–1945' });
    const colour = rowsFor(state({ mode: 'history', colouring: { code: 'owid:le_0', name: 'Life expectancy', ramp: ['#000', '#fff'] } }))[0];
    expect(colour).toMatchObject({ id: 'countries', rows: [{ id: 'countries:owid:le_0', label: 'Life expectancy', off: { kind: 'countries', code: 'owid:le_0' } }] });
  });

  it('has one row for deep time, which goes back to the calendar', () => {
    const groups = rowsFor(state({ mode: 'deep', ma: 250 }));
    expect(groups).toHaveLength(1);
    expect(groups[0].rows[0]).toMatchObject({ meta: 'Triassic', off: { kind: 'deep' } });
  });

  it('adds ArcGIS layers and one count row for drawn areas, which has no switch', () => {
    const groups = rowsFor(state({ arcgis: [{ id: 'a', title: 'Pipelines', color: '#D4AF37' }], areas: { count: 3, color: '#5B9CF5' } }));
    expect(groups.map(g => g.id)).toEqual(['arcgis', 'areas']);
    expect(groups[1].rows[0]).toMatchObject({ label: 'Drawn areas', value: 3 });
    expect(groups[1].rows[0].off).toBeUndefined();
  });

  it('is empty with nothing on', () => {
    expect(countRows(rowsFor(state()))).toBe(0);
    expect(countRows(rowsFor(state({ mode: 'history' })))).toBe(0);
  });
});
