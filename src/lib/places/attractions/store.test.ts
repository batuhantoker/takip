import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TopicTable } from '@/lib/platform/site/places/tables';
import type { AttractionsMeta, AttractionsRow } from '@/lib/platform/site/places/topics/attractions-data';

// No data/db/attractions.db here, so the store reads the place pages' table instead.
const TABLE: TopicTable<AttractionsRow, AttractionsMeta> = {
  generated: '2026-10-26T00:00:00Z',
  rows: {},
  meta: {
    cityKm: 30,
    items: {
      Q19675: { k: 'museum', l: 180, at: [2.3358, 48.8611], n: { en: 'Louvre Museum', fr: 'musée du Louvre' }, w: 'en fr de' },
      Q2981: { k: 'cathedral', h: 1, l: 120, at: [2.3498, 48.853], n: { en: 'Notre-Dame de Paris' }, w: 'en' },
      Q9188: { k: 'museum', l: 140, at: [-73.963, 40.779], n: { en: 'Metropolitan Museum of Art' }, w: 'en es' },
    },
  },
};

vi.mock('@/lib/platform/site/places/tables', () => ({ topicTable: () => TABLE }));

const { spotsIn } = await import('./store');

let dataDir: string | undefined;
beforeAll(() => {
  dataDir = process.env.TAKIP_DATA_DIR;
  process.env.TAKIP_DATA_DIR = mkdtempSync(join(tmpdir(), 'takip-attractions-'));
});
afterAll(() => {
  if (dataDir === undefined) delete process.env.TAKIP_DATA_DIR;
  else process.env.TAKIP_DATA_DIR = dataDir;
});

describe('spotsIn', () => {
  it('serves what is in the box, the best known first, named in the reader’s language', () => {
    const { features } = spotsIn([[2.2, 48.8, 2.5, 48.9]], 14, 'fr');
    expect(features.map(f => f.properties.name)).toEqual(['musée du Louvre', 'Notre-Dame de Paris']);
    expect(features[0].properties).toMatchObject({ id: 'Q19675', k: 'museum', l: 180, wl: 'fr' });
    expect(features[1].properties).toMatchObject({ h: 1, wl: 'en' });
  });

  it('serves each box of a view across the antimeridian, and nothing far out', () => {
    expect(spotsIn([[170, 40, 180, 41], [-180, 40, -73, 41]], 14, 'en').features.map(f => f.properties.id)).toEqual(['Q9188']);
    expect(spotsIn([[-180, -90, 180, 90]], 2, 'en').features).toEqual([]);
  });
});
