'use client';

import { useMemo, useState } from 'react';
import { LoaderCircle, Satellite } from 'lucide-react';
import { cx, ENTER } from '@/components/ui/class-names';
import { Panel } from '@/components/ui/panel';
import { Segmented } from '@/components/ui/segmented';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { FloatingWindow, WindowFoldButton } from '@/components/map/windows';
import { KINDS } from '@/components/map/windows/kinds';
import { usePlaceName } from '@/components/map/inspect/use-place-name';
import type { MapRef } from '@/components/map/types';
import type { AreaGeometry } from '@/lib/places/areas/aoi';
import { MAX_AREA_KM, areaAround, areaLabel, areaOfBox, areaOfShape, type Bbox, type ImageryArea } from '@/lib/feeds/imagery/area';
import { SEARCH_DAYS } from '@/lib/feeds/imagery/scene-search';
import { useImageryData } from './hooks/use-imagery-data';
import { IMAGERY_CREDIT, useImageryOverlay } from './hooks/use-imagery-overlay';
import { useSaveImage } from './hooks/use-save-image';
import { shortDate } from './lib/format';
import { NextPasses } from './parts/next-passes';
import { SceneList } from './parts/scene-list';

/** A right-clicked point, or a shape from the Areas tool. */
export type ImageryTarget = { lat: number; lng: number } | { shape: AreaGeometry; name: string };

type Scope = '10' | '50' | '200' | 'view';
const SCOPES: { value: Scope; label: string }[] = [
  { value: '10', label: '10 km' }, { value: '50', label: '50 km' }, { value: '200', label: '200 km' }, { value: 'view', label: 'Map view' },
];

const COLLECTION_NAME: Record<string, string> = {
  'sentinel-2-l2a': 'Sentinel-2', 'sentinel-1-rtc': 'Sentinel-1', 'landsat-c2-l2': 'Landsat', all: 'the image catalogue',
};

function mapBox(mapRef: MapRef): Bbox | null {
  const b = mapRef.current?.getBounds();
  return b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : null;
}

/** Frame the area unless it is already in view at a useful size. */
function frame(mapRef: MapRef, [w, s, e, n]: Bbox, rightInset: number) {
  const map = mapRef.current, view = mapBox(mapRef);
  if (!map || !view) return;
  const inView = w >= view[0] && e <= view[2] && s >= view[1] && n <= view[3];
  // A 10 m image says nothing when the area is a speck on the screen.
  if (inView && view[2] - view[0] < 4 * (e - w)) return;
  map.fitBounds([[w, s], [e, n]], { padding: { top: 60, bottom: 60, left: 60, right: 60 + rightInset }, maxZoom: 14, duration: 1200 });
}

/**
 * The satellite images of an area, opened from the map's right-click or the Areas tool: when each
 * imaging satellite next flies over, the recent passes to draw on the map or save as one image, and
 * where the picked pass's satellite is now.
 */
export function SatelliteImages({ target, mapRef, onClose }: { target: ImageryTarget; mapRef: MapRef; onClose: () => void }) {
  const [scope, setScope] = useState<Scope>('10');
  const [viewBox, setViewBox] = useState<Bbox | null>(null);
  const area = useMemo<ImageryArea>(() => {
    if ('shape' in target) return areaOfShape(target.shape);
    if (scope === 'view' && viewBox) return areaOfBox(viewBox);
    return areaAround(target.lat, target.lng, Number(scope === 'view' ? 10 : scope));
  }, [target, scope, viewBox]);

  const data = useImageryData(area);
  const [selected, setSelected] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const pass = (data.mix?.id === selected ? data.mix : data.passes.find(p => p.id === selected)) ?? null;
  const imager = pass && !pass.mix ? pass.lead.imager : undefined;
  useImageryOverlay(mapRef, area, pass, imager ? data.elements.get(imager.norad) : undefined, imager?.name);
  const place = usePlaceName(area.center.lat, area.center.lng);
  const name = 'shape' in target ? target.name : place?.name ?? 'this place';
  const { state: save, save: onSave } = useSaveImage(area.bbox, name);
  const isMobile = useIsMobile();
  const inset = isMobile ? 0 : KINDS.imagery.width;

  const pickScope = (next: Scope) => {
    const box = next === 'view' ? mapBox(mapRef) : null;
    setScope(next);
    setViewBox(box);
    setSelected(null);
    if (next !== 'view' && 'lat' in target) frame(mapRef, areaAround(target.lat, target.lng, Number(next)).bbox, inset);
  };

  const select = (id: string | null) => {
    setSelected(id);
    if (id) frame(mapRef, area.bbox, inset);
  };

  const panel = (
    <Panel docked={false} title="Satellite images" subtitle={`${areaLabel(area)} · ${name}`} icon={Satellite} onClose={onClose}
      className={isMobile ? 'max-h-[inherit]' : undefined} closeOnEscape={isMobile}
      actions={isMobile ? undefined : <WindowFoldButton />}
      footer={<span>{IMAGERY_CREDIT}</span>}>
      {'lat' in target && (
        <Segmented size="sm" full label="Area to search" options={SCOPES} value={scope} onChange={pickScope} className="mb-4" />
      )}
      {area.clamped && (
        <p className="mb-3 text-meta text-ink-3">
          {'shape' in target ? 'This area is' : 'The map view is'} wider than {MAX_AREA_KM} km, so this searches the {MAX_AREA_KM} km in the middle.
        </p>
      )}
      {data.loading ? (
        <div className="flex items-center gap-2 py-6 text-small text-ink-3">
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={1.75} />
          Searching the last {SEARCH_DAYS} days of passes…
        </div>
      ) : (
        <>
          <NextPasses passes={data.upcoming} now={now} />
          <SceneList passes={data.passes} mix={data.mix} days={SEARCH_DAYS} selected={selected} onSelect={select} elements={data.elements} now={now}
            save={save} onSave={onSave}
            onShowSatellite={sat => mapRef.current?.easeTo({ center: [sat.lng, sat.lat], zoom: 2.5, duration: 1600 })} />
          {data.truncated.map(t => (
            <p key={t.collection} className="mt-2 text-meta text-ink-3">
              {COLLECTION_NAME[t.collection] ?? t.collection} has more tiles here than one search returns, so its images go back only to {shortDate(t.since)}.
            </p>
          ))}
          {data.failed.length > 0 && (
            <p className="mt-2 text-meta text-ink-3">Couldn&apos;t reach {data.failed.map(c => COLLECTION_NAME[c] ?? c).join(', ')}; the list may be missing images.</p>
          )}
        </>
      )}
    </Panel>
  );
  if (!isMobile) return <FloatingWindow id="imagery" kind="imagery" label="Satellite images" onClose={onClose}>{panel}</FloatingWindow>;
  return <div className={cx('absolute top-16 right-2 left-2 z-[300]', ENTER)} style={{ maxHeight: 'min(70vh, 640px)' }}>{panel}</div>;
}
