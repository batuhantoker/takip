import { describe, expect, it } from 'vitest';
import type { ShowingState } from './showing-state';
import { listOf, summaryFor } from './showing-summary';

const state = (over: Partial<ShowingState> = {}): ShowingState => ({
  mode: 'live', time: null, projected: false, ma: null, chapter: null, layers: {}, paused: 0,
  families: [], borders: null, colouring: null, arcgis: [], areas: { count: 0, color: null }, ...over,
});

describe('listOf', () => {
  it('joins with commas and a last "and"', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b'])).toBe('a and b');
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('summaryFor', () => {
  it('says Live and names what is drawn as a person would, keeping acronyms', () => {
    const s = summaryFor(state({ layers: { maritime: true, cctv: true, earthquakes: true } }));
    expect(s).toEqual({ title: 'Live', body: 'Ships, earthquakes and CCTV cameras.' });
  });

  it('counts the layers past three, then ArcGIS layers and drawn areas', () => {
    const layers = { flights: true, private: true, jets: true, military: true, maritime: true };
    const s = summaryFor(state({ layers, arcgis: [{ id: 'a', title: 'Pipelines', color: '#fff' }], areas: { count: 2, color: null } }));
    expect(s.body).toBe('Commercial flights, private flights, private jets, 2 more layers, 1 ArcGIS layer and 2 drawn areas.');
  });

  it('teaches the next step with nothing on', () => {
    expect(summaryFor(state()).body).toBe('Nothing on the map yet. Turn layers on in Layers.');
  });

  it('dates History and says what the past shows', () => {
    const s = summaryFor(state({ mode: 'history', time: Date.UTC(1981, 6, 14), borders: 'world-borders', families: ['terror', 'conflict'] }));
    expect(s).toEqual({ title: 'History · 14 July 1981', body: 'World borders of 1981, with wars and battles and attacks around that date.' });
  });

  it('notes live layers History has paused, and projected values', () => {
    const s = summaryFor(state({ mode: 'history', time: Date.UTC(2050, 0, 1), projected: true, colouring: { code: 'wpp:TPopulation1July', name: 'Population, since 1950', ramp: [] }, paused: 3 }));
    expect(s.title).toBe('History · 1 January 2050 · projected');
    expect(s.body).toBe('Countries coloured by population, since 1950. Your 3 live layers are paused until you go back to live.');
  });

  it('names events alone, wartime borders, and an empty past', () => {
    expect(summaryFor(state({ mode: 'history', time: 0, families: ['nuclear'] })).body).toBe('Nuclear explosions around that date.');
    expect(summaryFor(state({ mode: 'history', time: 0, borders: 'ww2-europe' })).body).toBe('World War II in Europe borders.');
    expect(summaryFor(state({ mode: 'history', time: 0 })).body).toBe('Nothing from the past is on yet. Turn on events or borders in History.');
  });

  it('gives BCE dates and years', () => {
    const d = new Date(0);
    d.setUTCFullYear(-499, 5, 1);
    const s = summaryFor(state({ mode: 'history', time: d.getTime(), borders: 'world-borders' }));
    expect(s.title).toBe('History · 500 BCE');
    expect(s.body).toBe('World borders of 500 BCE.');
  });

  it('describes deep time by age and period', () => {
    expect(summaryFor(state({ mode: 'deep', ma: 250 }))).toEqual({
      title: 'Deep time · 250 million years ago', body: 'The continents as they stood in the Triassic.',
    });
    expect(summaryFor(state({ mode: 'deep', ma: 66, chapter: 'The asteroid' })).body).toBe('The asteroid. The continents as they stood in the Paleogene.');
  });

  it('gives Replay its time in UTC', () => {
    // The map is given only what Replay recorded; earthquakes wait for LIVE.
    const s = summaryFor(state({ mode: 'replay', time: Date.UTC(2026, 9, 15, 14, 32, 9), layers: { maritime: true, satellites: true }, paused: 1 }));
    expect(s.title).toBe('Replay · 15 Oct 2026, 14:32 UTC');
    expect(s.body).toBe('Ships and all satellites as recorded. Your 1 live layer is paused until you go back to live.');
    expect(summaryFor(state({ mode: 'replay', time: 0 })).body).toBe('Nothing on the map. Turn on ships or aircraft in Layers to replay them.');
  });
});
