import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CctvCamera } from '@/lib/feeds/cameras/types';

/**
 * Camera lists whose terms rule out redistribution (OpenWebcamDB, SkylineWebcams). They live outside git in
 * data/private/cameras/<name>.json, written by their scrapers and copied to the server by tools/deploy-nuc.sh.
 * Without the file, its regions are empty.
 */
export const PRIVATE_CAMERAS = process.env.TAKIP_PRIVATE_DIR
  ? join(process.env.TAKIP_PRIVATE_DIR, 'cameras')
  : join(process.cwd(), 'data', 'private', 'cameras');

const loaded = new Map<string, Record<string, CctvCamera[]>>();

export function privateCameras(name: string, group: string): CctvCamera[] {
  let lists = loaded.get(name);
  if (!lists) {
    const file = join(PRIVATE_CAMERAS, `${name}.json`);
    if (!existsSync(file)) return [];
    lists = JSON.parse(readFileSync(file, 'utf8')) as Record<string, CctvCamera[]>;
    loaded.set(name, lists);
  }
  return lists[group] ?? [];
}

export const hasPrivateCameras = (name: string) => existsSync(join(PRIVATE_CAMERAS, `${name}.json`));
