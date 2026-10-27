import * as maplibregl from 'maplibre-gl';
import darkMatter from './basemap/dark-matter-style.json';

const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;

/** `overrides` replace the defaults below; the embed opens at its own view with cooperative gestures. */
export function createMap(container: HTMLDivElement, overrides: Partial<maplibregl.MapOptions> = {}): maplibregl.Map | undefined {
  // CARTO's Dark Matter look over OpenFreeMap tiles; CARTO's own tiles are the alternative (lib/map/basemap).
  // Bundled, not fetched: as a request it queued behind the live feeds on the origin. Each map gets its own copy.
  const style = structuredClone(darkMatter) as maplibregl.StyleSpecification;

  maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.js`);
  // Arabic and Hebrew names need shaping; the plugin loads only once such a label is on screen.
  if (maplibregl.getRTLTextPluginStatus() === 'unavailable') void maplibregl.setRTLTextPlugin('/vendor/rtl-text/mapbox-gl-rtl-text.js', true);
  /* Open on the whole globe, turned to the viewer's side of it. The UTC
     offset is a free, instant stand-in for longitude (15° an hour), so the
     fly-in to their city after the splash is a dive, not a spin round the
     planet. This used to open on Bulgaria at zoom 6.5 for everyone. */
  const facingLng = Math.max(-180, Math.min(180, -new Date().getTimezoneOffset() / 4));
  const baseOptions = {
    style,
    center: [facingLng, 20] as [number, number], zoom: 1.8, minZoom: 1.5, maxZoom: 18,
    /* The basemap is drawn from OpenStreetMap, and the places on it are searched
       and named through OpenStreetMap too. Both have to be credited on the map
       itself (issue #16): MapCredits (components/map/controls) mounts MapLibre's
       control beside the map controls, wherever the person has put those. */
    attributionControl: false as const,
    // Past about 90° the camera sinks under the flat map's plane at city zooms; 88° still draws, with a little more sky.
    maxPitch: 88,
    // CARTO forbids proxying or caching its tiles server-side and wants each customer's own key (basemap terms §3.b, §9).
    // The `key` parameter is what its key page documents; unverified for vector tiles.
    transformRequest: (url: string) => {
      if (CARTO_KEY && new URL(url, 'https://x').hostname.endsWith('cartocdn.com')) {
        return { url: `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(CARTO_KEY)}` };
      }
      return { url };
    },
    ...overrides,
    container,
  };

  // MapLibre asks for a high-performance WebGL2 context and throws outright if it
  // cannot get one. Some machines refuse that exact request while still granting a
  // plainer one, so walk down to weaker requests before giving up. The WebGL1 rung
  // this used to have cannot come back: MapLibre 6's ContextType is 'webgl2' alone,
  // so machines that only ever managed WebGL1 are now out of reach either way.
  // Dropping antialias is the last rung left for a struggling GPU.
  const attributeFallbacks: maplibregl.MapOptions['canvasContextAttributes'][] = [
    undefined,
    { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
    { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, antialias: false },
  ];

  let map: maplibregl.Map | undefined;
  for (const canvasContextAttributes of attributeFallbacks) {
    try {
      map = new maplibregl.Map(
        canvasContextAttributes ? { ...baseOptions, canvasContextAttributes } : baseOptions
      );
      break;
    } catch (e) {
      // A failed constructor leaves its canvas behind; the next attempt needs a clean container.
      container.innerHTML = '';
      if (canvasContextAttributes === attributeFallbacks[attributeFallbacks.length - 1]) throw e;
      console.warn('[TAKIP] WebGL context rejected, retrying with weaker attributes:', e instanceof Error ? e.message : e);
    }
  }
  return map;
}
