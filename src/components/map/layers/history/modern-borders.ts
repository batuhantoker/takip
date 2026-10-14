import type * as maplibregl from 'maplibre-gl';

/** Today's country names and borders would contradict a period's; they step aside while any historical borders show. */
const MODERN = ['place_country_1', 'place_country_2', 'boundary_country_outline', 'boundary_country_inner'];

const holds = new WeakMap<maplibregl.Map, { n: number; hidden: string[] }>();

/** Hides the basemap's modern borders until every holder has released; returns the release. */
export function hideModernBorders(map: maplibregl.Map): () => void {
  const h = holds.get(map) ?? { n: 0, hidden: [] };
  // Only what was visible, so it never unhides what something else (paleo, a style) turned off.
  if (h.n === 0) {
    h.hidden = MODERN.filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
    for (const id of h.hidden) map.setLayoutProperty(id, 'visibility', 'none');
  }
  h.n++;
  holds.set(map, h);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--h.n > 0) return;
    for (const id of h.hidden) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
    h.hidden = [];
  };
}
