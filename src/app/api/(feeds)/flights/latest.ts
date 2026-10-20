/** The flights feed's last payload, for routes that search it rather than serve it whole. */

export interface FlightsSnapshot { data: Record<string, unknown>; at: number }

// On globalThis: the search route may be bundled apart from the feed route and would otherwise never see it.
const holder = globalThis as unknown as { takipFlightsLatest?: FlightsSnapshot };

export function publishFlights(data: Record<string, unknown>) {
  holder.takipFlightsLatest = { data, at: Date.now() };
}

export const latestFlights = (): FlightsSnapshot | null => holder.takipFlightsLatest ?? null;
