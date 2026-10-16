'use client';

import { useEffect, useState } from 'react';
import { samplePoints, type ImageryArea } from '@/lib/feeds/imagery/area';
import { IMAGERS, clearestMix, groupPasses, nextPasses, type Imager, type Pass, type ScenePass } from '@/lib/feeds/imagery/passes';
import { fetchImagerElements, searchScenes, type ImagerElements, type SceneSearch } from '@/lib/feeds/imagery/scene-search';

export interface UpcomingPass extends Pass {
  imager: Imager;
}

export interface ImageryData {
  loading: boolean;
  /** Newest first. */
  passes: ScenePass[];
  /** The area from its clearest tiles of several dates, when no one pass covers it. */
  mix: ScenePass | null;
  /** Collections whose search failed. */
  failed: string[];
  truncated: SceneSearch['truncated'];
  elements: Map<string, ImagerElements>;
  /** The next overflights that could image the area: optical ones by day only. */
  upcoming: UpcomingPass[];
}

type Result = Omit<ImageryData, 'loading'> & { area: ImageryArea };

const UPCOMING = 6;
const EMPTY: ImageryData = { loading: true, passes: [], mix: null, failed: [], truncated: [], elements: new Map(), upcoming: [] };

function upcomingPasses(elements: Map<string, ImagerElements>, area: ImageryArea, now: number): UpcomingPass[] {
  const { lat, lng } = area.center;
  // A swath reaching any corner of the area counts, so widen it by the area's diagonal.
  const across = Math.hypot(area.widthKm, area.heightKm);
  return Object.values(IMAGERS).flatMap(imager => {
    const el = elements.get(imager.norad);
    if (!el) return [];
    return nextPasses(el.line1, el.line2, lat, lng, imager.swathKm + across, now)
      .filter(p => imager.kind === 'radar' || p.daylit)
      .map(p => ({ ...p, imager }));
  }).sort((a, b) => a.time - b.time).slice(0, UPCOMING);
}

/** The passes over an area, its imaging satellites' orbits, and their next passes over it. */
export function useImageryData(area: ImageryArea): ImageryData {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.allSettled([searchScenes(area, ctrl.signal), fetchImagerElements(ctrl.signal)]).then(([search, orbits]) => {
      if (ctrl.signal.aborted) return;
      const elements = orbits.status === 'fulfilled' ? orbits.value : new Map<string, ImagerElements>();
      const found = search.status === 'fulfilled' ? search.value : { scenes: [], failed: ['all'], truncated: [] };
      const samples = samplePoints(area);
      setResult({
        area,
        passes: groupPasses(found.scenes, samples),
        mix: clearestMix(found.scenes, samples),
        failed: found.failed,
        truncated: found.truncated,
        elements,
        upcoming: upcomingPasses(elements, area, Date.now()),
      });
    });
    return () => ctrl.abort();
  }, [area]);

  if (result?.area !== area) return EMPTY;
  const { passes, mix, failed, truncated, elements, upcoming } = result;
  return { loading: false, passes, mix, failed, truncated, elements, upcoming };
}
