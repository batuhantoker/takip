/**
 * TAKIP — the night side of any body, from the point the Sun stands over.
 * The same construction as Earth's day/night layer, for a sub-solar point
 * that comes from Horizons rather than from Earth's seasons.
 */

const DEG = Math.PI / 180;

export function nightPolygon(sunLng: number, sunLat: number, stepDeg = 2): [number, number][] {
  // At an equinox the terminator is a meridian pair; keep tan() off zero.
  const dec = (Math.abs(sunLat) < 0.01 ? (sunLat < 0 ? -0.01 : 0.01) : sunLat) * DEG;
  const ring: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += stepDeg) {
    ring.push([lng, Math.atan(-Math.cos((lng - sunLng) * DEG) / Math.tan(dec)) / DEG]);
  }
  const darkPole = dec > 0 ? -90 : 90;
  ring.push([180, darkPole], [-180, darkPole], ring[0]);
  return ring;
}
