'use client';

import { AU_KM, C_KM_S } from '@/lib/space/astro';
import type { ExoplanetPayload } from '@/lib/space/exoplanets';
import { distance, lightTime } from '@/lib/space/format';
import type { FleetPayload, Region } from '@/lib/space/fleet';
import type { NearbyStarCatalog } from '@/lib/space/nearby-stars';
import type { OuterPayload } from '@/lib/space/outer';
import { REGION_COLOR } from './scene/craft';
import type { CameraInfo, SpaceLayers } from './scene/space-scene';

/** The space view's left panel: where the camera is, what is drawn, and where it all comes from. */

const LEGEND: [Region, string][] = [
  ['cislunar', 'Earth–Moon'], ['moon', 'Moon'], ['sun-earth-l1', 'L1'], ['sun-earth-l2', 'L2'],
  ['mars', 'Mars'], ['interplanetary', 'Cruise'], ['jupiter', 'Jupiter'], ['outer', 'Outer'], ['interstellar', 'Interstellar'],
];

const TOGGLES: [keyof SpaceLayers, string][] = [
  ['satellites', 'Earth satellites'],
  ['fleet', 'Spacecraft'],
  ['orbits', 'Orbits and trails'],
  ['surface', 'Landing sites and orbiters'],
  ['constellations', 'Constellation figures'],
  ['exoplanets', 'Stars with planets'],
  ['illustrations', 'Models (marked illustration)'],
  ['labels', 'Labels'],
];

export default function SpacePanelLeft({ camera, layers, setLayers, fleet, satelliteCount, deep }: {
  camera: CameraInfo | null;
  layers: SpaceLayers;
  setLayers: (l: SpaceLayers) => void;
  fleet: FleetPayload | null;
  satelliteCount: number;
  deep: { outer: OuterPayload | null; exoplanets: ExoplanetPayload | null; catalog: NearbyStarCatalog | null };
}) {
  const counts: Partial<Record<keyof SpaceLayers, string>> = {
    satellites: satelliteCount ? satelliteCount.toLocaleString('en-US') : '',
    fleet: fleet ? `${fleet.craft.filter(c => c.region !== 'earth-orbit').length}${fleet.pending ? '…' : ''}` : '…',
    exoplanets: deep.exoplanets ? deep.exoplanets.hosts.length.toLocaleString('en-US') : '',
  };
  const far = (camera?.sunKm ?? 0) > 30 * AU_KM;
  const light = camera && Number.isFinite(camera.distanceKm) && camera.distanceKm / C_KM_S < 365.25 * 86_400 && camera.distanceKm > 1e7 ? `${lightTime(camera.distanceKm / C_KM_S)} at light speed` : null;
  return (
    <div className="pointer-events-auto w-[240px] rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel)] p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div className="text-[9px] font-mono tracking-[0.2em] text-[var(--text-muted)]">CAMERA</div>
      <div className="mt-0.5 text-[12px] font-semibold text-[var(--text-heading)]">{camera?.anchorName ?? 'Earth'}</div>
      <div className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)]">{camera && Number.isFinite(camera.distanceKm) ? `${distance(camera.distanceKm)} away` : '—'}</div>
      {light && <div className="text-[9px] font-mono tabular-nums text-[var(--text-muted)]">{light}</div>}
      {far && camera && camera.anchorName !== 'Sun' && camera.anchorName !== 'Solar system' && <div className="text-[9px] font-mono tabular-nums text-[var(--text-muted)]">{distance(camera.sunKm)} from the Sun</div>}

      <div className="mt-2.5 flex flex-col gap-0.5 border-t border-[var(--border-secondary)] pt-2">
        {TOGGLES.map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[11px] text-[var(--text-primary)] hover:bg-white/5">
            <input type="checkbox" checked={layers[key]} onChange={e => setLayers({ ...layers, [key]: e.target.checked })} className="accent-[var(--gold-primary)]" />
            <span className="flex-1">{label}</span>
            {counts[key] && <span className="text-[9px] font-mono tabular-nums text-[var(--text-muted)]">{counts[key]}</span>}
          </label>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 border-t border-[var(--border-secondary)] pt-2">
        {LEGEND.map(([region, label]) => (
          <span key={region} className="flex items-center gap-1 text-[9px] text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: REGION_COLOR[region] }} />{label}
          </span>
        ))}
      </div>

      <p className="mt-2 border-t border-[var(--border-secondary)] pt-2 text-[9px] leading-snug text-[var(--text-muted)]">
        Real positions, live: JPL Horizons for the planets, spacecraft, dwarf planets and interstellar visitors, CelesTrak for Earth satellites, NASA for the rovers, the Minor Planet Center for {deep.outer ? `${deep.outer.distant.length.toLocaleString('en-US')} ` : ''}distant minor planets. Stars: Yale Bright Star Catalogue, Hipparcos and ESA Gaia DR3{deep.catalog ? ` (${deep.catalog.stars.length.toLocaleString('en-US')} in 3D)` : ''}; planets from the NASA Exoplanet Archive. Imagery: NASA GIBS, Moon and Mars Trek, SDO; Milky Way sky from NASA SVS; the face-on Milky Way is NASA/JPL-Caltech/R. Hurt artwork. Beyond: 2MASS Redshift Survey (Huchra et al. 2012), SDSS DR17 galaxies and quasars, and the cosmic microwave background from NASA WMAP. Past positions in a flight replay: JPL Horizons, with the planets from JPL&apos;s mean orbital elements between encounters. Sizes are true; distant things are drawn as dots so they stay visible. The heliosphere, Oort cloud and galactic disc are models, marked as illustrations.
      </p>
    </div>
  );
}
