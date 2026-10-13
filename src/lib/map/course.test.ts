import { describe, expect, it } from 'vitest';
import { course } from './course';

describe('course', () => {
  it('keeps a real heading on a moving craft', () => {
    expect(course(274, 12)).toBe(274);
    expect(course(0, 8)).toBe(0);
  });
  it('drops the AIS "not available" values', () => {
    expect(course(360, 12)).toBeNull();
    expect(course(511, 12)).toBeNull();
    expect(course(-1, 12)).toBeNull();
  });
  it('drops the heading of anything stopped', () => {
    expect(course(90, 0)).toBeNull();
    expect(course(90, 0.4)).toBeNull();
  });
  it('keeps the heading when the speed is unknown', () => {
    expect(course(90, undefined)).toBe(90);
  });
  it('has nothing to say without a heading', () => {
    expect(course(null, 10)).toBeNull();
    expect(course('', 10)).toBeNull();
  });
});
