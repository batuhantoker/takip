import type { TransitMode } from './modes';
import type { TransitResponse } from './view';

/** One line running in view: a feed's route, how many of its vehicles are there, and trips they run. */
export interface TransitLine {
  feed: string;
  route: string;
  mode?: TransitMode;
  operator?: string;
  vehicles: number;
  /** For the line's shape and stops: a second trip heading the other way where one is in view. */
  trips: string[];
}

/** The line picked to look at; `from` is the vehicle window it was picked in, which takes it away on closing. */
export interface LineFocus {
  feed: string;
  route: string;
  mode?: TransitMode;
  trips: string[];
  from?: string;
}

const turn = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** The lines among the vehicles in view, the busiest first. */
export function linesInView(res: TransitResponse): TransitLine[] {
  const groups = new Map<string, { line: TransitLine; runs: { trip: string; bearing?: number }[] }>();
  for (const v of res.vehicles) {
    const feed = res.feeds[v.feed];
    if (!v.route || !feed) continue;
    const id = `${feed.id}\n${v.route}`;
    let g = groups.get(id);
    if (!g) groups.set(id, (g = { line: { feed: feed.id, route: v.route, mode: v.mode, operator: v.operator || feed.name, vehicles: 0, trips: [] }, runs: [] }));
    g.line.vehicles++;
    if (v.trip && !g.runs.some(r => r.trip === v.trip)) g.runs.push({ trip: v.trip, bearing: v.bearing });
  }
  return [...groups.values()].map(({ line, runs }) => {
    const [first] = runs;
    const back = first?.bearing == null ? undefined : runs.find(r => r.bearing != null && turn(r.bearing, first.bearing!) > 90);
    return { ...line, trips: [first?.trip, (back ?? runs[1])?.trip].filter(t => t != null) };
  }).sort((a, b) => b.vehicles - a.vehicles || a.route.localeCompare(b.route, undefined, { numeric: true }));
}

export const sameLine = (a: { feed: string; route: string } | null, b: { feed: string; route: string } | null) =>
  !!a && !!b && a.feed === b.feed && a.route === b.route;

interface LinesState {
  /** Null while nothing is fetched: the layer off, or zoomed out to the cities. */
  lines: TransitLine[] | null;
  focus: LineFocus | null;
}

let state: LinesState = { lines: null, focus: null };
const listeners = new Set<() => void>();
const emit = (next: LinesState) => {
  state = next;
  listeners.forEach(l => l());
};

export const transitLinesState = () => state;
export function subscribeTransitLines(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const setTransitLines = (lines: TransitLine[] | null) => emit({ ...state, lines });
export const setLineFocus = (focus: LineFocus | null) => emit({ ...state, focus });

/** A vehicle's line, with the trips of the line's other vehicles in view for the other direction. */
export function focusFromVehicle(v: { feed: string; route: string; mode?: TransitMode; trip?: string; from: string }): LineFocus {
  const inView = state.lines?.find(l => sameLine(l, v))?.trips ?? [];
  const trips = [...new Set([v.trip, ...inView].filter(t => t != null))].slice(0, 2);
  return { feed: v.feed, route: v.route, mode: v.mode, trips, from: v.from };
}
