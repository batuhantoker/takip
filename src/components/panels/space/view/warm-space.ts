import { useFleet, useSky, useSunFrames } from '@/components/panels/space/use-space-data';

/**
 * Fetches the space view ahead of opening it — its code, the planets and
 * fleet, Earth's textures — so zooming out of the map hands over without a
 * blank frame. Called once the map's globe is nearly whole.
 */
let warmed = false;

export function warmSpace() {
  if (warmed) return;
  warmed = true;
  void import('./space-shell');
  useSky.prefetch();
  useFleet.prefetch();
  useSunFrames.prefetch();
  for (const url of ['/api/space/texture/earth', '/api/space/texture/earth-night', '/data/sky/bright-stars.json']) void fetch(url).catch(() => {});
}
