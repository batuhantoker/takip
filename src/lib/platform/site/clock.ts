/**
 * A moment a public page names. The server can't know the reader's time zone, so text built here carries the
 * moment itself, and the page shows it in the reader's clock (components/site/pages/local-clock.tsx).
 */
export interface Instant { at: number; show: 'time' | 'day' | 'date' }

/** Text with moments in it, as t.parts() returns it when its values are instants. */
export type Spoken = (string | Instant)[];

export const instant = (at: number, show: Instant['show'] = 'time'): Instant => ({ at, show });

export const isInstant = (p: unknown): p is Instant =>
  typeof p === 'object' && p !== null && typeof (p as Instant).at === 'number' && typeof (p as Instant).show === 'string';

export const CLOCK_FORMAT: Record<Instant['show'], Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  day: { weekday: 'short', day: 'numeric', month: 'short' },
  date: { day: 'numeric', month: 'short', year: 'numeric' },
};

/** The moment in UTC, marked as such where it's a time of day: what the server renders. */
export function utcText({ at, show }: Instant, intl: string): string {
  const text = new Intl.DateTimeFormat(intl, { ...CLOCK_FORMAT[show], timeZone: 'UTC' }).format(at);
  return show === 'time' ? `${text} UTC` : text;
}

/** Spoken text flattened to UTC, for places without a browser (tests, share cards). */
export const spokenUtc = (parts: Spoken, intl: string) => parts.map(p => (typeof p === 'string' ? p : utcText(p, intl))).join('');
