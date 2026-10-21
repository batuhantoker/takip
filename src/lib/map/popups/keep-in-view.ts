import type * as maplibregl from 'maplibre-gl';

/** What a phone's fixed chrome covers (globals.css): the header, and Map / Space over the bottom bar or timeline. */
function clearance() {
  const css = getComputedStyle(document.documentElement);
  const px = (name: string, fallback: number) => parseFloat(css.getPropertyValue(name)) || fallback;
  return { top: px('--header-clear', 64), bottom: px('--shell-bottom', 56) + px('--switcher-clear', 58) };
}

/**
 * Pans the map to keep a popup between a phone's header and Map / Space as what loads into it makes it grow.
 * Never mid-flight, which a pan would cut short: it waits for the move to end. Returns the way to stop.
 */
export function keepPopupInView(map: maplibregl.Map, popup: maplibregl.Popup): () => void {
  const fit = () => {
    const box = popup.getElement().getBoundingClientRect();
    const frame = map.getContainer().getBoundingClientRect();
    const clear = clearance();
    const over = frame.top + clear.top - box.top;
    const under = box.bottom - (frame.bottom - clear.bottom);
    const dy = over > 0 ? -over : Math.max(0, Math.min(under, -over));
    if (Math.abs(dy) > 1) map.panBy([0, dy], { duration: 200 });
  };
  let waiting = false;
  const settled = () => {
    waiting = false;
    fit();
  };
  const sizes = new ResizeObserver(() => {
    if (!map.isMoving()) fit();
    else if (!waiting) {
      waiting = true;
      map.once('moveend', settled);
    }
  });
  sizes.observe(popup.getElement());
  return () => {
    sizes.disconnect();
    map.off('moveend', settled);
  };
}
