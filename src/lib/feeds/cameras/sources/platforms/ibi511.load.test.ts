import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';
import { loadIbi511Cameras, type Ibi511Record, type Ibi511Source } from './ibi511';

vi.mock('@/lib/core/net/stealth-fetch', () => ({ stealthFetch: vi.fn() }));

const CFG: Ibi511Source = {
  base: 'https://511.example.gov', idPrefix: 'x', source: 'X DOT', state: 'X',
  bounds: { minLat: 39, maxLat: 41, minLng: -81, maxLng: -79 },
};

const TOTAL = 150;
const row = (id: number): Ibi511Record => ({
  id,
  location: 'I-1 at A St',
  latLng: { geography: { wellKnownText: 'POINT (-80 40)' } },
  // A fifth of the rows blocked, as PennDOT does.
  images: [{ imageUrl: `/map/Cctv/${id}`, blocked: id < 30 }],
});

function serve(failStart?: number) {
  vi.mocked(stealthFetch).mockImplementation(async (url) => {
    const { start, length } = JSON.parse(new URL(String(url)).searchParams.get('query')!) as { start: number; length: number };
    if (start === failStart) return new Response('', { status: 503 });
    const ids = Array.from({ length: Math.max(0, Math.min(length, TOTAL - start)) }, (_, i) => start + i);
    return Response.json({ data: ids.map(row), recordsTotal: TOTAL });
  });
}

beforeEach(() => { vi.mocked(stealthFetch).mockReset(); });

describe('loadIbi511Cameras', () => {
  it('keeps a full read whose rows the deployment blocks', async () => {
    serve();
    const cams = await loadIbi511Cameras(CFG);
    expect(cams).toHaveLength(120);
  });

  it('still refuses a read that lost a page', async () => {
    serve(100);
    await expect(loadIbi511Cameras(CFG)).rejects.toThrow('short read: 100 of 150');
  });

  it('pages at the size the deployment asks for', async () => {
    serve();
    await loadIbi511Cameras({ ...CFG, pageSize: 50 });
    const asked = vi.mocked(stealthFetch).mock.calls
      .map(([url]) => JSON.parse(new URL(String(url)).searchParams.get('query')!) as { start: number; length: number });
    expect(asked.map(q => q.start).sort((a, b) => a - b)).toEqual([0, 50, 100]);
    expect(asked.every(q => q.length === 50)).toBe(true);
  });
});
