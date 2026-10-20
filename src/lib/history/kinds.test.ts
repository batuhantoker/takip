import { describe, expect, it } from 'vitest';
import { LAYER_PAGES } from '@/lib/platform/site/layer-pages';
import { KINDS as SEEDED } from '../../../tools/import/seed/index';
import { familiesOfKinds, KIND_FAMILY } from './kinds';
import { HISTORY_FAMILIES, KINDS } from './popup';

describe('history kinds', () => {
  it('files every kind the popup names in a family History draws, as the importer does', () => {
    expect(Object.keys(KIND_FAMILY).sort()).toEqual(Object.keys(KINDS).sort());
    for (const family of Object.values(KIND_FAMILY)) expect(HISTORY_FAMILIES).toHaveProperty(family);
    for (const k of SEEDED) if (k.code in KIND_FAMILY) expect([k.code, KIND_FAMILY[k.code]]).toEqual([k.code, k.family]);
  });

  it('knows the kinds of every topic page, and the page switches their families on', () => {
    for (const page of LAYER_PAGES.filter(p => p.eventKinds)) {
      for (const kind of page.eventKinds!) expect(KIND_FAMILY, page.slug).toHaveProperty([kind]);
      const families = page.mode?.view === 'history' ? page.mode.families ?? [] : [];
      expect(families, page.slug).toEqual(expect.arrayContaining(familiesOfKinds(page.eventKinds!)));
    }
  });

  it('switches on each family once', () => {
    expect(familiesOfKinds(['accident.aviation', 'disaster.fire', 'battle', 'nonsense'])).toEqual(['disaster', 'conflict']);
  });
});
