import type { Translate } from '@/lib/core/i18n/translator';
import { C_KM_S, LY_KM, norm, sub } from '@/lib/space/astro';
import { BASINS, NEARBY_VOIDS } from '@/lib/space/deep/basins.generated';
import { NEARBY_VOID_NAMES } from '@/lib/space/deep/cosmic-web';
import { deepSkyImage, deepSkyObject, deepSkyUrl, picturedFeature } from '@/lib/space/deep/deep-sky';
import { DEEP_FEATURES } from '@/lib/space/deep/features';
import type { ExoHost, PlanetRow } from '@/lib/space/deep/exoplanets';
import { angleBetween, bodyDirection } from '@/lib/space/frames';
import { compact, distance, lightTime, magnitude, speed } from '@/lib/space/format';
import { jdFromMs, type Vec3 } from '@/lib/space/horizons';
import { absoluteMag, spectralClass, starLy, temperatureK } from '@/lib/space/deep/nearby-stars';
import { VISITORS } from '@/lib/space/deep/outer';
import type { SpaceSelection } from '@/lib/space/selection';
import { basinColor, SUPERCLUSTER_COLOR, VOID_COLOR } from '@/lib/space/scene/deep/cosmic-web';
import { superclusterName } from '@/lib/space/scene/hud/deep-targets';
import { KIND_COLOR } from '@/lib/space/scene/deep/deep-sky';
import type { SpaceScene } from '@/lib/space/scene/space-scene';

/** Inspect cards for what lies past the planets: stars, planet hosts, dwarf planets and visitors, models and galaxies. */

export interface CardData {
  title: string;
  subtitle: string;
  /** The thing's marker colour in the scene (lib/space/scene/hud/deep-targets.ts), so the card's dot is the dot on screen. */
  color: string;
  fields: [string, string][];
  /** What it is: one or two plain sentences. */
  note?: string | null;
  /** Where the numbers come from and how fresh they are, set quieter than the note. */
  source?: string | null;
  link?: { href: string; label: string };
  /** Shown as a tag: the thing is a model, not a measurement. */
  illustration?: boolean;
  /** The telescope picture the scene hangs there, shown in place of Wikipedia's. */
  picture?: { src: string; href: string };
}

function planetLine(p: PlanetRow, t: Translate): string {
  const [name, period, radius, mass, year] = p;
  const bits = [
    period !== null ? (period < 1000 ? t('{n}-day orbit', { n: period < 10 ? +period.toFixed(2) : Math.round(period) }) : t('{n}-year orbit', { n: +(period / 365.25).toFixed(1) })) : null,
    radius !== null ? t('{n} Earth radii', { n: radius }) : mass !== null ? t('{n} Earth masses', { n: mass < 50 ? mass : Math.round(mass) }) : null,
  ].filter(Boolean);
  return `${name}${bits.length ? `: ${bits.join(', ')}` : ''} (${year})`;
}

function planetsNote(h: ExoHost, t: Translate): string {
  const shown = h.planets.slice(0, 6).map(p => planetLine(p, t));
  return `${shown.join('; ')}${h.planets.length > 6 ? `; ${t('and {n} more', { n: h.planets.length - 6 })}` : ''}.`;
}

/** The archive host a catalogue star is, if any: within 0.1° and a quarter of its distance. */
export function hostOf(star: [number, number, number, number, number], hosts: ExoHost[]): ExoHost | null {
  const ly = starLy(star);
  const dir: Vec3 = [star[0] / ly, star[1] / ly, star[2] / ly];
  return hosts.find(h => h.ly < ly * 1.3 && h.ly > ly * 0.75 && angleBetween(dir, bodyDirection(h.dec, h.ra)) < 0.1) ?? null;
}

function archiveName(page: string): string {
  const host = new URL(page).hostname;
  return host.includes('esawebb') ? 'ESA/Webb' : host.includes('esahubble') ? 'ESA/Hubble' : host.includes('eso.org') ? 'ESO' : host.includes('noirlab') ? 'NOIRLab' : 'Aladin';
}

function raDecOf(v: Vec3): string {
  const n = norm(v);
  const ra = ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360, dec = (Math.asin(v[2] / n) * 180) / Math.PI;
  return `${ra.toFixed(2)}° / ${dec.toFixed(2)}°`;
}

