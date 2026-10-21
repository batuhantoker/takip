import { fromColumns, isColumns } from '@/lib/core/columns';

/** The map's flights: the JSON route's lists as columns (lib/core/columns.ts), about two thirds the download. */
export const FLIGHTS_URL = '/api/flights?format=columns';

const LISTS = ['commercial_flights', 'private_flights', 'private_jets', 'military_flights'] as const;

/** What a flights answer adds to the page's data: the same lists the JSON gives; anything else passes through. */
export function flightData(answer: Record<string, unknown>): Record<string, unknown> {
  if (answer?.format !== 'flights') return answer;
  const out: Record<string, unknown> = { ...answer };
  delete out.format;
  for (const list of LISTS) {
    const encoded = answer[list];
    out[list] = isColumns(encoded) ? fromColumns(encoded) : [];
  }
  return out;
}
