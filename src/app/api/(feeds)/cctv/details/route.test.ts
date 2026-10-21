import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './route';
import { buildPayload, clearPayload } from '@/lib/feeds/cameras/catalog/snapshot';

const camera = (id: string) => ({ id, lat: 51.5, lng: -0.1, name: `Camera ${id}`, feed_url: `https://x/${id}.jpg`, source: 'TfL' });
const ask = (ids: string[]) => GET(new Request(`http://localhost/api/cctv/details?${new URLSearchParams(ids.map(id => ['id', id]))}`));

beforeEach(() => { process.env.TAKIP_CCTV_SNAPSHOT = 'off'; });
afterEach(() => clearPayload());

describe('camera details', () => {
  it('answers with the full records it holds, ids with commas included', async () => {
    buildPayload({ cameras: [camera('a,1'), camera('b')] }, 2, true);
    const response = await ask(['a,1', 'gone', 'b']);
    expect((await response.json()).cameras).toEqual([camera('a,1'), camera('b')]);
    expect(response.headers.get('Cache-Control')).toContain('max-age=300');
  });

  it('answers for at most 100 cameras', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `c${i}`);
    buildPayload({ cameras: ids.map(camera) }, ids.length, true);
    expect((await (await ask(ids)).json()).cameras).toHaveLength(100);
  });

  it('is not cached while the catalogue is still incomplete', async () => {
    buildPayload({ cameras: [camera('a')] }, 1, false);
    expect((await ask(['a'])).headers.get('Cache-Control')).toBe('no-store');
  });
});