export function describeDeep(sel: SpaceSelection, scene: SpaceScene | null, now: number, t: Translate): CardData | null {
  if (!scene) return null;
  const cam = scene.camera.position;
  const here = (p: { distanceTo: (v: typeof cam) => number }) => distance(p.distanceTo(cam), t);

  if (sel.kind === 'star') {
    const c = scene.nearby.catalog();
    const s = c?.stars[sel.index];
    if (!c || !s) return null;
    const ly = starLy(s);
    const uncertain = c.uncertain.includes(sel.index);
    const host = hostOf(s, scene.nearby.hosts());
    const id = c.ids[sel.index];
    const fields: [string, string][] = [
      [t('From the Sun'), uncertain ? t('Unknown') : distance(ly * LY_KM, t)], [t('From here'), here(scene.nearby.position(sel.index))],
      [t('Apparent magnitude'), magnitude(s[3], t)], [t('Absolute magnitude'), uncertain ? '—' : magnitude(absoluteMag(s[3], ly), t)],
      [t('Temperature'), `${(Math.round(temperatureK(s[4]) / 100) * 100).toLocaleString(t.intl)} K`], [t('RA / Dec'), raDecOf([s[0], s[1], s[2]])],
    ];
    const spectral = t('{class} star', { class: spectralClass(s[4]) });
    return {
      title: c.names[sel.index] ?? id,
      subtitle: c.names[sel.index] ? `${spectral} · ${id}` : spectral,
      color: '#E8E2CF',
      fields,
      note: [
        host ? t('{n, plural, one {# known planet} other {# known planets}}: {planets}', { n: host.planets.length, planets: planetsNote(host, t) }) : null,
        uncertain ? t('No usable parallax: drawn at a nominal 3,000 light-years.') : null,
      ].filter(Boolean).join(' ') || null,
      source: uncertain ? null : id.startsWith('Gaia') ? t('Position and distance from the Gaia DR3 parallax') : t('Distance from the Hipparcos parallax (van Leeuwen 2007)'),
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
      subtitle: t('{n, plural, one {# known planet} other {# known planets}}', { n: h.planets.length }),
      color: '#7CF7C4',
      fields: [[t('From the Sun'), distance(h.ly * LY_KM, t)], [t('From here'), here(scene.nearby.hostPosition(i))], [t('Apparent magnitude'), h.vmag !== null ? magnitude(h.vmag, t) : '—'], [t('RA / Dec'), `${h.ra.toFixed(2)}° / ${h.dec.toFixed(2)}°`]],
      note: planetsNote(h, t),
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
      subtitle: visitor ? t('Interstellar object · {designation}', { designation: visitor.designation }) : t('Dwarf planet'),
      color: b.color,
      fields: [
        [t('From the Sun'), distance(norm(p), t)], [t('From Earth'), distance(earthKm, t)], [t('Light time'), lightTime(earthKm / C_KM_S, t)], [t('Speed relative to the Sun'), speed(norm(b.vel), t)],
        ...(visitor ? [[t('Perihelion'), visitor.perihelion] as [string, string]] : [[t('Radius'), `${b.radiusKm.toLocaleString(t.intl)} km`] as [string, string]]),
      ],
      note: visitor ? `${t(visitor.note)} ${t('Its line is the real path through the solar system, 1990–2060.')}` : null,
      source: visitor ? t('Path from JPL Horizons') : t('Position and orbit from JPL Horizons'),
      link: { href: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(visitor?.designation ?? b.name)}`, label: 'JPL SBDB' },
    };
  }

  if (sel.kind === 'feature' && sel.id.startsWith('scl:')) {
    const i = Number(sel.id.slice(4));
    const s = scene.web.superclusters()[i];
    if (!s) return null;
    const at = scene.web.superclusterCentre(i);
    return {
      title: superclusterName(scene, i) ?? t('Supercluster'), subtitle: t('A wall of galaxy groups and clusters'), color: SUPERCLUSTER_COLOR,
      fields: [
        [t('From the Sun'), distance(at.length(), t)], [t('Across'), t('about {size}', { size: `${compact(2 * s[3] * 1e6, t.intl)} ly` })],
        [t('Galaxies seen'), s[4].toLocaleString(t.intl)], [t('From here'), here(at)], [t('RA / Dec'), raDecOf([s[0], s[1], s[2]])],
      ],
      note: t('One of the largest structures in the universe: groups and clusters of galaxies held loosely together along the walls between voids. Its glow is drawn to its size; the galaxies counted are the ones bright enough for the SDSS survey to measure.'),
      source: t('Liivamägi et al. 2012, SDSS DR7 superclusters'),
    };
  }

  if (sel.kind === 'feature' && sel.id.startsWith('void:')) {
    const i = Number(sel.id.slice(5));
    const v = scene.web.voids()[i];
    if (!v) return null;
    const nearby = v.nearby !== undefined ? NEARBY_VOIDS[v.nearby] : null;
    const at = scene.web.voidCentre(i);
    const mly = (n: number) => `${compact(n * 1e6, t.intl)} ly`;
    const card = {
      sdss: {
        title: i === scene.web.bootes() ? t('Boötes Void') : t('Cosmic void'), subtitle: t('A void in the cosmic web'),
        note: t('A vast region with few galaxies, walled by the filaments around it. Its outline is the ellipsoid fitted to the void found in the SDSS galaxy survey: voids fill most of the universe\'s volume, the galaxies its walls and threads.'),
        source: t('Douglass et al. 2023, SDSS DR7 voids (V2, VIDE), Planck 2018'),
      },
      network: {
        title: t('Cosmic void'), subtitle: t('Between the superclusters'),
        note: t('One of the great voids between the rich galaxy clusters that outline the supercluster network, mapped over the whole sky. Drawn as a sphere across its narrowest width, so it is at least this big.'),
        source: t('Einasto et al. 1994, the supercluster-void network'),
      },
      quaia: {
        title: t('Supervoid'), subtitle: t('Among the quasars, billions of light-years out'),
        note: t('A huge underdense region found among the quasars of the Gaia Quaia catalogue, which covers the whole sky. Its light left it billions of years ago; it is drawn as the sphere of its volume, at its distance now.'),
        source: t('Arsenov et al. 2025, voids in Gaia Quaia (ZOBOV)'),
      },
      local: {
        title: nearby ? t(NEARBY_VOID_NAMES[nearby.name]) : t('Cosmic void'), subtitle: t('One of the 25 nearest voids'),
        note: t('A region with no bright galaxies, one of the 25 voids within 80 million light-years that Pustilnik et al. (2019) mapped over the whole sky, walled by galaxies brighter than absolute K magnitude −22. It is a cluster of overlapping empty spheres, drawn as the ellipsoid spanning its extent along the supergalactic axes.'),
        source: t('Pustilnik et al. 2019, nearby voids'),
      },
    }[v.catalogue];
    return {
      ...card, color: VOID_COLOR[v.catalogue],
      fields: [
        [t('From the Sun'), distance(at.length(), t)], [t('Across'), t('about {size}', { size: mly(2 * v.reffMly) })],
        ...(nearby ? [[t('Galaxies inside'), t('{n}, mostly dwarfs', { n: nearby.galaxies })] as [string, string]] : []),
        [t('From here'), here(at)], [t('RA / Dec'), raDecOf(v.centre)],
      ],
    };
  }

  if (sel.kind === 'feature' && sel.id.startsWith('cosmos:')) {
    const m = scene.cosmos.meta();
    const st = m?.structures.find(x => `cosmos:${x.name}` === sel.id);
    const at = scene.cosmos.labels().find(l => l.id === sel.id);
    if (!m || !st || !at) return null;
    const ly = st.mly * 1e6;
    return {
      title: st.name, subtitle: /void/i.test(st.name) ? t('Cosmic void') : t('Large-scale structure'), color: '#E6D9FF',
      fields: [[t('From the Sun'), distance(ly * LY_KM, t)], [t('From here'), here(at.position)], [t('Redshift'), st.z.toLocaleString(t.intl, { minimumFractionDigits: 4, maximumFractionDigits: 4 })], [t('RA / Dec'), `${st.ra.toFixed(2)}° / ${st.dec.toFixed(2)}°`]],
      note: t('Placed by its redshift: comoving distance, {cosmology}. The dots around it are 2MASS Redshift Survey galaxies ({local}) and SDSS galaxies and quasars ({deep} sampled).', { cosmology: m.cosmology, local: m.local.count, deep: m.deep.count }),
    };
  }

  if (sel.kind === 'feature') {
    const f = DEEP_FEATURES[sel.id];
    if (!f) return null;
    const fields: [string, string][] = f.fields?.(t) ?? [];
    if (f.position) fields.push([t('From here'), distance(norm(sub(f.position, [cam.x, cam.y, cam.z])), t)]);
    const placed = picturedFeature(sel.id);
    const picture = placed?.image ?? deepSkyImage(sel.id);
    const pictured = deepSkyObject(sel.id);
    const basin = BASINS.find(b => b.id === sel.id);
    return {
      title: t(f.name), subtitle: t(f.subtitle, f.subtitleVars), color: pictured && !pictured.feature ? KIND_COLOR[pictured.kind] : basin ? basinColor(basin) : f.illustration ? '#A9B8D6' : '#C9CFFF', fields,
      note: f.footnote ? `${t(f.note)} ${t(f.footnote)}` : t(f.note),
      source: f.credit ? t('Image: {credit}', { credit: f.credit }) : null, illustration: f.illustration,
      ...(picture ? { link: { href: picture.page, label: archiveName(picture.page) } } : {}),
      ...(placed ? { picture: { src: deepSkyUrl(placed.object.id), href: placed.image.page } } : {}),
    };
  }
  return null;
}
