import { describe, expect, it } from 'vitest';
import { TOPICS } from '@/lib/platform/site/places/topics/registry';
import { TOPIC_VIEWS } from './registry';

// A topic registered on one side only would render a titled page with no body.
describe('place topic registries', () => {
  it('give every topic a view, and every view a topic', () => {
    expect(TOPICS.map(t => t.id).sort()).toEqual(Object.keys(TOPIC_VIEWS).sort());
  });
});
