'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronRight, Orbit, PlayCircle, Search } from 'lucide-react';
import { LY_KM } from '@/lib/space/astro';
import type { ExoHost } from '@/lib/space/exoplanets';
import PanelCard from '@/components/shell/panel-card';
import { REGION_LABEL, REGION_ORDER, type FleetCraft, type Region } from '@/lib/space/fleet';
import { age, distance, lightTime } from '@/lib/space/format';
import { requestWorld } from '@/lib/space/world-events';
import { useExoplanets, useFleet } from './use-space-data';

const SpaceCam = dynamic(() => import('@/components/cameras/space-cam'), { ssr: false });

/**
 * TAKIP — the Space panel: every spacecraft JPL Horizons can place right now,
 * by where it is, each one a click from the space view; the stars known to
 * have planets; and the ISS live feed.
 */

const COLLAPSED: Region[] = ['earth-orbit'];
const HOSTS_SHOWN = 200;

function CraftRow({ c }: { c: FleetCraft }) {
  const show = () => requestWorld({ focus: c.region === 'moon' ? 'moon' : c.region === 'mars' ? 'mars' : c.region === 'earth-orbit' || c.region === 'cislunar' ? 'earth' : 'solar', select: { kind: 'craft', id: c.id } });
  const replay = () => requestWorld({ focus: 'solar', replay: c.id });
  return (
    <div className="group flex items-center rounded-md hover:bg-white/[0.05]">
      <button type="button" onClick={show} title={c.summary ?? `Show ${c.name} in space`}
        className="min-w-0 flex-1 flex items-center gap-2 px-2 py-1.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-md">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[12px] ${c.ended ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{c.name}</span>
          <span className="block truncate text-[10px] text-[var(--text-muted)]">{[c.agency, c.ended ? `ended ${c.ended}` : null].filter(Boolean).join(' · ') || `Horizons ${c.id}`}</span>
        </span>
        <span className="text-right">
          <span className="block text-[11px] font-mono tabular-nums text-[var(--text-primary)]">{distance(c.earthKm)}</span>
          <span className="block text-[9px] font-mono tabular-nums text-[var(--text-muted)]">{lightTime(c.lightSec)} light</span>
        </span>
      </button>
      {c.region !== 'earth-orbit' && (
        <button type="button" onClick={replay} title={`Watch ${c.name}'s flight`} aria-label={`Watch ${c.name}'s flight`}
          className="mr-1 h-7 w-7 flex-shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] opacity-60 hover:opacity-100 hover:text-[#F0D060] group-hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40">
          <PlayCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Missions() {
  const fleet = useFleet(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<Region>>(new Set());
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const craft = (fleet?.craft ?? []).filter(c => !q || `${c.name} ${c.agency ?? ''} ${c.cospar ?? ''}`.toLowerCase().includes(q));
    return REGION_ORDER.map(r => ({ region: r, craft: craft.filter(c => c.region === r) })).filter(g => g.craft.length);
  }, [fleet, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2 pt-3">
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 h-8">
          <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a spacecraft" aria-label="Find a spacecraft"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none" />
        </label>
        <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
          {fleet ? `${fleet.craft.length} craft with a live JPL Horizons ephemeris · ${age(fleet.epoch)}${fleet.pending ? ` · ${fleet.pending} still loading` : ''}` : 'Asking JPL Horizons…'}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto styled-scrollbar px-1.5 pb-3">
        {groups.map(({ region, craft }) => {
          const expanded = query ? true : COLLAPSED.includes(region) ? open.has(region) : !open.has(region);
          return (
            <section key={region} className="mb-1">
              <button type="button" onClick={() => setOpen(s => { const n = new Set(s); if (n.has(region)) n.delete(region); else n.add(region); return n; })}
                className="flex w-full items-center gap-1.5 px-1.5 py-1.5 text-[10px] font-mono tracking-[0.14em] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                <span className="flex-1 text-left uppercase">{REGION_LABEL[region]}</span>
                <span className="tabular-nums text-[var(--text-muted)]">{craft.length}</span>
              </button>
              {expanded && craft.map(c => <CraftRow key={c.id} c={c} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function HostRow({ h }: { h: ExoHost }) {
  const show = () => requestWorld({ focus: 'stars', select: { kind: 'exohost', name: h.name } });
  return (
    <button type="button" onClick={show} title={`Fly to ${h.name}`}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-white/[0.05] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-[var(--text-primary)]">{h.name}</span>
        <span className="block truncate text-[10px] text-[var(--text-muted)]">{h.planets.length} planet{h.planets.length > 1 ? 's' : ''} · found {Math.min(...h.planets.map(p => p[4] || 9999))}</span>
      </span>
      <span className="text-[11px] font-mono tabular-nums text-[var(--text-primary)]">{distance(h.ly * LY_KM)}</span>
    </button>
  );
}

/** Stars with known planets, nearest first, each a click from its place among the stars. */
function Planets() {
  const exo = useExoplanets(true);
  const [query, setQuery] = useState('');
  const hosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exo?.hosts ?? []).filter(h => !q || h.name.toLowerCase().includes(q) || h.planets.some(p => p[0].toLowerCase().includes(q))).slice(0, HOSTS_SHOWN);
  }, [exo, query]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2 pt-3">
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 h-8">
          <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a star or planet" aria-label="Find a star or planet"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none" />
        </label>
        <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
          {exo ? `${exo.planets.toLocaleString('en-US')} planets around ${exo.hosts.length.toLocaleString('en-US')} stars · NASA Exoplanet Archive · ${age(exo.fetched)}` : 'Asking the NASA Exoplanet Archive…'}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto styled-scrollbar px-1.5 pb-3">
        {hosts.map(h => <HostRow key={h.name} h={h} />)}
      </div>
    </div>
  );
}

export default function SpaceDock({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'missions' | 'planets' | 'cam'>('missions');
  const tabClass = (t: typeof tab) => `h-7 px-2.5 rounded-md text-[11px] transition-colors ${tab === t ? 'bg-white/[0.08] text-[var(--text-heading)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`;
  return (
    <PanelCard title="Space" icon={Orbit} onClose={onClose}
      meta={<div className="ml-2 flex items-center gap-1">
        <button type="button" className={tabClass('missions')} onClick={() => setTab('missions')}>Spacecraft</button>
        <button type="button" className={tabClass('planets')} onClick={() => setTab('planets')}>Planets</button>
        <button type="button" className={tabClass('cam')} onClick={() => setTab('cam')}>ISS live</button>
      </div>}>
      {tab === 'missions' ? <Missions /> : tab === 'planets' ? <Planets /> : <div className="p-3"><SpaceCam /></div>}
    </PanelCard>
  );
}
