import { describe, expect, it } from 'vitest';
import { shipsNear } from './ports-live';

describe('shipsNear', () => {
  it('reads the route’s count around the port, classes most first', () => {
    const now = shipsNear({
      near: { km: 10, total: 4, underway: 2, types: { tanker: 1, cargo: 2, other: 1 } },
      timestamp: '2026-10-19T14:02:00.000Z',
    }, 'Rotterdam');
    expect(now).toEqual({ port: 'Rotterdam', km: 10, total: 4, underway: 2, types: [['cargo', 2], ['tanker', 1], ['other', 1]], at: Date.parse('2026-10-19T14:02:00.000Z') });
  });

  it('has nothing to say where the layer has no ships nearby, or the route sent no count', () => {
    expect(shipsNear({ near: { km: 10, total: 0, underway: 0, types: {} } }, 'X')).toBeNull();
    expect(shipsNear({}, 'X')).toBeNull();
    expect(shipsNear(null, 'X')).toBeNull();
  });
});
