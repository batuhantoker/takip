'use client';

import { ExternalLink, Navigation, PlayCircle, X } from 'lucide-react';
import { C_KM_S, norm } from '@/lib/space/astro';
import { REGION_LABEL, type FleetPayload } from '@/lib/space/fleet';
import { age, distance, latLng, lightTime, speed } from '@/lib/space/format';
import { jdFromMs } from '@/lib/space/horizons';
import { LANDING_SITES, SITE_KIND_LABEL } from '@/lib/space/landing-sites';
import type { SpaceSelection } from '@/lib/space/selection';
import { sampleAt, type SkyPayload } from '@/lib/space/sky';
import { trackAt, type SurfacePayload } from '@/lib/space/surface';
import { CRAFT_MODELS } from '@/lib/space/craft-models';
import { wikiTopic } from '@/lib/space/wiki-topic';
import { describeDeep, type CardData as Card } from './describe-deep';
import { useWiki } from './use-wiki';
import type { SpaceScene } from './scene/space-scene';

/** The space view's inspect card: what the selected thing is, and where it is right now. */

const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
const ROVER_PAGE: Record<string, string> = {
  perseverance: 'https://science.nasa.gov/mission/mars-2020-perseverance/location-map/',
  curiosity: 'https://science.nasa.gov/mission/msl-curiosity/location-map/',
};

function describe(sel: SpaceSelection, now: number, sky: SkyPayload | null, fleet: FleetPayload | null, surfaces: Record<'moon' | 'mars', SurfacePayload | null>): Card | null {
  const jd = jdFromMs(now);
  if (sel.kind === 'body') {
    const b = sky?.bodies.find(x => x.key === sel.key);
    if (!b) return null;
    const s = sampleAt(b.track, jd);
    const fields: [string, string][] = [];
    if (s) fields.push(['FROM EARTH', distance(s.km)], ['LIGHT TIME', lightTime(s.km / C_KM_S)]);
    if (b.key !== 'sun') fields.push(['FROM SUN', distance(norm(b.helio))], ['ORBITAL SPEED', speed(norm(b.vel))]);
    fields.push(['RADIUS', distance(b.radiusKm)]);
    if (b.key === 'moon' && s?.illum !== undefined && s.elong !== undefined) {
      fields.push(['PHASE', PHASES[Math.floor(((s.elong + 22.5) % 360) / 45)]], ['LIT', `${Math.round(s.illum * 100)}%`]);
    }
    if (s) fields.push(['RA / DEC', `${s.ra.toFixed(2)}° / ${s.dec.toFixed(2)}°`]);
    return { title: b.name, subtitle: b.kind === 'star' ? 'Star' : b.kind === 'moon' ? "Earth's moon" : b.kind === 'dwarf' ? 'Dwarf planet' : 'Planet', color: b.color, fields, note: 'Position from JPL Horizons, interpolated to this second.' };
  }
  if (sel.kind === 'craft') {
    const c = fleet?.craft.find(x => x.id === sel.id);
    if (!c) return null;
    return {
      title: c.name,
      subtitle: [REGION_LABEL[c.region], c.agency].filter(Boolean).join(' · '),
      color: '#F0D060',
      fields: [
        ['FROM EARTH', distance(c.earthKm)], ['LIGHT TIME', lightTime(c.lightSec)],
        ['FROM SUN', distance(c.sunKm)], [`SPEED (${c.speedFrame.toUpperCase()})`, speed(c.speedKmS)],
        ['HORIZONS ID', String(c.id)], ['COSPAR', c.cospar ?? '—'],
      ],
      note: [c.summary, c.ended ? `Mission ended ${c.ended}; the craft is still out there.` : null, `JPL Horizons, ${age(fleet!.epoch, now)}.`, CRAFT_MODELS[c.id] ? `3D model: ${CRAFT_MODELS[c.id].credit}.` : null].filter(Boolean).join(' '),
      link: { href: `https://ssd.jpl.nasa.gov/horizons/app.html#/?sstr=${encodeURIComponent(String(c.id))}`, label: 'OPEN IN JPL HORIZONS' },
    };
  }
  if (sel.kind === 'site') {
    const s = LANDING_SITES[sel.world].find(x => x.id === sel.id);
    if (!s) return null;
    return { title: s.name, subtitle: `${SITE_KIND_LABEL[s.kind]} · ${s.agency}`, color: '#F0D060', fields: [['LANDED', String(s.year)], ['WHERE', latLng(s.lat, s.lng)]], note: s.note };
  }
  if (sel.kind === 'star' || sel.kind === 'exohost' || sel.kind === 'outer' || sel.kind === 'feature') return null;
  if (sel.kind === 'rover') {
    const r = surfaces.mars?.rovers.find(x => x.key === sel.id);
    if (!r) return null;
    return {
      title: r.name, subtitle: `Mars rover · ${r.agency}`, color: '#FF9500',
      fields: [['SOL', r.sol !== null ? String(r.sol) : '—'], ['DRIVEN', r.driveKm !== null ? `${r.driveKm} km` : '—'], ['WHERE', latLng(r.lat, r.lng)]],
      note: "Last drive NASA has published; the line is its whole route since landing.",
      link: ROVER_PAGE[r.key] ? { href: ROVER_PAGE[r.key], label: 'NASA LOCATION MAP' } : undefined,
    };
  }
  const o = surfaces[sel.world]?.orbiters.find(x => x.id === sel.id);
  if (!o) return null;
  const p = trackAt(o.track, now);
  return {
    title: o.name, subtitle: `${sel.world === 'moon' ? 'Lunar' : 'Mars'} orbiter${o.agency ? ` · ${o.agency}` : ''}`, color: '#7CF7C4',
    fields: p ? [['ALTITUDE', distance(p.altKm)], ['BENEATH', latLng(p.lat, p.lng)]] : [],
    note: [o.summary, 'Ground track from JPL Horizons.'].filter(Boolean).join(' '),
  };
}

