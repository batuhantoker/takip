/**
 * TAKIP — a camera path that zooms and pans at once without losing sight of
 * either end: van Wijk & Nuij, "Smooth and efficient zooming and panning"
 * (2003), the curve MapLibre's flyTo follows. Between two close views far
 * apart it rises until both fit, then comes down; from far out onto a point it
 * closes the gap early, while that is still a small turn of the view.
 */

export interface FlyPath {
  /** Length of the path in the paper's units: about ln(zoom ratio) / rho for a plain zoom. */
  length: number;
  /** At progress k (0–1): the view's width, and how much of the gap is crossed (0–1). */
  at(k: number): { w: number; u: number };
}

/** `w0`/`w1`: the view's width at each end; `gap`: how far apart their centres are, in the same units. */
export function flyPath(w0: number, w1: number, gap: number, rho = 1.42): FlyPath {
  const rho2 = rho * rho;
  if (gap > 1e-9 * Math.max(w0, w1)) {
    // log(sqrt(b² + 1) − b), written as −asinh(b) so a zoom over twenty orders of magnitude stays exact.
    const r = (i: 0 | 1) => -Math.asinh((w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * gap * gap) / (2 * (i ? w1 : w0) * rho2 * gap));
    const r0 = r(0);
    const length = (r(1) - r0) / rho;
    if (Number.isFinite(length) && length > 0) {
      return {
        length,
        at(k) {
          const s = Math.min(1, Math.max(0, k)) * length;
          if (k >= 1) return { w: w1, u: 1 };
          return { w: w0 * Math.cosh(r0) / Math.cosh(r0 + rho * s), u: (w0 * (Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2) / gap };
        },
      };
    }
  }
  // No gap: a plain zoom, even in log space.
  const length = Math.abs(Math.log(w1 / w0)) / rho;
  return { length, at: k => ({ w: Math.exp(Math.log(w0) + (Math.log(w1) - Math.log(w0)) * Math.min(1, Math.max(0, k))), u: Math.min(1, Math.max(0, k)) }) };
}
