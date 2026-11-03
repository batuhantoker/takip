import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async (dir: string) => {
  vi.resetModules();
  vi.stubEnv('TAKIP_PRIVATE_DIR', dir);
  return import('./private-lists');
};

describe('private camera lists', () => {
  const dirs: string[] = [];
  const tempDir = () => {
    const d = mkdtempSync(join(tmpdir(), 'takip-private-'));
    dirs.push(d);
    return d;
  };
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('gives an empty region when the file is missing', async () => {
    const lists = await load(tempDir());
    expect(lists.hasPrivateCameras('skyline')).toBe(false);
    expect(lists.privateCameras('skyline', 'asia')).toEqual([]);
  });

  it('reads a region, and picks the file up once it arrives', async () => {
    const dir = tempDir();
    const lists = await load(dir);
    expect(lists.privateCameras('skyline', 'asia')).toEqual([]);
    mkdirSync(join(dir, 'cameras'));
    const cam = { id: 'sky-1', lat: 1, lng: 2, name: 'A', city: 'B', country: 'C', source: 'S' };
    writeFileSync(join(dir, 'cameras', 'skyline.json'), JSON.stringify({ asia: [cam] }));
    expect(lists.privateCameras('skyline', 'asia')).toEqual([cam]);
    expect(lists.privateCameras('skyline', 'europe')).toEqual([]);
  });
});
