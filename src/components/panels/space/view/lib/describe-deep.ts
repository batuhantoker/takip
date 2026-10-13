import { C_KM_S, LY_KM, norm, sub } from '@/lib/space/astro';
import { DEEP_FEATURES } from '@/lib/space/deep-features';
import type { ExoHost, PlanetRow } from '@/lib/space/exoplanets';
import { angleBetween, bodyDirection } from '@/lib/space/frames';
import { distance, lightTime, speed } from '@/lib/space/format';
import { jdFromMs, type Vec3 } from '@/lib/space/horizons';
import { absoluteMag, spectralClass, starLy, temperatureK } from '@/lib/space/nearby-stars';
import { VISITORS } from '@/lib/space/outer';
import type { SpaceSelection } from '@/lib/space/selection';
import type { SpaceScene } from '@/lib/space/scene/space-scene';

/** Inspect cards for what lies past the planets: stars, planet hosts, dwarf planets and visitors, models and galaxies. */

export interface CardData {
  title: string;
  subtitle: string;
  /** The thing's marker colour in the scene (lib/space/scene/deep-hud.ts), so the card's dot is the dot on screen. */
  color: string;
  fields: [string, string][];
  /** What it is: one or two plain sentences. */
  note?: string | null;
  /** Where the numbers come from and how fresh they are, set quieter than the note. */
  source?: string | null;
  link?: { href: string; label: string };
  /** Shown as a tag: the thing is a model, not a measurement. */
  illustration?: boolean;
}

const fmtMag = (m: number) => (m >= 0 ? '+' : '−') + Math.abs(m).toFixed(2);

function planetLine(p: PlanetRow): string {
  const [name, period, radius, mass, year] = p;
  const bits = [
    period !== null ? (period < 1000 ? `${period < 10 ? period.toFixed(2) : Math.round(period)}-day orbit` : `${(period / 365.25).toFixed(1)}-year orbit`) : null,
    radius !== null ? `${radius} Earth radii` : mass !== null ? `${mass < 50 ? mass : Math.round(mass)} Earth masses` : null,
  ].filter(Boolean);
  return `${name}${bits.length ? `: ${bits.join(', ')}` : ''} (${year})`;
}

function planetsNote(h: ExoHost): string {
  const shown = h.planets.slice(0, 6).map(planetLine);
  return `${shown.join('; ')}${h.planets.length > 6 ? `; and ${h.planets.length - 6} more` : ''}.`;
}

/** The archive host a catalogue star is, if any: within 0.1° and a quarter of its distance. */
export function hostOf(star: [number, number, number, number, number], hosts: ExoHost[]): ExoHost | null {
  const ly = starLy(star);
  const dir: Vec3 = [star[0] / ly, star[1] / ly, star[2] / ly];
  return hosts.find(h => h.ly < ly * 1.3 && h.ly > ly * 0.75 && angleBetween(dir, bodyDirection(h.dec, h.ra)) < 0.1) ?? null;
}

function raDecOf(v: Vec3): string {
  const n = norm(v);
  const ra = ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360, dec = (Math.asin(v[2] / n) * 180) / Math.PI;
  return `${ra.toFixed(2)}° / ${dec.toFixed(2)}°`;
}