export default function SpaceCard({ selection, now, sky, fleet, surfaces, scene, onClose, onFly, onReplay }: {
  selection: SpaceSelection;
  now: number;
  sky: SkyPayload | null;
  fleet: FleetPayload | null;
  surfaces: Record<'moon' | 'mars', SurfacePayload | null>;
  scene: SpaceScene | null;
  onClose: () => void;
  onFly: () => void;
  /** Plays back the craft's whole flight. */
  onReplay?: () => void;
}) {
  const card = describe(selection, now, sky, fleet, surfaces) ?? describeDeep(selection, scene, now);
  const wiki = useWiki(card ? wikiTopic(selection, card.title) : null);
  if (!card) return null;
  return (
    <div role="dialog" aria-label={card.title} className="pointer-events-auto w-[260px] overflow-hidden rounded-lg border bg-[var(--bg-panel)] shadow-[0_6px_20px_rgba(0,0,0,0.45)] backdrop-blur-2xl" style={{ borderColor: `${card.color}33` }}>
      <div className="h-px w-full" style={{ background: `${card.color}99` }} />
      {wiki?.image && (
        <a href={wiki.url} target="_blank" rel="noopener noreferrer" title={`${wiki.title} on Wikipedia`} className="relative block h-[132px] overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnails, sized by the API */}
          <img src={wiki.image.src} alt={wiki.title} loading="lazy" className="h-full w-full object-cover opacity-90" />
          <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--bg-panel)] to-transparent" />
        </a>
      )}
      <div className="flex items-start gap-2 px-2.5 pt-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold leading-tight tracking-wide text-[var(--text-heading)]" title={card.title}>{card.title}</div>
          <div className="flex items-center gap-1.5 truncate text-[10px] text-[var(--text-secondary)]">
            {card.illustration && <span className="flex-shrink-0 rounded border border-white/15 px-1 text-[8px] font-mono tracking-[0.12em] text-[var(--text-muted)]">ILLUSTRATION</span>}
            <span className="truncate">{card.subtitle}</span>
          </div>
        </div>
        <button onClick={onFly} title="Fly here" aria-label="Fly here" className="flex-shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white">
          <Navigation className="h-3 w-3" />
        </button>
        <button onClick={onClose} title="Close" aria-label="Close" className="-mr-1 flex-shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white">
          <X className="h-3 w-3" />
        </button>
      </div>
      {card.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 px-2.5 py-2.5">
          {card.fields.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="text-[8px] font-mono tracking-[0.15em] text-[var(--text-muted)]">{label}</div>
              <div className="truncate text-[11px] font-mono tabular-nums text-[var(--text-primary)]" title={value}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {card.note && <p className="border-t border-[var(--border-secondary)] px-2.5 py-2 text-[10px] leading-snug text-[var(--text-secondary)]">{card.note}</p>}
      {wiki?.extract && (
        <div className="border-t border-[var(--border-secondary)] px-2.5 py-2">
          <p className="line-clamp-4 text-[10px] leading-snug text-[var(--text-secondary)]" title={wiki.extract}>{wiki.extract}</p>
          <a href={wiki.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[9px] font-mono tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            WIKIPEDIA <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      )}
      {onReplay && (
        <button type="button" onClick={onReplay} className="flex w-full items-center justify-center gap-1.5 border-t px-2.5 py-2 text-[9px] font-mono tracking-[0.15em] transition-colors hover:bg-white/[0.04]" style={{ borderColor: 'var(--border-secondary)', color: '#F0D060' }}>
          <PlayCircle className="h-3 w-3" /> WATCH THE FLIGHT
        </button>
      )}
      {card.link && (
        <a href={card.link.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 border-t px-2.5 py-2 text-[9px] font-mono tracking-[0.15em] transition-colors" style={{ borderColor: 'var(--border-secondary)', color: card.color, background: `${card.color}0a` }}>
          {card.link.label} <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  );
}
