export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** n + 1 points along the great circle, as [lng, lat]. */
export function greatCirclePoints(
  lat1: number, lng1: number, lat2: number, lng2: number, n = 72,
): [number, number][] {
  const toR = (d: number) => d * Math.PI / 180;
  const toD = (r: number) => r * 180 / Math.PI;
  const φ1 = toR(lat1), λ1 = toR(lng1), φ2 = toR(lat2), λ2 = toR(lng2);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
  ));
  if (d < 1e-10) return [[lng1, lat1], [lng2, lat2]];
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([toD(Math.atan2(y, x)), toD(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return pts;
}

/** Departure and arrival times from the distance flown and left, at the ground speed or 800 km/h. */
export function estimateTimes(
  oLat: number, oLng: number, dLat: number, dLng: number,
  cLat: number, cLng: number, speedKt: number | null,
) {
  const total = haversineKm(oLat, oLng, dLat, dLng);
  const done  = haversineKm(oLat, oLng, cLat, cLng);
  const left  = haversineKm(cLat, cLng, dLat, dLng);
  const progress = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const kmh = (speedKt && speedKt > 50) ? speedKt * 1.852 : 800;
  const now = Date.now();
  return {
    departureTime: new Date(now - (done / kmh) * 3600000).toISOString(),
    arrivalTime:   new Date(now + (left / kmh) * 3600000).toISOString(),
    progress,
  };
}
