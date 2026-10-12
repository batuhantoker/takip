import { cachedSource } from '@/lib/sourceCache';
import { collectSky, type SkyState } from './collect';

// The track runs a day ahead, so a three-hour refresh never leaves the map without one.
const load = cachedSource<SkyState>('space:sky', async () => [await collectSky()], 3 * 3_600_000);

export async function loadSky(): Promise<SkyState | null> {
  const [state] = await load();
  return state ?? null;
}
