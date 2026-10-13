import { describe, expect, it } from 'vitest';
import { maneuverKind } from './maneuver';

const kind = (type: string, instruction: string) => maneuverKind({ type, instruction });

describe('maneuverKind', () => {
  it('trusts the instruction over a mislabelled type', () => {
    expect(kind('roundabout', 'Turn left onto Whitehall/A3212.')).toBe('left');
    expect(kind('roundabout', 'Bear left.')).toBe('slight-left');
    expect(kind('merge', 'Enter Charing Cross and take the 2nd exit onto Trafalgar Square/A4.')).toBe('roundabout');
    expect(kind('merge', 'Exit the roundabout onto Trafalgar Square/A4. Continue on A4.')).toBe('roundabout');
  });

  it('reads turns, bears and keeps', () => {
    expect(kind('right', "Turn right onto St. James's Street/A4.")).toBe('right');
    expect(kind('straight', 'Keep right to take M4.')).toBe('slight-right');
    expect(kind('straight', 'Make a sharp left onto Elm Road.')).toBe('left');
    expect(kind('straight', 'Take the exit on the left toward Heathrow.')).toBe('slight-left');
  });

  it('knows the rarer ones', () => {
    expect(kind('straight', 'Make a left U-turn at Oak Street.')).toBe('uturn');
    expect(kind('straight', 'Take the ferry to Calais.')).toBe('ferry');
    expect(kind('merge', 'Merge onto M25.')).toBe('merge');
    expect(kind('straight', 'Take exit 4 onto A408 toward Heathrow.')).toBe('straight');
  });

  it('is not fooled by street names', () => {
    expect(kind('right', 'Turn right onto Ferry Road.')).toBe('right');
    expect(kind('straight', 'Continue onto Roundabout Lane.')).toBe('straight');
  });

  it('keeps the ends and falls back to the type', () => {
    expect(kind('depart', 'Drive east on Downing Street.')).toBe('depart');
    expect(kind('arrive', 'You have arrived at your destination.')).toBe('arrive');
    expect(kind('left', '')).toBe('left');
    expect(kind('whatever', 'Something new.')).toBe('straight');
  });
});
