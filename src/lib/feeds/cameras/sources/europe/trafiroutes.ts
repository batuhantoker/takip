import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Wallonia motorway cameras (~210) from SPW's Trafiroutes: the keyless list its real-time map reads, no key.
 * Terms: text and figures are free for non-commercial use with credit; reusing the site's images needs SPW's prior
 * authorisation (trafiroutes.wallonie.be mentions légales).
 */

const API = 'https://trafiroutes.wallonie.be/trafiroutes/Rest/api/viewer/object/CAMERA';
const IMAGE_BASE = 'https://trafiroutes.wallonie.be/images_uploaded/cameras';
const MAP_PAGE = 'https://trafiroutes.wallonie.be/trafiroutes/maptempsreel/';
const SOURCE = 'SPW Trafiroutes';
/** The back office's own marker for a duplicate awaiting removal ("A supprimer doublon"). */
const RETIRED = /supprimer/i;

export const TRAFIROUTES_BOUNDS = { minLat: 49.45, maxLat: 50.85, minLng: 2.8, maxLng: 6.45 };

export interface TrafiroutesCamera {
  idCamera?: number | null;
  /** Belgian Lambert 72 (EPSG:31370) easting and northing. */
  x?: number | null;
  y?: number | null;
  libelle?: string | null;
  libelleLong?: string | null;
}

const RAD = Math.PI / 180;

// EPSG:31370 — Lambert Conic Conformal (2SP) on the International 1924 ellipsoid.
const L72 = (() => {
  const a = 6378388;
  const f = 1 / 297;
  const e = Math.sqrt(2 * f - f * f);
  const m = (phi: number) => Math.cos(phi) / Math.sqrt(1 - (e * Math.sin(phi)) ** 2);
  const t = (phi: number) =>
    Math.tan(Math.PI / 4 - phi / 2) / ((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi))) ** (e / 2);
  const phi1 = 51.16666723333333 * RAD;
  const phi2 = 49.8333339 * RAD;
  const n = (Math.log(m(phi1)) - Math.log(m(phi2))) / (Math.log(t(phi1)) - Math.log(t(phi2)));
  return { a, e, n, aF: a * (m(phi1) / (n * t(phi1) ** n)), lon0: 4.367486666666666 * RAD, x0: 150000.013, y0: 5400088.438 };
})();

/**
 * BD72 to WGS 84 is a 7-parameter Helmert shift (EPSG:31370's towgs84, position-vector convention); dropping it
 * puts a camera about 100 m off.
 */
const TOWGS84 = { tx: -106.8686, ty: 52.2978, tz: -103.7239, rx: 0.3366, ry: -0.457, rz: 1.8422, ds: -1.2747 };

export function lambert72ToWgs84(x: number, y: number): { lat: number; lng: number } {
  const { a, e, n, aF, lon0, x0, y0 } = L72;
  const dx = x - x0;
  const dy = -(y - y0); // rF is 0: the projection's origin latitude is the pole
  const r = Math.sign(n) * Math.hypot(dx, dy);
  const tp = (r / aF) ** (1 / n);
  const lon = Math.atan2(dx, dy) / n + lon0;
  let lat = Math.PI / 2 - 2 * Math.atan(tp);
  for (let i = 0; i < 8; i++) {
    const s = e * Math.sin(lat);
    lat = Math.PI / 2 - 2 * Math.atan(tp * ((1 - s) / (1 + s)) ** (e / 2));
  }

  const e2 = e * e;
  const nu = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const X = nu * Math.cos(lat) * Math.cos(lon);
  const Y = nu * Math.cos(lat) * Math.sin(lon);
  const Z = nu * (1 - e2) * Math.sin(lat);

  const sec = RAD / 3600;
  const { tx, ty, tz } = TOWGS84;
  const rx = TOWGS84.rx * sec, ry = TOWGS84.ry * sec, rz = TOWGS84.rz * sec;
  const k = 1 + TOWGS84.ds * 1e-6;
  const X2 = tx + k * (X - rz * Y + ry * Z);
  const Y2 = ty + k * (rz * X + Y - rx * Z);
  const Z2 = tz + k * (-ry * X + rx * Y + Z);

  const aw = 6378137;
  const fw = 1 / 298.257223563;
  const ew2 = 2 * fw - fw * fw;
  const p = Math.hypot(X2, Y2);
  let latW = Math.atan2(Z2, p * (1 - ew2));
  for (let i = 0; i < 8; i++) {
    const nuW = aw / Math.sqrt(1 - ew2 * Math.sin(latW) ** 2);
    const h = p / Math.cos(latW) - nuW;
    latW = Math.atan2(Z2, p * (1 - (ew2 * nuW) / (nuW + h)));
  }
  return { lat: latW / RAD, lng: Math.atan2(Y2, X2) / RAD };
}

export function mapTrafiroutesCamera(rec: TrafiroutesCamera | null | undefined): CctvCamera | null {
  const id = rec?.idCamera;
  if (!Number.isInteger(id) || id! <= 0) return null;
  const name = (rec!.libelleLong || rec!.libelle || '').replace(/\s+/g, ' ').trim();
  if (RETIRED.test(name) || RETIRED.test(rec!.libelle ?? '')) return null;

  const { x, y } = rec!;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x <= 0 || y <= 0) return null;
  const { lat, lng } = lambert72ToWgs84(x, y);
  const b = TRAFIROUTES_BOUNDS;
  if (!(lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng)) return null;

  return {
    id: `trafiroutes-${id}`,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    name: name || `${SOURCE} Camera ${id}`,
    city: '',
    country: 'Belgium',
    feed_url: `${IMAGE_BASE}/${id}.jpg`,
    external_url: MAP_PAGE,
    source: SOURCE,
  };
}

export async function fetchTrafiroutesCameras(): Promise<CctvCamera[]> {
  // A bare `Accept: application/json` gets a 406; the map's own request also offers */*.
  const res = await stealthFetch(API, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json, text/plain, */*' },
  });
  if (!res.ok) throw new Error(`Trafiroutes HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Trafiroutes: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const rec of data as TrafiroutesCamera[]) {
    const cam = mapTrafiroutesCamera(rec);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Trafiroutes cameras — ${SOURCE}: ${seen.size}`);
  return [...seen.values()];
}
