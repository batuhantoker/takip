/** A map view's place, zoom, layers and what it follows, as a path on this site; use-startup.ts reads them back. */
export function viewPath({ lat, lng, zoom, layers, track }: {
  lat: number; lng: number; zoom: number; layers: Record<string, boolean>;
  /** `aircraft:4bb1c2`, as trackKey writes it. */
  track?: string | null;
}) {
  const params = new URLSearchParams();
  params.set('lat', lat.toFixed(4));
  params.set('lon', lng.toFixed(4));
  params.set('zoom', zoom.toFixed(2));
  params.set('layers', Object.entries(layers).filter(([, on]) => on).map(([key]) => key).join(','));
  if (track) params.set('track', track);
  return `/?${params.toString()}`;
}
