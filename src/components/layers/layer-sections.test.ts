import { describe, expect, it } from 'vitest';
import { REFERENCE_GROUPS } from '@/lib/reference/catalog';
import { LAYER_GROUPS, type LayerGroupDef } from './layer-groups';
import { filterSections, groupSections, groupTitle, OTHER_SECTION_ID, sectionFor } from './layer-sections';
import { sentenceCase } from './sentence-case';

const icon = () => null;
const group = (label: string, keys: string[] = [label.toLowerCase()]): LayerGroupDef => ({
  label, fullLabel: label, icon, layers: keys.map(key => ({ key, label: key, dataKey: '' })),
});

describe('sectionFor', () => {
  it('puts every current group except DISPLAY in a section', () => {
    for (const g of LAYER_GROUPS) {
      if (g.label === 'DISPLAY') continue;
      expect(sectionFor(g.label), g.label).toEqual(expect.any(String));
    }
  });

  it('maps the known groups to their sections', () => {
    expect(sectionFor('AVIATION')).toBe('air');
    expect(sectionFor('MARITIME')).toBe('sea');
    expect(sectionFor('SDK')).toBe('sea');
    expect(sectionFor('SPACE')).toBe('space');
    expect(sectionFor('WEATHER')).toBe('weather');
    expect(sectionFor('HAZARD')).toBe('weather');
    expect(sectionFor('THREAT')).toBe('conflict');
    expect(sectionFor('NETWORK')).toBe('conflict');
    expect(sectionFor('NETINTEL')).toBe('conflict');
    expect(sectionFor('SURVEIL')).toBe('cameras');
    expect(sectionFor('OUTDOOR')).toBe('reference');
    for (const g of REFERENCE_GROUPS) expect(sectionFor(g.label), g.label).toBe('reference');
  });

  it('sends an unknown group to Other', () => {
    expect(sectionFor('BALLOONS')).toBe(OTHER_SECTION_ID);
  });

  it('excludes DISPLAY', () => {
    expect(sectionFor('DISPLAY')).toBeNull();
  });
});

describe('groupSections', () => {
  it('drops DISPLAY and keeps every other layer of the real groups', () => {
    const sections = groupSections(LAYER_GROUPS);
    const keys = sections.flatMap(s => s.groups.flatMap(g => g.layers.map(l => l.key)));
    const expected = LAYER_GROUPS.filter(g => g.label !== 'DISPLAY').flatMap(g => g.layers.map(l => l.key));
    expect(keys.sort()).toEqual(expected.sort());
    expect(keys).not.toContain('day_night');
  });

  it('orders sections and the groups inside them, and drops empty sections', () => {
    const sections = groupSections([group('SDK'), group('NEWTHING'), group('MARITIME'), group('AVIATION'), group('DISPLAY')]);
    expect(sections.map(s => s.id)).toEqual(['air', 'sea', OTHER_SECTION_ID]);
    expect(sections[1].groups.map(g => g.label)).toEqual(['MARITIME', 'SDK']);
    expect(sections[2].groups.map(g => g.label)).toEqual(['NEWTHING']);
  });

  it('names groups only where it helps', () => {
    const byId = Object.fromEntries(groupSections([
      group('MARITIME'), group('SDK'), group('WEATHER'), group('HAZARD'), group('AVIATION'), group('NEWTHING'),
    ]).map(s => [s.id, s.subheadings]));
    expect(byId).toEqual({ air: false, sea: false, weather: true, [OTHER_SECTION_ID]: true });
  });
});

describe('filterSections', () => {
  const sections = groupSections([group('MARITIME', ['maritime', 'chokepoint_flow']), group('HAZARD', ['earthquakes', 'fires'])]);

  it('keeps a whole section when the query names it', () => {
    expect(filterSections(sections, 'sea')).toEqual([sections[0]]);
    expect(filterSections(sections, 'hazard')).toEqual([sections[1]]);
  });

  it('otherwise matches layers', () => {
    const out = filterSections(sections, 'fire');
    expect(out.map(s => s.id)).toEqual(['weather']);
    expect(out[0].groups[0].layers.map(l => l.key)).toEqual(['fires']);
  });

  it('returns the input for a blank query', () => {
    expect(filterSections(sections, '  ')).toBe(sections);
  });
});

describe('names', () => {
  it('sentence-cases labels but keeps acronyms', () => {
    expect(sentenceCase('Private Jets')).toBe('Private jets');
    expect(sentenceCase('GPS / Navigation')).toBe('GPS / navigation');
    expect(sentenceCase('Air-Raid Alerts')).toBe('Air-raid alerts');
    expect(sentenceCase('3D Buildings')).toBe('3D buildings');
    expect(sentenceCase('Underway only')).toBe('Underway only');
    expect(sentenceCase('NET & EVENT INTEL')).toBe('Net & event intel');
  });

  it('gives groups readable subheadings', () => {
    expect(groupTitle({ ...group('NETWORK'), fullLabel: 'NETWORK INTEL' })).toBe('Malware & botnets');
    expect(groupTitle({ ...group('SITES'), fullLabel: 'BASES, DAMS & PARKS' })).toBe('Bases, dams & parks');
  });
});