export function describeDeep(sel: SpaceSelection, scene: SpaceScene | null, now: number): CardData | null {
  if (!scene) return null;
  const cam = scene.camera.position;
  const here = (p: { distanceTo: (v: typeof cam) => number }) => distance(p.distanceTo(cam));

  if (sel.kind === 'star') {
    const c = scene.nearby.catalog();
    const s = c?.stars[sel.index];
    if (!c || !s) return null;
    const ly = starLy(s);
    const uncertain = c.uncertain.includes(sel.index);
    const host = hostOf(s, scene.nearby.hosts());
    const id = c.ids[sel.index];
    const fields: [string, string][] = [
      ['From the Sun', uncertain ? 'Unknown' : distance(ly * LY_KM)], ['From here', here(scene.nearby.position(sel.index))],
      ['Apparent magnitude', fmtMag(s[3])], ['Absolute magnitude', uncertain ? '—' : fmtMag(absoluteMag(s[3], ly))],
      ['Temperature', `${(Math.round(temperatureK(s[4]) / 100) * 100).toLocaleString('en-US')} K`], ['RA / Dec', raDecOf([s[0], s[1], s[2]])],
    ];
    return {
      title: c.names[sel.index] ?? id,
      subtitle: `${spectralClass(s[4])} star${c.names[sel.index] ? ` · ${id}` : ''}`,
      color: '#E8E2CF',
      fields,
      note: [host ? `${host.planets.length} known planet${host.planets.length > 1 ? 's' : ''}: ${planetsNote(host)}` : null, uncertain ? 'No usable parallax: drawn at a nominal 3,000 light-years.' : null].filter(Boolean).join(' ') || null,
      source: uncertain ? null : id.startsWith('Gaia') ? 'Position and distance from the Gaia DR3 parallax' : 'Distance from the Hipparcos parallax (van Leeuwen 2007)',
      link: { href: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(c.names[sel.index] ?? id)}`, label: 'SIMBAD' },
    };
  }

  if (sel.kind === 'exohost') {
    const hosts = scene.nearby.hosts();
    const i = hosts.findIndex(h => h.name === sel.name);
    const h = hosts[i];
    if (!h) return null;
    return {
      title: h.name,
      subtitle: `${h.planets.length} known planet${h.planets.length > 1 ? 's' : ''}`,
      color: '#7CF7C4',
      fields: [['From the Sun', distance(h.ly * LY_KM)], ['From here', here(scene.nearby.hostPosition(i))], ['Apparent magnitude', h.vmag !== null ? fmtMag(h.vmag) : '—'], ['RA / Dec', `${h.ra.toFixed(2)}° / ${h.dec.toFixed(2)}°`]],
      note: planetsNote(h),
      source: 'NASA Exoplanet Archive',
      link: { href: `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(h.name)}`, label: 'Exoplanet Archive' },
    };
  }

  if (sel.kind === 'outer') {
    const b = scene.outer.bodies().find(x => x.key === sel.key);
    if (!b) return null;
    const jd = jdFromMs(now);
    const p = scene.outer.positionOf(b, jd);
    if (!p) return null;
    const earth = scene.model.bodyPos('earth', jd);
    const earthKm = earth ? norm(sub(p, earth)) : NaN;
    const visitor = VISITORS.find(v => v.key === b.key);
    return {
      title: b.name,
      subtitle: visitor ? `Interstellar object · ${visitor.designation}` : 'Dwarf planet',
      color: b.color,
      fields: [
        ['From the Sun', distance(norm(p))], ['From Earth', distance(earthKm)], ['Light time', lightTime(earthKm / C_KM_S)], ['Speed relative to the Sun', speed(norm(b.vel))],
        ...(visitor ? [['Perihelion', visitor.perihelion] as [string, string]] : [['Radius', `${b.radiusKm.toLocaleString('en-US')} km`] as [string, string]]),
      ],
      note: visitor ? `${visitor.note} Its line is the real path through the solar system, 1990–2060.` : null,
      source: visitor ? 'Path from JPL Horizons' : 'Position and orbit from JPL Horizons',
      link: { href: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(visitor?.designation ?? b.name)}`, label: 'JPL SBDB' },
    };
  }

  if (sel.kind === 'feature' && sel.id.startsWith('cosmos:')) {
    const m = scene.cosmos.meta();
    const st = m?.structures.find(x => `cosmos:${x.name}` === sel.id);
    const at = scene.cosmos.labels().find(l => l.id === sel.id);
    if (!m || !st || !at) return null;
    const ly = st.mly * 1e6;
    return {
      title: st.name, subtitle: /void/i.test(st.name) ? 'Cosmic void' : 'Large-scale structure', color: '#E6D9FF',
      fields: [['From the Sun', distance(ly * LY_KM)], ['From here', here(at.position)], ['Redshift', st.z.toFixed(4)], ['RA / Dec', `${st.ra.toFixed(2)}° / ${st.dec.toFixed(2)}°`]],
      note: `Placed by its redshift: comoving distance, ${m.cosmology}. The dots around it are 2MASS Redshift Survey galaxies (${m.local.count.toLocaleString('en-US')}) and SDSS galaxies and quasars (${m.deep.count.toLocaleString('en-US')} sampled).`,
    };
  }

  if (sel.kind === 'feature') {
    const f = DEEP_FEATURES[sel.id];
    if (!f) return null;
    const fields = [...(f.fields ?? [])];
    if (f.position) fields.push(['From here', distance(norm(sub(f.position, [cam.x, cam.y, cam.z])))]);
    return { title: f.name, subtitle: f.subtitle, color: f.illustration ? '#A9B8D6' : '#C9CFFF', fields, note: f.note, source: f.credit ? `Image: ${f.credit}` : null, illustration: f.illustration };
  }
  return null;
}
