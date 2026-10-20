import { msg, type Translate } from '@/lib/core/i18n/translator';
import { C_KM_S, norm } from '@/lib/space/astro';
import { CRAFT_MODELS } from '@/lib/space/craft/models';
import { REGION_LABEL, type FleetPayload } from '@/lib/space/craft/fleet';
import { age, distance, latLng, lightTime, speed } from '@/lib/space/format';
import { jdFromMs } from '@/lib/space/horizons';
import { LANDING_SITES, SITE_KIND_LABEL } from '@/lib/space/craft/landing-sites';
import type { SpaceSelection } from '@/lib/space/selection';
import { sampleAt, type SkyPayload } from '@/lib/space/sky';
import { trackAt, type SurfacePayload } from '@/lib/space/bodies/surface';
import type { CardData as Card } from './describe-deep';
import { REGION_COLOR } from '@/lib/space/scene/craft/layer';

/** Inspect cards for the solar system: planets and moons, spacecraft, landing sites, rovers and orbiters. */

const PHASES = [msg('New moon'), msg('Waxing crescent'), msg('First quarter'), msg('Waxing gibbous'), msg('Full moon'), msg('Waning gibbous'), msg('Last quarter'), msg('Waning crescent')];
const ROVER_PAGE: Record<string, string> = {
  perseverance: 'https://science.nasa.gov/mission/mars-2020-perseverance/location-map/',
  curiosity: 'https://science.nasa.gov/mission/msl-curiosity/location-map/',
};

/** What a speed is measured against: the body a craft is at, else the Sun. */
const SPEED_LABEL: Record<string, string> = {
  Sun: msg('Speed relative to the Sun'),
  Earth: msg('Speed relative to Earth'),
  Moon: msg('Speed relative to the Moon'),
  Mercury: msg('Speed relative to Mercury'),
  Venus: msg('Speed relative to Venus'),
  Mars: msg('Speed relative to Mars'),
  Jupiter: msg('Speed relative to Jupiter'),
  Saturn: msg('Speed relative to Saturn'),
};

export function describeNear(sel: SpaceSelection, now: number, sky: SkyPayload | null, fleet: FleetPayload | null, surfaces: Record<'moon' | 'mars', SurfacePayload | null>, t: Translate): Card | null {
  const jd = jdFromMs(now);
  if (sel.kind === 'body') {
    const b = sky?.bodies.find(x => x.key === sel.key);
    if (!b) return null;
    const s = sampleAt(b.track, jd);
    const fields: [string, string][] = [];
    if (s) fields.push([t('From Earth'), distance(s.km, t)], [t('Light time'), lightTime(s.km / C_KM_S, t)]);
    if (b.key !== 'sun') fields.push([t('From the Sun'), distance(norm(b.helio), t)], [t('Orbital speed'), speed(norm(b.vel), t)]);
    fields.push([t('Radius'), distance(b.radiusKm, t)]);
    if (b.key === 'moon' && s?.illum !== undefined && s.elong !== undefined) {
      fields.push([t('Phase'), t(PHASES[Math.floor(((s.elong + 22.5) % 360) / 45)])], [t('Lit'), new Intl.NumberFormat(t.intl, { style: 'percent', maximumFractionDigits: 0 }).format(s.illum)]);
    }
    if (s) fields.push([t('RA / Dec'), `${s.ra.toFixed(2)}° / ${s.dec.toFixed(2)}°`]);
    return {
      title: t(b.name),
      subtitle: b.kind === 'star' ? t('Star') : b.kind === 'moon' ? t("Earth's moon") : b.kind === 'dwarf' ? t('Dwarf planet') : t('Planet'),
      color: b.color, fields, source: t('JPL Horizons, worked out to this second'),
    };
  }
  if (sel.kind === 'craft') {
    const c = fleet?.craft.find(x => x.id === sel.id);
    if (!c) return null;
    const model = CRAFT_MODELS[c.id];
    return {
      title: c.name,
      subtitle: [t(REGION_LABEL[c.region]), c.agency].filter(Boolean).join(' · '),
      color: REGION_COLOR[c.region],
      fields: [
        [t('From Earth'), distance(c.earthKm, t)], [t('Light time'), lightTime(c.lightSec, t)],
        [t('From the Sun'), distance(c.sunKm, t)],
        [SPEED_LABEL[c.speedFrame] ? t(SPEED_LABEL[c.speedFrame]) : t('Speed relative to {body}', { body: c.speedFrame }), speed(c.speedKmS, t)],
        [t('Horizons ID'), String(c.id)], [t('COSPAR ID'), c.cospar ?? '—'],
      ],
      note: [c.summary && t(c.summary), c.ended ? t('Mission ended {year}; the craft is still out there.', { year: String(c.ended) }) : null].filter(Boolean).join(' ') || null,
      source: [t('JPL Horizons, {age}', { age: age(fleet!.epoch, now, t) }), model ? t('3D model by {credit}', { credit: model.credit }) : null].filter(Boolean).join(' · '),
      link: { href: `https://ssd.jpl.nasa.gov/horizons/app.html#/?sstr=${encodeURIComponent(String(c.id))}`, label: 'JPL Horizons' },
    };
  }
  if (sel.kind === 'site') {
    const s = LANDING_SITES[sel.world].find(x => x.id === sel.id);
    if (!s) return null;
    return { title: s.name, subtitle: `${t(SITE_KIND_LABEL[s.kind])} · ${s.agency}`, color: REGION_COLOR.interplanetary, fields: [[t('Landed'), String(s.year)], [t('Where'), latLng(s.lat, s.lng)]], note: s.note && t(s.note) };
  }
  if (sel.kind === 'rover') {
    const r = surfaces.mars?.rovers.find(x => x.key === sel.id);
    if (!r) return null;
    return {
      title: r.name, subtitle: t('Mars rover · {agency}', { agency: r.agency }), color: REGION_COLOR.mars,
      fields: [[t('Sol'), r.sol !== null ? String(r.sol) : '—'], [t('Driven'), r.driveKm !== null ? `${r.driveKm.toLocaleString(t.intl)} km` : '—'], [t('Where'), latLng(r.lat, r.lng)]],
      note: t('The line is its whole route since landing.'),
      source: t('The last drive NASA has published'),
      link: ROVER_PAGE[r.key] ? { href: ROVER_PAGE[r.key], label: t('NASA location map') } : undefined,
    };
  }
  if (sel.kind === 'orbiter') {
    const o = surfaces[sel.world]?.orbiters.find(x => x.id === sel.id);
    if (!o) return null;
    const p = trackAt(o.track, now);
    return {
      title: o.name,
      subtitle: sel.world === 'moon'
        ? (o.agency ? t('Lunar orbiter · {agency}', { agency: o.agency }) : t('Lunar orbiter'))
        : (o.agency ? t('Mars orbiter · {agency}', { agency: o.agency }) : t('Mars orbiter')),
      color: REGION_COLOR[sel.world],
      fields: p ? [[t('Altitude'), distance(p.altKm, t)], [t('Beneath'), latLng(p.lat, p.lng)]] : [],
      note: o.summary && t(o.summary), source: t('Ground track from JPL Horizons'),
    };
  }
  return null;
}
