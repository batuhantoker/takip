/**
 * TAKIP — known planets around other stars, from the NASA Exoplanet Archive's
 * composite parameters table (one row per planet), grouped by host star.
 */

const PC_LY = 3.26156;

/** [name, orbital period (days), radius (Earth radii), mass (Earth masses), discovery year, method]; nulls where unmeasured. */
export type PlanetRow = [string, number | null, number | null, number | null, number, string];

export interface ExoHost {
  name: string;
  /** J2000 degrees. */
  ra: number;
  dec: number;
  ly: number;
  vmag: number | null;
  planets: PlanetRow[];
}

export interface ExoplanetPayload {
  fetched: string;
  planets: number;
  /** Nearest first. */
  hosts: ExoHost[];
}

/** One CSV line with double-quoted fields, as the archive's TAP service writes them. */
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const num = (s: string | undefined) => (s === undefined || s === '' ? null : Number.isFinite(Number(s)) ? Number(s) : null);
const round = (x: number | null, d: number) => (x === null ? null : +x.toFixed(d));

/** Rows with columns pl_name, hostname, ra, dec, sy_dist, sy_vmag, pl_orbper, pl_rade, pl_bmasse, disc_year, discoverymethod. */
export function groupHosts(csv: string): ExoHost[] {
  const [header, ...lines] = csv.trim().split('\n');
  const cols = splitCsv(header);
  const at = (f: string[], c: string) => f[cols.indexOf(c)];
  const hosts = new Map<string, ExoHost>();
  for (const line of lines) {
    const f = splitCsv(line);
    const dist = num(at(f, 'sy_dist')), ra = num(at(f, 'ra')), dec = num(at(f, 'dec'));
    const name = at(f, 'hostname');
    if (dist === null || ra === null || dec === null || !name) continue;
    let h = hosts.get(name);
    if (!h) hosts.set(name, h = { name, ra: +ra.toFixed(5), dec: +dec.toFixed(5), ly: +(dist * PC_LY).toFixed(2), vmag: round(num(at(f, 'sy_vmag')), 2), planets: [] });
    h.planets.push([at(f, 'pl_name'), round(num(at(f, 'pl_orbper')), 3), round(num(at(f, 'pl_rade')), 2), round(num(at(f, 'pl_bmasse')), 2), num(at(f, 'disc_year')) ?? 0, at(f, 'discoverymethod') ?? '']);
  }
  return [...hosts.values()].sort((a, b) => a.ly - b.ly);
}
