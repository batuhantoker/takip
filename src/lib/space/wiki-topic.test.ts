import { describe, expect, it } from 'vitest';
import { wikiTopic } from './wiki-topic';

describe('wikiTopic', () => {
  it('names bodies and landmarks directly and looks the rest up with context', () => {
    expect(wikiTopic({ kind: 'body', key: 'mercury' })).toEqual({ title: 'Mercury (planet)' });
    expect(wikiTopic({ kind: 'craft', id: -61 }, 'Juno')).toEqual({ q: 'Juno spacecraft' });
    expect(wikiTopic({ kind: 'outer', key: 'oumuamua' })).toEqual({ title: 'ʻOumuamua' });
    expect(wikiTopic({ kind: 'feature', id: 'cosmos:Norma Cluster (Great Attractor)' })).toEqual({ q: 'Norma Cluster' });
    expect(wikiTopic({ kind: 'feature', id: 'm31' })).toEqual({ q: 'Andromeda Galaxy galaxy' });
  });

  it('skips catalogue-only stars', () => {
    expect(wikiTopic({ kind: 'star', index: 5 }, 'Gaia DR3 123')).toBeNull();
    expect(wikiTopic({ kind: 'star', index: 5 }, 'Castor')).toEqual({ q: 'Castor star' });
  });
});
