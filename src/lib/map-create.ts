import * as maplibregl from 'maplibre-gl';

export function createMap(container: HTMLDivElement): maplibregl.Map | undefined {
  // Select basemap style
  const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

  maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
  /* Open on the whole globe, turned to the viewer's side of it. The UTC
     offset is a free, instant stand-in for longitude (15° an hour), so the
     fly-in to their city after the splash is a dive, not a spin round the
     planet. This used to open on Bulgaria at zoom 6.5 for everyone. */
  const facingLng = Math.max(-180, Math.min(180, -new Date().getTimezoneOffset() / 4));
  const baseOptions = {
    container,
    style: styleUrl,
    center: [facingLng, 20] as [number, number], zoom: 1.8, minZoom: 1.5, maxZoom: 18,
    /* The basemap is CARTO's, drawn from OpenStreetMap, and the places on it
       are searched and named through OpenStreetMap too. Both have to be
       credited on the map itself; this was switched off, which is half of
       what Nominatim's operators asked us to put right (issue #16). It is
       collapsed by default so it costs a corner icon, not the view. */
    attributionControl: {
      compact: true,
      // The style credits CARTO and OSM for the map; this credits OSM for the
      // search results, place names and pins that come from Nominatim.
      customAttribution: 'Geocoding © OpenStreetMap contributors',
    } as const,
    maxPitch: 85,
    transformRequest: (url: string) => {
      // Route all CARTO CDN requests through the internal Next.js proxy API
      if (url.includes('cartocdn.com')) {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return { url: `${baseUrl}/api/proxy-tiles?url=${encodeURIComponent(url)}` };
      }
      return { url };
    },
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
      console.warn('[OSIRIS] WebGL context rejected, retrying with weaker attributes:', e instanceof Error ? e.message : e);
    }
  }
  return map;
}
