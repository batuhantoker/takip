import { describe, expect, it, vi } from 'vitest';
import { createPartRegistry } from './parts';
import { registerStoredParts } from './stored-parts';
import type { TimeState, Viewport, WorkspaceStateV1 } from './state';
import { MemoryStorage } from './testing';

/** A stand-in for the page: plain variables behind get and set. */
function page() {
  const registry = createPartRegistry();
  const view = {
    layers: { ships: true, flights: false } as Record<string, boolean>,
    viewport: { lat: 41, lng: 29, zoom: 6 } as Viewport,
    time: { mode: 'live' } as TimeState,
    tool: 'layers' as string | null,
  };
  registry.register('layers', { get: () => view.layers, set: v => { view.layers = v; } });
  registry.register('viewport', { get: () => view.viewport, set: v => { view.viewport = v; } });
  registry.register('time', { get: () => view.time, set: v => { view.time = v; } });
  registry.register('tool', { get: () => view.tool, set: v => { view.tool = v; } });
  return { registry, view };
}

describe('the part registry', () => {
  it('captures the registered parts and applies them back', () => {
    const { registry, view } = page();
    const saved = registry.capture();
    expect(saved).toEqual({ v: 1, layers: { ships: true, flights: false }, viewport: { lat: 41, lng: 29, zoom: 6 }, time: { mode: 'live' }, tool: 'layers' });

    view.layers = { ships: false, flights: true };
    view.viewport = { lat: 0, lng: 0, zoom: 2 };
    view.time = { mode: 'replay', t: 1_700_000_000_000, speed: 60 };
    view.tool = null;
    expect(registry.capture()).not.toEqual(saved);

    registry.apply(saved);
    expect(registry.capture()).toEqual(saved);
    expect(view.tool).toBe('layers');
  });

  it('keeps a null tool, which means no tool open', () => {
    const { registry, view } = page();
    view.tool = null;
    const saved = registry.capture();
    expect(saved.tool).toBeNull();
    view.tool = 'draw';
    registry.apply(saved);
    expect(view.tool).toBeNull();
  });

  it('skips parts nobody registered, keeps them, and hands them over on registration', () => {
    const { registry } = page();
    const state: WorkspaceStateV1 = { v: 1, layers: { ships: false }, pins: [{ kind: 'flight', id: 'ae291a' }] };
    registry.apply(state);
    expect(registry.capture().pins).toEqual([{ kind: 'flight', id: 'ae291a' }]);

    const set = vi.fn();
    registry.register('pins', { get: () => [], set });
    expect(set).toHaveBeenCalledWith([{ kind: 'flight', id: 'ae291a' }]);
    expect(registry.capture().pins).toEqual([]);
  });

  it('leaves parts the state lacks, and the ones it is told to skip', () => {
    const { registry, view } = page();
    registry.apply({ v: 1, viewport: { lat: 10, lng: 20, zoom: 3 }, layers: { ships: false } }, { skip: ['layers'] });
    expect(view).toMatchObject({ viewport: { lat: 10, lng: 20, zoom: 3 }, layers: { ships: true, flights: false }, tool: 'layers' });
  });

  it('applies the other parts when one throws', () => {
    const { registry, view } = page();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registry.register('basemap', { get: () => undefined, set: () => { throw new Error('no map yet'); } });
    registry.apply({ v: 1, basemap: { style: 'topo' }, tool: 'draw' });
    expect(view.tool).toBe('draw');
    vi.restoreAllMocks();
  });

  it('stops using a part once it unregisters', () => {
    const registry = createPartRegistry();
    const off = registry.register('tool', { get: () => 'draw', set: () => {} });
    expect(registry.capture()).toEqual({ v: 1, tool: 'draw' });
    off();
    expect(registry.capture()).toEqual({ v: 1 });
  });

  it('tells subscribers when a part changes', () => {
    const registry = createPartRegistry();
    const listener = vi.fn();
    const off = registry.subscribe(listener);
    registry.notify();
    off();
    registry.notify();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('stored parts', () => {
  it('read and write localStorage until the page registers its own', () => {
    const storage = new MemoryStorage();
    storage.setItem('takip.layers', JSON.stringify({ maritime: true, not_a_layer: true }));
    storage.setItem('takip.markets.watchlist', JSON.stringify(['^VIX', 'bad symbol!']));
    const registry = createPartRegistry();
    registerStoredParts(registry, storage);
    expect(registry.capture()).toEqual({ v: 1, layers: { maritime: true }, watchlist: ['^VIX'] });

    registry.apply({ v: 1, watchlist: ['GC=F'], recentPlaces: [{ label: 'Kyiv', lat: 50.45, lng: 30.52, at: 1 }] });
    expect(JSON.parse(storage.getItem('takip.markets.watchlist')!)).toEqual(['GC=F']);
    expect(JSON.parse(storage.getItem('takip.recent-places')!)).toEqual([{ label: 'Kyiv', lat: 50.45, lng: 30.52, at: 1 }]);

    let layers = { flights: true };
    const off = registry.register('layers', { get: () => layers, set: v => { layers = v as typeof layers; } });
    expect(registry.capture().layers).toEqual({ flights: true });
    off();
    expect(registry.capture().layers).toEqual({ maritime: true });
  });
});
