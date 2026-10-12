import { cachedSource } from '@takip/connectors/source-cache';
import { safeFetch } from '@takip/connectors/ssrf-guard';
import { layerQueryUrl, type ServiceTarget } from './service-target';

/** An answer the route sends as is: a FeatureCollection, or an error with its status. */
export type LayerAnswer = { geojson: unknown } | { error?: string; status: number };

/*
 * Which layer to query when the caller named a service root.
 *
 * This used to be layer 0, always. Layer ids are assigned by whoever published
 * the service and frequently do not start at zero — a tiled MapServer in the
 * catalogue numbers its three layers 15, 16 and 17 — so "/0/query" returned
 * 404 and the panel reported "Feature Service query failed (404)". Ask the
 * service what it has instead.
 *
 * It also answers the other half of that failure: a tile cache
 * ("Map,TilesOnly,Tilemap") serves pictures, not features, and can never
 * answer a query at all. That is worth saying plainly rather than passing a
 * 404 through.
 */
interface ServiceInfo {
  capabilities?: string;
  layers?: { id?: number; name?: string; subLayerIds?: number[] | null }[];
  error?: { message?: string };
}
interface Discovered {
  layer?: number;
  error?: string;
  status?: number;
}
const SERVICE_INFO_TTL_MS = 30 * 60 * 1000;

async function discoverLayer(root: URL): Promise<Discovered> {
  const info = await cachedSource<Discovered>(
    `arcgis:info:${root.toString()}`,
    async () => {
      const probe = new URL(root.toString());
      probe.search = 'f=json';
      const res = await safeFetch(probe.toString(), { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [{ error: `Service description unavailable (${res.status})`, status: 502 }];

      const body = (await res.json()) as ServiceInfo;

      /* Say what the service said. Some catalogue entries are subscription
         content and answer "Token Required for subscription content"; that is
         a far more useful thing to show than a guess of our own. */
      if (body.error?.message) {
        return [{ error: `The service refused the request: ${body.error.message}`, status: 422 }];
      }

      const capabilities = String(body.capabilities ?? '');
      if (capabilities && !/(^|,)\s*Query\s*(,|$)/i.test(capabilities)) {
        return [{
          error: 'This service publishes map tiles only, so it has no features to import.',
          status: 422,
        }];
      }
      /* Skip group layers. A group is a folder in the service's table of
         contents — it carries subLayerIds and no features of its own, and
         querying one is answered "Invalid or missing input parameters". One
         flood service in the catalogue leads with a group at id 0 and keeps
         its real parcels on 1..5. */
      const layer = (body.layers ?? []).find(
        l => typeof l.id === 'number' && !(Array.isArray(l.subLayerIds) && l.subLayerIds.length > 0),
      );
      /* A description we cannot read is not proof there is nothing there —
         fall back to the layer this route always used, and let the query
         itself report the outcome. */
      if (!layer) return [{ layer: 0 }];
      return [{ layer: layer.id }];
    },
    SERVICE_INFO_TTL_MS,
  )();
  return info[0] ?? { error: 'Service description unavailable', status: 502 };
}

/** The features of the target's layer, inside bbox ("west,south,east,north") when given. */
export async function queryLayer(target: ServiceTarget, bbox: string | undefined): Promise<LayerAnswer> {
  try {
    let layer = target.layer;
    if (layer === null) {
      const found = await discoverLayer(target.root);
      if (found.layer === undefined) return { error: found.error, status: found.status ?? 502 };
      layer = found.layer;
    }
    const queryUrl = layerQueryUrl(target.root, layer);

    const params = new URLSearchParams({
      where: '1=1',
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: '4326',
      outSR: '4326',
      outFields: '*',
      returnGeometry: 'true',
      resultRecordCount: '2000',
      f: 'geojson',
    });
    if (bbox) params.set('geometry', bbox);

    queryUrl.search = params.toString();
    const res = await safeFetch(queryUrl.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { error: `Feature Service query failed (${res.status})`, status: res.status };

    const geojson = (await res.json()) as { error?: { message?: string } };
    if (geojson.error) return { error: geojson.error.message || 'Feature Service error', status: 502 };
    return { geojson };
  } catch (err) {
    const { name, message } = (err ?? {}) as Partial<Error>;
    if (name === 'TimeoutError' || name === 'AbortError') return { error: 'Feature Service query timed out', status: 504 };
    // A target that resolved into a reserved range is refused, not a 500.
    if (String(message).startsWith('safeFetch: blocked')) return { error: 'Forbidden target', status: 403 };
    return { error: message || 'Query failed', status: 500 };
  }
}
