import { describe, expect, it } from 'vitest';
import { countAction, restoreActions, takeActions } from './usage-actions';

describe('usage actions', () => {
  it('counts, empties on take, and merges counts put back', () => {
    expect(takeActions()).toBeUndefined();
    countAction('search.run');
    countAction('search.run');
    countAction('route.plan');
    const taken = takeActions();
    expect(taken).toEqual({ 'search.run': 2, 'route.plan': 1 });
    expect(takeActions()).toBeUndefined();

    countAction('search.run');
    restoreActions(taken);
    expect(takeActions()).toEqual({ 'search.run': 3, 'route.plan': 1 });
  });
});
