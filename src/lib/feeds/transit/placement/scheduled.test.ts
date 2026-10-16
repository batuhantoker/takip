import { describe, expect, it } from 'vitest';
import { localClock, scheduledVehicles, type Timetable } from './scheduled';

const WEEKDAYS = 0b0011111, DAILY = 0b1111111;

const tt: Timetable = {
  tz: 'Europe/Istanbul',
  stops: [[29.0, 41.0, 'Şişhane'], [29.01, 41.01, 'Taksim'], [29.02, 41.02, 'Osmanbey']],
  routes: [{ name: 'M2', mode: 'metro' }],
  patterns: [{
    route: 0, stops: [0, 1, 2], at: [0, 120, 300],
    // 08:00 on both services is one train; 23:58 runs past midnight.
    starts: { [WEEKDAYS]: [8 * 3600, 8 * 3600 + 600], [DAILY]: [8 * 3600, 23 * 3600 + 58 * 60] },
  }],
};

// Thursday 2026-10-15, 08:01:00 in Istanbul (UTC+3).
const at = (h: number, m: number, day = 15) => new Date(Date.UTC(2026, 9, day, h - 3, m, 0));

describe('localClock', () => {
  it("reads the timetable's own weekday and time", () => {
    expect(localClock('Europe/Istanbul', at(8, 1))).toEqual({ day: 3, sec: 8 * 3600 + 60 });
  });
});

describe('scheduledVehicles', () => {
  it('puts each running trip between its stops, once though two services list it', () => {
    const [v, ...rest] = scheduledVehicles(tt, at(8, 1));
    expect(rest).toEqual([]);
    expect(v).toMatchObject({ route: 'M2', mode: 'metro', from: 'Şişhane', stop: 'Taksim', status: 2, scheduled: true, estimated: true });
    expect(v.lng).toBeCloseTo(29.005, 6);
  });

  it('keeps a trip that started before midnight going after it', () => {
    const vs = scheduledVehicles(tt, at(0, 1, 16));
    expect(vs.map(v => [v.from, v.stop])).toEqual([['Taksim', 'Osmanbey']]);
  });

  it('runs only the services of the day', () => {
    // Saturday: the weekday 08:10 doesn't run.
    expect(scheduledVehicles(tt, at(8, 11, 17))).toEqual([]);
    expect(scheduledVehicles(tt, at(8, 11, 16))).toHaveLength(1);
  });
});
