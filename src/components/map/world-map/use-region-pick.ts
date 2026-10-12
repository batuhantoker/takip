'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { boundaryTitle, levelForZoom, resolvePick, type Boundary, type BoundaryLevel, type PickResult, type SubLevel } from '@/lib/boundaries';
import { createBoundarySession, loadCountries } from '@/lib/boundary-store';
import { measureArea, type DrawResult } from '@/lib/draw';
import type { MapRef, WorldMapProps } from './types';

interface RegionPickArgs {
  mapRef: MapRef;
  mapReady: boolean;
  active: boolean;
  onDrawComplete: WorldMapProps['onDrawComplete'];
  onDrawProgress: WorldMapProps['onDrawProgress'];
  onDrawCancel: WorldMapProps['onDrawCancel'];
}

const SRC = 'region-pick';
const CHOICES_SRC = 'region-pick-choices';
const LAYERS = ['region-pick-choices-line', 'region-pick-fill', 'region-pick-line'];
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const COLOR = '#00E5FF';

const areas = new WeakMap<Boundary, number>();
function areaOf(b: Boundary): number {
  let a = areas.get(b);
  if (a === undefined) {
    a = measureArea(b.geometry).areaKm2;
    areas.set(b, a);
  }
  return a;
}

/**
 * Region mode: hovering highlights the country under the cursor, or the state, district or
 * sub-district as the zoom allows (see LEVELS); a click turns it into an AOI. Shift picks the whole
 * country at any zoom.
 */
export function useRegionPick({ mapRef, mapReady, active, onDrawComplete, onDrawProgress, onDrawCancel }: RegionPickArgs) {
  const cbRef = useRef({ onDrawComplete, onDrawProgress, onDrawCancel });
  useLayoutEffect(() => {
    cbRef.current = { onDrawComplete, onDrawProgress, onDrawCancel };
  });

  useEffect(() => {
    if (!mapReady || !mapRef.current || !active) return;
    const map = mapRef.current;

    let disposed = false;
    let done = false;
    let countries: Boundary[] | null = null;
    let failed = false;
    let cursor: { lng: number; lat: number } | null = null;
    let shift = false;
    let frame = 0;
    let shownId: string | null = null;
    let shownChoices = '';
    let lastEmit = '';

    const schedule = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(refresh);
    };
    const session = createBoundarySession(schedule);

    map.addSource(SRC, { type: 'geojson', data: EMPTY });
    map.addSource(CHOICES_SRC, { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'region-pick-choices-line', type: 'line', source: CHOICES_SRC, paint: { 'line-color': COLOR, 'line-width': 0.75, 'line-opacity': 0.35 } });
    map.addLayer({ id: 'region-pick-fill', type: 'fill', source: SRC, paint: { 'fill-color': COLOR, 'fill-opacity': 0.18 } });
    map.addLayer({ id: 'region-pick-line', type: 'line', source: SRC, paint: { 'line-color': COLOR, 'line-width': 2 } });
    map.getCanvas().style.cursor = 'crosshair';

    const levelNow = (wholeCountry: boolean): BoundaryLevel => (wholeCountry ? 'country' : levelForZoom(map.getZoom()));

    const show = (pick: PickResult | null) => {
      const b = pick?.boundary ?? null;
      if ((b?.id ?? null) !== shownId) {
        shownId = b?.id ?? null;
        (map.getSource(SRC) as maplibregl.GeoJSONSource | undefined)?.setData(
          b ? { type: 'Feature', properties: {}, geometry: b.geometry } : EMPTY,
        );
      }
      // Outline the neighbours at the same level, so the choices are visible before moving onto them.
      const country = pick?.parents[0];
      const siblings = b && country && b.level !== 'country' ? session.loaded(country, b.level as SubLevel) : [];
      const key = `${country?.id}|${b?.level}|${siblings.length}`;
      if (key !== shownChoices) {
        shownChoices = key;
        (map.getSource(CHOICES_SRC) as maplibregl.GeoJSONSource | undefined)?.setData({
          type: 'FeatureCollection',
          features: siblings.map(s => ({ type: 'Feature', properties: {}, geometry: s.geometry })),
        });
      }
    };

    const emit = (pick: PickResult | null) => {
      const b = pick?.boundary ?? null;
      const level = levelForZoom(map.getZoom());
      const loading = !countries ? !failed : !!pick?.loading;
      // Every mousemove would otherwise re-render the page.
      const key = `${b?.id}|${loading}|${failed}|${level}|${shift}`;
      if (key === lastEmit) return;
      lastEmit = key;
      const areaKm2 = b ? areaOf(b) : 0;
      cbRef.current.onDrawProgress?.({
        mode: 'region', vertices: 0, areaKm2, lengthKm: 0, closable: !!b,
        region: {
          level,
          wholeCountry: shift,
          hover: b && pick ? { name: boundaryTitle(b, pick.parents), areaKm2, level: b.level, source: b.source } : null,
          loading,
          failed,
        },
      });
    };

    function refresh() {
      frame = 0;
      if (disposed) return;
      const pick = countries && cursor ? resolvePick(cursor.lng, cursor.lat, levelNow(shift), countries, session.lookup) : null;
      show(pick);
      emit(pick);
    }

    loadCountries().then(
      list => { if (!disposed) { countries = list; schedule(); } },
      () => { if (!disposed) { failed = true; schedule(); } },
    );
    refresh();

    const onMove = (e: maplibregl.MapMouseEvent) => {
      cursor = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      shift = e.originalEvent.shiftKey;
      schedule();
    };

    const onOut = () => {
      cursor = null;
      schedule();
    };

    const onClick = async (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      const level = levelNow(e.originalEvent.shiftKey);
      let list: Boundary[];
      try {
        list = await loadCountries();
      } catch {
        if (!disposed) { failed = true; schedule(); }
        return;
      }
      // A click must not settle for a coarser outline just because the finer one is still on its way.
      let pick = resolvePick(lng, lat, level, list, session.lookup);
      for (let i = 0; pick.loading && i < 4 && !disposed; i++) {
        await session.settled();
        pick = resolvePick(lng, lat, level, list, session.lookup);
      }
      const b = pick.boundary;
      // Two quick clicks both resolve before the page has turned the mode off.
      if (disposed || done || !b) return;
      done = true;
      const result: DrawResult = {
        kind: 'region',
        coords: [],
        geometry: b.geometry,
        name: boundaryTitle(b, pick.parents),
        meta: {
          boundary: { level: b.level, id: b.id, countryId: b.countryId, ...(b.source ? { source: b.source } : {}) },
          ...(b.label ? { label: b.label } : {}),
        },
      };
      cbRef.current.onDrawComplete?.(result);
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && ev.type === 'keydown') {
        ev.preventDefault();
        cbRef.current.onDrawCancel?.();
      } else if (ev.key === 'Shift' && shift !== (ev.type === 'keydown')) {
        shift = ev.type === 'keydown';
        schedule();
      }
    };

    map.on('mousemove', onMove);
    map.on('mouseout', onOut);
    map.on('zoom', schedule);
    map.on('click', onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    return () => {
      disposed = true;
      session.close();
      if (frame) cancelAnimationFrame(frame);
      map.off('mousemove', onMove);
      map.off('mouseout', onOut);
      map.off('zoom', schedule);
      map.off('click', onClick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      LAYERS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      [SRC, CHOICES_SRC].forEach(id => { if (map.getSource(id)) map.removeSource(id); });
      map.getCanvas().style.cursor = '';
      cbRef.current.onDrawProgress?.(null);
    };
  }, [mapReady, active, mapRef]);
}
