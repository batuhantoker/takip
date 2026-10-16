import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VesselRegistry, readRegistry, registryPath, writeRegistry } from './vessel-registry';

const DAY = 24 * 60 * 60_000;
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'takip-ais-'));
});

afterEach(async () => {
  delete process.env.TAKIP_AIS_REGISTRY;
  await rm(directory, { recursive: true, force: true });
});

describe('VesselRegistry', () => {
  it('round-trips through disk, creating the directory', async () => {
    const path = join(directory, 'nested', 'ais-vessels.json');
    const saved = new VesselRegistry();
    saved.remember(244780873, 70, 1_000);
    saved.remember(219750000, 84, 2_000);
    await writeRegistry(path, saved, 3_000);
    expect(saved.dirty).toBe(false);

    const restored = new VesselRegistry();
    restored.load(await readRegistry(path), 3_000);
    expect(restored.code(244780873)).toBe(70);
    expect(restored.code(219750000)).toBe(84);
  });

  it('forgets a vessel not heard from in 30 days', () => {
    const registry = new VesselRegistry();
    registry.load([[1, 70, 0], [2, 84, 29 * DAY]], 31 * DAY);
    expect(registry.code(1)).toBeUndefined();
    expect(registry.code(2)).toBe(84);
  });

  it('keeps a fresher code over an older one restored from disk', () => {
    const registry = new VesselRegistry();
    registry.remember(1, 84, 2_000);
    registry.load([[1, 70, 1_000]], 3_000);
    expect(registry.code(1)).toBe(84);
  });

  it('starts empty from a missing or foreign file', async () => {
    expect(await readRegistry(join(directory, 'absent.json'))).toEqual([]);
    const foreign = join(directory, 'foreign.json');
    await writeFile(foreign, JSON.stringify({ version: 99, vessels: [[1, 70, 0]] }));
    expect(await readRegistry(foreign)).toEqual([]);
  });

  it('saves under .cache unless told otherwise', () => {
    expect(registryPath()).toMatch(/\.cache[\\/]ais-vessels\.json$/);
    process.env.TAKIP_AIS_REGISTRY = 'off';
    expect(registryPath()).toBeNull();
  });
});
