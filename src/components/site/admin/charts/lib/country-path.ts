type Ring = number[][];
type Geometry = { type: string; coordinates: unknown };
type Collection = { features: { geometry: Geometry | null }[] };

/** Country outlines as one SVG path in WORLD_LAND_PATH's frame (x = lon + 180, y = 90 - lat), to a twentieth of a degree. */
export function countryPath(fc: Collection): string {
  const fmt = (n: number) => String(Math.round(n * 20) / 20);
  const rings: string[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g?.type === 'Polygon' ? [g.coordinates as Ring[]] : g?.type === 'MultiPolygon' ? g.coordinates as Ring[][] : [];
    for (const poly of polys) for (const ring of poly) {
      const pts: string[] = [];
      for (const [lon, lat] of ring) {
        const p = `${fmt(lon + 180)} ${fmt(90 - lat)}`;
        if (pts[pts.length - 1] !== p) pts.push(p);
      }
      if (pts.length >= 3) rings.push(`M${pts.join('L')}Z`);
    }
  }
  return rings.join('');
}

let loading: Promise<string> | null = null;

/** The site's own country file (1 MB), fetched once a world map is zoomed or opened large. */
export function loadCountryPath(): Promise<string> {
  loading ??= fetch('/data/boundaries/countries.json')
    .then(res => {
      if (!res.ok) throw new Error(`countries: HTTP ${res.status}`);
      return res.json();
    })
    .then(countryPath)
    .catch(err => {
      loading = null;
      throw err;
    });
  return loading;
}
