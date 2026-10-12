import { isIP } from 'node:net';

/*
 * `service` is a URL the caller chooses: the panel takes it from a catalog
 * search result, and organisations self-host ArcGIS Server on their own
 * domains, so there is no single host to pin. What can be pinned is the
 * shape — https, a genuine ArcGIS REST service path — and the target being
 * somewhere other than our own network, which safeFetch enforces on every
 * hop including redirects.
 *
 * This route previously passed `service` to fetch() with no checks at all, so
 * it would fetch any address the caller named and hand back the body: a
 * loopback service, another container, or a cloud metadata endpoint. The
 * mandatory "/query" suffix was no obstacle either, because it was appended to
 * the raw string — a trailing "#" made it part of a fragment, which is dropped
 * before the request goes out, so "http://127.0.0.1/internal#" fetched
 * /internal unchanged. The URL is therefore rebuilt through the URL object
 * here, never by concatenation.
 */
const ARCGIS_SERVICE_ROOT = /\/rest\/services\/.+\/(?:Feature|Map)Server$/i;

export interface ServiceTarget {
  /** The service itself, with no layer and no /query. */
  root: URL;
  /** The layer the caller asked for, or null if they named the service root. */
  layer: number | null;
}

/** A caller-supplied service URL, split and validated, or null if it is not one. */
export function featureServiceTarget(service: string): ServiceTarget | null {
  let url: URL;
  try {
    url = new URL(service);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  /* A published Feature Service is always on a name, never a bare address.
     Refusing literals here means a target like https://127.0.0.1/rest/services
     /x/FeatureServer/0 is turned away before a request is attempted, rather
     than relying on safeFetch to catch it at the socket. Names still go
     through safeFetch, which resolves them and re-checks every redirect. */
  if (isIP(url.hostname.replace(/^\[|\]$/g, ''))) return null;

  // Anything the caller hung off the end is dropped rather than carried along.
  url.hash = '';
  url.search = '';

  let path = url.pathname.replace(/\/+$/, '');
  if (/\/query$/i.test(path)) path = path.replace(/\/query$/i, '');

  let layer: number | null = null;
  const named = /\/(\d+)$/.exec(path);
  if (named) {
    layer = Number(named[1]);
    path = path.slice(0, -named[0].length);
  }
  if (!ARCGIS_SERVICE_ROOT.test(path)) return null;

  url.pathname = path;
  return { root: url, layer };
}

/*
 * ArcGIS publishes several kinds of service and the catalogue returns them all
 * side by side — a wildfire search comes back with eleven ImageServers among
 * the feature layers. An ImageServer serves rasters, so there is nothing to
 * import from it, but answering "must be an https ArcGIS Feature Service layer
 * URL" reads like a security refusal or a typo. Name the kind instead. This
 * only chooses the wording; no request is made either way.
 */
export function unsupportedServiceKind(service: string): string | null {
  const kind = /\/rest\/services\/.+\/(\w+Server)(?:\/\d+)?\/?(?:[?#].*)?$/i.exec(service)?.[1];
  if (!kind || /^(?:Feature|Map)Server$/i.test(kind)) return null;
  return kind;
}

/** Where a layer's features are asked for. */
export const layerQueryUrl = (root: URL, layer: number): URL => {
  const url = new URL(root.toString());
  url.pathname = `${root.pathname}/${layer}`;
  url.pathname += '/query';
  return url;
};
