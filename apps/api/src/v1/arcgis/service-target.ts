import { isIP } from 'node:net';

// Caller-chosen (organisations self-host ArcGIS Server), so pin https and the REST service shape, and rebuild
// through URL, never by concatenation: a trailing '#' once smuggled arbitrary paths past the '/query' suffix.
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
