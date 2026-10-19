import { describe, expect, it } from 'vitest';
import { USAGE_ACTIONS } from '@takip/core/usage';
import { actionGroup, actionLabel, groupActions, labelledActions } from './actions';

describe('action labels', () => {
  it('names every counted action, and nothing the api would refuse', () => {
    expect([...labelledActions()].sort()).toEqual([...USAGE_ACTIONS].sort());
  });

  it('groups by panel, busiest first', () => {
    const groups = groupActions([{ action: 'search.run', count: 2 }, { action: 'recon.email', count: 1 }, { action: 'recon.ip', count: 4 }, { action: 'made.up', count: 1 }]);
    expect(groups.map(g => [g.label, g.total, g.rows.map(r => r.action)])).toEqual([
      ['Recon', 5, ['recon.ip', 'recon.email']],
      ['Search', 2, ['search.run']],
      ['Other', 1, ['made.up']],
    ]);
    expect(actionLabel('route.plan')).toBe('Routes planned');
    expect(actionGroup('ti.ask').label).toBe('TI');
  });
});
