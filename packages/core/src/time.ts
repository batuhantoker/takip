/*
 * The time model shared by every store (docs/architecture/replay-database.md §5).
 * Times are epoch milliseconds UTC; BCE dates are negative.
 */

/** valid_lo for "valid since forever", and t_hi / R*Tree max for "still open". */
export const FOREVER_LO = -8.64e15;
export const OPEN_HI = 8.64e15;

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export const Prec = {
  unknown: 0,
  millennium: 1,
  century: 2,
  decade: 3,
  year: 4,
  month: 5,
  day: 6,
  hour: 7,
  minute: 8,
  second: 9,
} as const;
export type Prec = (typeof Prec)[keyof typeof Prec];

const yearOf = (t: number) => new Date(t).getUTCFullYear();
const utc = (year: number, month = 0, day = 1) => {
  const d = new Date(0);
  d.setUTCFullYear(year, month, day);
  return d.getTime();
};

/**
 * The interval a stated time covers at its precision: a `1917-05` start with month precision spans May.
 * `hi` is exclusive. Unknown precision covers only the instant.
 */
export function expand(t: number, prec: Prec): { lo: number; hi: number } {
  const d = new Date(t);
  switch (prec) {
    case Prec.millennium:
    case Prec.century:
    case Prec.decade: {
      const span = prec === Prec.millennium ? 1000 : prec === Prec.century ? 100 : 10;
      const start = Math.floor(yearOf(t) / span) * span;
      return { lo: utc(start), hi: utc(start + span) };
    }
    case Prec.year:
      return { lo: utc(yearOf(t)), hi: utc(yearOf(t) + 1) };
    case Prec.month:
      return { lo: utc(d.getUTCFullYear(), d.getUTCMonth()), hi: utc(d.getUTCFullYear(), d.getUTCMonth() + 1) };
    case Prec.day:
      return { lo: floorTo(t, DAY_MS), hi: floorTo(t, DAY_MS) + DAY_MS };
    case Prec.hour:
      return { lo: floorTo(t, HOUR_MS), hi: floorTo(t, HOUR_MS) + HOUR_MS };
    case Prec.minute:
      return { lo: floorTo(t, 60_000), hi: floorTo(t, 60_000) + 60_000 };
    case Prec.second:
      return { lo: floorTo(t, 1000), hi: floorTo(t, 1000) + 1000 };
    default:
      return { lo: t, hi: t };
  }
}

/** Floors toward −∞, so negative (BCE) times land in the right bucket too. */
export const floorTo = (t: number, size: number) => Math.floor(t / size) * size;
