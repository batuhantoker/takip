import { describe, expect, it } from 'vitest';
import { appliesIn, MAX_RECENT, parseRecent, recentFor, step, type RecentItem, type ShownAt } from './recent';
import type { ShowingRow } from './showing-rows';

const layer = (key: string): ShowingRow => ({ id: `layer:${key}`, label: key, swatch: { kind: 'layer', key }, off: { kind: 'layer', key } });
const family = (f: string): ShowingRow => ({ id: `family:${f}`, label: f, swatch: { kind: 'mark', shape: 'dot', colors: ['#fff'] }, off: { kind: 'family', family: f } });
const arcgis = (id: string): ShowingRow => ({ id: `arcgis:${id}`, label: id, swatch: { kind: 'mark', shape: 'square', colors: ['#fff'] }, off: { kind: 'arcgis', id } });
const at = (mode: ShownAt['mode'], ...rows: ShowingRow[]): ShownAt => ({ mode, rows });
const ids = (list: RecentItem[]) => list.map(i => i.id);
const NONE = new Set<string>();

describe('step', () => {
  it('records what was switched off, newest first', () => {
    let list = step([], null, at('live', layer('flights'), layer('maritime'), layer('earthquakes')), NONE);
    expect(list).toEqual([]);
    list = step(list, at('live', layer('flights'), layer('maritime'), layer('earthquakes')), at('live', layer('maritime'), layer('earthquakes')), NONE);
    list = step(list, at('live', layer('maritime'), layer('earthquakes')), at('live', layer('maritime')), NONE);
    expect(ids(list)).toEqual(['layer:earthquakes', 'layer:flights']);
    expect(list[0]).toEqual({ id: 'layer:earthquakes', label: 'earthquakes', swatch: { kind: 'layer', key: 'earthquakes' }, off: { kind: 'layer', key: 'earthquakes' } });
  });

  it('records nothing when the mode changes, since that hides rows without switching them off', () => {
    expect(step([], at('live', layer('flights')), at('history', family('conflict')), NONE)).toEqual([]);
  });

  it('keeps the list when nothing changes', () => {
    const list: RecentItem[] = [{ id: 'layer:flights', label: 'Commercial', swatch: { kind: 'layer', key: 'flights' }, off: { kind: 'layer', key: 'flights' } }];
    expect(step(list, at('live', layer('maritime')), at('live', layer('maritime')), NONE)).toBe(list);
  });
});

describe('step with real layers', () => {
  const keys = ['flights', 'private', 'jets', 'military', 'maritime', 'earthquakes', 'fires'];
  it('caps at the newest five and drops one switched back on', () => {
    let list: RecentItem[] = [];
    let shown = at('live', ...keys.map(layer));
    for (const k of keys) {
      const next = at('live', ...shown.rows.filter(r => r.id !== `layer:${k}`));
      list = step(list, shown, next, NONE);
      shown = next;
    }
    expect(list).toHaveLength(MAX_RECENT);
    expect(ids(list)).toEqual(['layer:fires', 'layer:earthquakes', 'layer:maritime', 'layer:military', 'layer:jets']);
    list = step(list, shown, at('live', layer('maritime')), NONE);
    expect(ids(list)).toEqual(['layer:fires', 'layer:earthquakes', 'layer:military', 'layer:jets']);
    // Off again: back to the front, once.
    list = step(list, at('live', layer('maritime')), at('live'), NONE);
    expect(ids(list)).toEqual(['layer:maritime', 'layer:fires', 'layer:earthquakes', 'layer:military', 'layer:jets']);
  });

  it('forgets layers that no longer exist and ArcGIS layers since removed', () => {
    const before = at('live', layer('flights'), layer('no_such_layer'), arcgis('a'), arcgis('b'));
    const list = step([], before, at('live'), new Set(['a']));
    expect(ids(list)).toEqual(['layer:flights', 'arcgis:a']);
    expect(ids(step(list, at('live'), at('live'), NONE))).toEqual(['layer:flights']);
  });

  it('never records deep time, which is a mode rather than a selection', () => {
    const deep: ShowingRow = { id: 'deep', label: 'Moving continents', swatch: { kind: 'mark', shape: 'dot', colors: [] }, off: { kind: 'deep' } };
    expect(step([], at('deep', deep), at('deep'), NONE)).toEqual([]);
  });
});

describe('recentFor', () => {
  const list: RecentItem[] = [
    { id: 'layer:earthquakes', label: 'Earthquakes', swatch: { kind: 'layer', key: 'earthquakes' }, off: { kind: 'layer', key: 'earthquakes' } },
    { id: 'layer:maritime', label: 'Maritime', swatch: { kind: 'layer', key: 'maritime' }, off: { kind: 'layer', key: 'maritime' } },
    { id: 'layer:sky_stars', label: 'Stars', swatch: { kind: 'layer', key: 'sky_stars' }, off: { kind: 'layer', key: 'sky_stars' } },
    { id: 'family:terror', label: 'Attacks', swatch: { kind: 'mark', shape: 'dot', colors: [] }, off: { kind: 'family', family: 'terror' } },
    { id: 'borders:world-borders', label: 'World borders', swatch: { kind: 'mark', shape: 'square', colors: [] }, off: { kind: 'borders', code: 'world-borders' } },
    { id: 'countries:owid:le_0', label: 'Life expectancy', swatch: { kind: 'mark', shape: 'bar', colors: [] }, off: { kind: 'countries', code: 'owid:le_0' } },
    { id: 'arcgis:a', label: 'Pipelines', swatch: { kind: 'mark', shape: 'square', colors: [] }, off: { kind: 'arcgis', id: 'a' } },
  ];
  const shown = (mode: ShownAt['mode']) => ids(recentFor(list, mode, NONE));

  it('offers live layers in Live, History’s own items in History, and what Replay records in Replay', () => {
    expect(shown('live')).toEqual(['layer:earthquakes', 'layer:maritime', 'layer:sky_stars', 'arcgis:a']);
    // Today's sky is a backdrop in the past views, not something they show.
    expect(shown('history')).toEqual(['family:terror', 'borders:world-borders', 'countries:owid:le_0', 'arcgis:a']);
    expect(shown('replay')).toEqual(['layer:maritime', 'arcgis:a']);
    expect(shown('deep')).toEqual(['arcgis:a']);
  });

  it('leaves out rows already listed above, such as one just switched off in the open panel', () => {
    expect(ids(recentFor(list, 'live', new Set(['layer:earthquakes'])))).toEqual(['layer:maritime', 'layer:sky_stars', 'arcgis:a']);
  });

  it('agrees with appliesIn', () => {
    expect(appliesIn({ kind: 'family', family: 'terror' }, 'live')).toBe(false);
    expect(appliesIn({ kind: 'layer', key: 'earthquakes' }, 'history')).toBe(false);
  });
});

describe('parseRecent', () => {
  it('reads a stored list and ignores anything malformed', () => {
    const good = { id: 'layer:flights', label: 'Commercial', swatch: { kind: 'layer', key: 'flights' }, off: { kind: 'layer', key: 'flights' } };
    expect(parseRecent(JSON.stringify([good, { id: 3 }, { ...good, off: { kind: 'deep' } }, null]))).toEqual([good]);
    expect(parseRecent('not json')).toEqual([]);
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
  });
});
