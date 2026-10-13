import { C_KM_S, norm } from '@/lib/space/astro';
import { CRAFT_MODELS } from '@/lib/space/craft-models';
import { REGION_LABEL, type FleetPayload } from '@/lib/space/fleet';
import { age, distance, latLng, lightTime, speed } from '@/lib/space/format';
import { jdFromMs } from '@/lib/space/horizons';
import { LANDING_SITES, SITE_KIND_LABEL } from '@/lib/space/landing-sites';
import type { SpaceSelection } from '@/lib/space/selection';
import { sampleAt, type SkyPayload } from '@/lib/space/sky';
import { trackAt, type SurfacePayload } from '@/lib/space/surface';
import type { CardData as Card } from './describe-deep';
import { REGION_COLOR } from '@/lib/space/scene/craft';

/** Inspect cards for the solar system: planets and moons, spacecraft, landing sites, rovers and orbiters. */

const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
const ROVER_PAGE: Record<string, string> = {
  perseverance: 'https://science.nasa.gov/mission/mars-2020-perseverance/location-map/',
  curiosity: 'https://science.nasa.gov/mission/msl-curiosity/location-map/',
};

/** "Earth", "the Moon", "the Sun": what a speed is measured against. */
const against = (frame: string) => (frame === 'Sun' || frame === 'Moon' ? `the ${frame}` : frame);

export function describeNear(sel: SpaceSelection, now: number, sky: SkyPayload | null, fleet: FleetPayload | null, surfaces: Record<'moon' | 'mars', SurfacePayload | null>): Card | null {
  const jd = jdFromMs(now);
  if (sel.kind === 'body') {
    const b = sky?.bodies.find(x => x.key === sel.key);
    if (!b) return null;
    const s = sampleAt(b.track, jd);
    const fields: [string, string][] = [];
    if (s) fields.push(['From Earth', distance(s.km)], ['Light time', lightTime(s.km / C_KM_S)]);
    if (b.key !== 'sun') fields.push(['From the Sun', distance(norm(b.helio))], ['Orbital speed', speed(norm(b.vel))]);
    fields.push(['Radius', distance(b.radiusKm)]);
    if (b.key === 'moon' && s?.illum !== undefined && s.elong !== undefined) {
      fields.push(['Phase', PHASES[Math.floor(((s.elong + 22.5) % 360) / 45)]], ['Lit', `${Math.round(s.illum * 100)}%`]);
    }
    if (s) fields.push(['RA / Dec', `${s.ra.toFixed(2)}° / ${s.dec.toFixed(2)}°`]);
    return {
      title: b.name,
      subtitle: b.kind === 'star' ? 'Star' : b.kind === 'moon' ? "Earth's moon" : b.kind === 'dwarf' ? 'Dwarf planet' : 'Planet',
      color: b.color, fields, source: 'JPL Horizons, worked out to this second',
    };
  }
  if (sel.kind === 'craft') {
    const c = fleet?.craft.find(x => x.id === sel.id);
    if (!c) return null;
    const model = CRAFT_MODELS[c.id];
    return {
      title: c.name,
      subtitle: [REGION_LABEL[c.region], c.agency].filter(Boolean).join(' · '),
      color: REGION_COLOR[c.region],
      fields: [
        ['From Earth', distance(c.earthKm)], ['Light time', lightTime(c.lightSec)],
        ['From the Sun', distance(c.sunKm)], [`Speed relative to ${against(c.speedFrame)}`, speed(c.speedKmS)],
        ['Horizons ID', String(c.id)], ['COSPAR ID', c.cospar ?? '—'],
      ],
      note: [c.summary, c.ended ? `Mission ended ${c.ended}; the craft is still out there.` : null].filter(Boolean).join(' ') || null,
      source: [`JPL Horizons, ${age(fleet!.epoch, now)}`, model ? `3D model by ${model.credit}` : null].filter(Boolean).join(' · '),
      link: { href: `https://ssd.jpl.nasa.gov/horizons/app.html#/?sstr=${encodeURIComponent(String(c.id))}`, label: 'JPL Horizons' },
    };
  }
  if (sel.kind === 'site') {
    const s = LANDING_SITES[sel.world].find(x => x.id === sel.id);
    if (!s) return null;
    return { title: s.name, subtitle: `${SITE_KIND_LABEL[s.kind]} · ${s.agency}`, color: REGION_COLOR.interplanetary, fields: [['Landed', String(s.year)], ['Where', latLng(s.lat, s.lng)]], note: s.note };
  }
  if (sel.kind === 'rover') {
    const r = surfaces.mars?.rovers.find(x => x.key === sel.id);
    if (!r) return null;
    return {
      title: r.name, subtitle: `Mars rover · ${r.agency}`, color: REGION_COLOR.mars,
      fields: [['Sol', r.sol !== null ? String(r.sol) : '—'], ['Driven', r.driveKm !== null ? `${r.driveKm} km` : '—'], ['Where', latLng(r.lat, r.lng)]],
      note: 'The line is its whole route since landing.',
      source: 'The last drive NASA has published',
      link: ROVER_PAGE[r.key] ? { href: ROVER_PAGE[r.key], label: 'NASA location map' } : undefined,
    };
  }
  if (sel.kind === 'orbiter') {
    const o = surfaces[sel.world]?.orbiters.find(x => x.id === sel.id);
    if (!o) return null;
    const p = trackAt(o.track, now);
    return {
      title: o.name, subtitle: `${sel.world === 'moon' ? 'Lunar' : 'Mars'} orbiter${o.agency ? ` · ${o.agency}` : ''}`, color: REGION_COLOR[sel.world],
      fields: p ? [['Altitude', distance(p.altKm)], ['Beneath', latLng(p.lat, p.lng)]] : [],
      note: o.summary, source: 'Ground track from JPL Horizons',
    };
  }
  return null;
}
