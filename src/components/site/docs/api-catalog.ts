/**
 * ═══════════════════════════════════════════════════════════════
 *  TAKIP — API Catalog
 *  Machine-readable description of every public route under /api.
 *  Kept in sync by hand with src/app/api/ * /route.ts; one file per
 *  group in ./lib/api-groups.
 * ═══════════════════════════════════════════════════════════════
 */

import { AI } from './lib/api-groups/ai';
import { AVIATION_SPACE } from './lib/api-groups/aviation-space';
import { CYBER } from './lib/api-groups/cyber';
import { EARTH } from './lib/api-groups/earth';
import { GEOPOLITICAL } from './lib/api-groups/geopolitical';
import { GRAPH } from './lib/api-groups/graph';
import { INTERNET } from './lib/api-groups/internet';
import { MEDIA_MARKETS } from './lib/api-groups/media-markets';
import { TI } from './lib/api-groups/ti';
import { OSINT } from './lib/api-groups/osint';
import { RECON_SCAN } from './lib/api-groups/recon-scan';
import { SDK } from './lib/api-groups/sdk';
import { SPACE } from './lib/api-groups/space';
import { SURVEILLANCE } from './lib/api-groups/surveillance';
import { SYSTEM } from './lib/api-groups/system';
import { TRANSPORT } from './lib/api-groups/transport';
import { WEBHOOKS } from './lib/api-groups/webhooks';

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export interface ApiParam {
  name: string;
  required?: boolean;
  desc: string;
  example?: string;
}

export interface ApiEndpoint {
  /** Path relative to the deployment origin, e.g. `/api/flights` */
  path: string;
  method: HttpMethod | HttpMethod[];
  summary: string;
  /** Query-string parameters (GET) */
  params?: ApiParam[];
  /** Top-level keys present on a 2xx response */
  returns: string[];
  /** Free-form notes: caching, auth, upstream source, failure modes */
  notes?: string;
  /** Environment variables the route reads */
  env?: string[];
  /** Pretty-printed JSON request body, for POST routes */
  bodyExample?: string;
  /** True when the route needs a credential the docs cannot supply */
  requiresAuth?: boolean;
  /** Request headers the route reads, shown in the snippets with placeholder values */
  headers?: Record<string, string>;
}

/** Stable DOM id / deep-link anchor for an endpoint. */
export function endpointId(ep: ApiEndpoint): string {
  const method = Array.isArray(ep.method) ? ep.method[0] : ep.method;
  return `ep-${method}-${ep.path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`.toLowerCase();
}

/** Example request URL with required params filled from their documented examples. */
export function sampleUrl(ep: ApiEndpoint, origin = ''): string {
  const qs = (ep.params || [])
    .filter(p => p.required || p.example)
    .map(p => `${p.name}=${encodeURIComponent((p.example || '').split(' | ')[0] || 'value')}`)
    .join('&');
  return `${origin}${ep.path}${qs ? `?${qs}` : ''}`;
}

export interface ApiGroup {
  id: string;
  title: string;
  blurb: string;
  endpoints: ApiEndpoint[];
}

// Left out as UI plumbing: weather-field, boundaries/fine, hiking/routes, the popup wiki lookups,
// space/texture, and the per-provider camera relays under /api/cctv/.
export const API_GROUPS: ApiGroup[] = [
  SYSTEM,
  AVIATION_SPACE,
  SPACE,
  EARTH,
  GEOPOLITICAL,
  MEDIA_MARKETS,
  SURVEILLANCE,
  TRANSPORT,
  INTERNET,
  CYBER,
  OSINT,
  RECON_SCAN,
  GRAPH,
  AI,
  TI,
  SDK,
  WEBHOOKS,
];

/** Total endpoint count, derived rather than hard-coded so it cannot drift. */
export const ENDPOINT_COUNT = API_GROUPS.reduce((n, g) => n + g.endpoints.length, 0);
