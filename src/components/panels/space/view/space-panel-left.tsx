'use client';

import { useId, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Panel, PanelSection } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { AU_KM, C_KM_S } from '@/lib/space/astro';
import type { ExoplanetPayload } from '@/lib/space/deep/exoplanets';
import { distance, lightTime } from '@/lib/space/format';
import type { FleetPayload, Region } from '@/lib/space/craft/fleet';
import type { NearbyStarCatalog } from '@/lib/space/deep/nearby-stars';
import type { OuterPayload } from '@/lib/space/deep/outer';
import { REGION_COLOR } from '@/lib/space/scene/craft/layer';
import type { CameraInfo, SpaceLayers } from '@/lib/space/scene/types';

/** The space view's left panel: where the camera is, what is drawn, and where it all comes from. */

const LEGEND: [Region, string][] = [
  ['cislunar', msg('Earth–Moon')], ['moon', msg('Moon')], ['sun-earth-l1', 'L1'], ['sun-earth-l2', 'L2'],
  ['mars', msg('Mars')], ['interplanetary', msg('Cruise')], ['jupiter', msg('Jupiter')], ['outer', msg('Outer')], ['interstellar', msg('Interstellar')],
];

const TOGGLES: [keyof SpaceLayers, string][] = [
  ['satellites', msg('Earth satellites')],
  ['fleet', msg('Spacecraft')],
  ['orbits', msg('Orbits and trails')],
  ['surface', msg('Landing sites and orbiters')],
  ['constellations', msg('Constellation figures')],
  ['exoplanets', msg('Stars with planets')],
  ['illustrations', msg('Models, marked as illustrations')],
  ['labels', msg('Labels')],
];

function ToggleRow({ label, count, checked, onChange }: { label: string; count?: string; checked: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className={cx('relative -mx-2 flex min-h-8 items-center gap-3 rounded-control px-2 hover:bg-surface-2', TRANSITION)}>
      <label htmlFor={id} className={cx('min-w-0 flex-1 cursor-pointer truncate text-body after:absolute after:inset-0', checked ? 'text-ink-1' : 'text-ink-2')}>{label}</label>
      {count && <span className="font-mono text-small text-ink-3 tabular-nums">{count}</span>}
      <Switch id={id} size="sm" hideLabel label={label} checked={checked} onChange={onChange} className="relative z-[1]" />
    </div>
  );
}

function AboutTheData({ deep }: { deep: { outer: OuterPayload | null; catalog: NearbyStarCatalog | null } }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-5 border-t border-line pt-3">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}
        className={cx('flex w-full items-center gap-1.5 rounded-control text-left text-meta font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
        <ChevronRight aria-hidden strokeWidth={1.75} className={cx('size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none', open && 'rotate-90')} />
        {t('Where this comes from')}
      </button>
      {open && (
        <p id={id} className="mt-2 text-small text-ink-3">
          {[
            deep.outer
              ? t('Real positions, live: JPL Horizons for the planets, spacecraft, dwarf planets and interstellar visitors; CelesTrak for Earth satellites; NASA for the rovers; the Minor Planet Center for {n} distant minor planets.', { n: deep.outer.distant.length })
              : t('Real positions, live: JPL Horizons for the planets, spacecraft, dwarf planets and interstellar visitors; CelesTrak for Earth satellites; NASA for the rovers; the Minor Planet Center for distant minor planets.'),
            deep.catalog
              ? t('Stars: the Yale Bright Star Catalogue, Hipparcos and ESA Gaia DR3 ({n} in 3D); planets from the NASA Exoplanet Archive.', { n: deep.catalog.stars.length })
              : t('Stars: the Yale Bright Star Catalogue, Hipparcos and ESA Gaia DR3; planets from the NASA Exoplanet Archive.'),
            t('Imagery: NASA GIBS, Moon and Mars Trek, SDO; the Milky Way sky from NASA SVS; the face-on Milky Way is NASA/JPL-Caltech/R. Hurt artwork.'),
            t('Beyond: the 2MASS Redshift Survey (Huchra et al. 2012), SDSS DR17 galaxies and quasars, and the cosmic microwave background from NASA WMAP.'),
            t('Past positions in a flight replay: JPL Horizons, with the planets from JPL’s mean orbital elements between encounters.'),
            t('Sizes are true; distant things are drawn as dots so they stay visible.'),
            t('The heliosphere, Oort cloud and galactic disc are models, marked as illustrations.'),
          ].join(' ')}
        </p>
      )}
    </div>
  );
}

const FOLD_KEY = 'takip.space.layersFolded';

function loadFolded(): boolean {
  try { return window.localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; }
}

export default function SpacePanelLeft({ camera, layers, setLayers, fleet, satelliteCount, deep }: {
  camera: CameraInfo | null;
  layers: SpaceLayers;
  setLayers: (l: SpaceLayers) => void;
  fleet: FleetPayload | null;
  satelliteCount: number;
  deep: { outer: OuterPayload | null; exoplanets: ExoplanetPayload | null; catalog: NearbyStarCatalog | null };
}) {
  const t = useT();
  // Folded to its header, it still says where the camera is; remembered, since it is a matter of taste.
  const [folded, setFoldedState] = useState(() => typeof window !== 'undefined' && loadFolded());
  const setFolded = (f: boolean) => {
    setFoldedState(f);
    try { window.localStorage.setItem(FOLD_KEY, f ? '1' : '0'); } catch { /* storage blocked */ }
  };
  const counts: Partial<Record<keyof SpaceLayers, string>> = {
    satellites: satelliteCount ? satelliteCount.toLocaleString(t.intl) : '',
    fleet: fleet ? `${fleet.craft.filter(c => c.region !== 'earth-orbit').length.toLocaleString(t.intl)}${fleet.pending ? '…' : ''}` : '…',
    exoplanets: deep.exoplanets ? deep.exoplanets.hosts.length.toLocaleString(t.intl) : '',
  };
  const known = camera && Number.isFinite(camera.distanceKm);
  const far = (camera?.sunKm ?? 0) > 30 * AU_KM && camera?.anchorName !== 'Sun' && camera?.anchorName !== 'Solar system';
  const light = known && camera.distanceKm / C_KM_S < 365.25 * 86_400 && camera.distanceKm > 1e7 ? lightTime(camera.distanceKm / C_KM_S, t) : null;

  const anchor = camera ? t(camera.anchorName) : t('Earth');
  const away = known ? distance(camera.distanceKm, t) : '';
  const fromSun = far && camera ? distance(camera.sunKm, t) : '';
  const where = !known ? undefined
    : light && far ? t('The camera is {distance} from {anchor}, {time} at light speed, {sun} from the Sun', { distance: away, anchor, time: light, sun: fromSun })
      : light ? t('The camera is {distance} from {anchor}, {time} at light speed', { distance: away, anchor, time: light })
        : far ? t('The camera is {distance} from {anchor}, {sun} from the Sun', { distance: away, anchor, sun: fromSun })
          : t('The camera is {distance} from {anchor}', { distance: away, anchor });

  // Named apart from the sidebar's Layers, which are the map's; where the camera is goes underneath.
  return (
    <Panel docked={false} bare={folded} className="pointer-events-auto w-[280px] shrink-0" title={t('Space layers')}
      subtitle={known ? <span title={where} className="tabular-nums">{t('{distance} from {anchor}', { distance: away, anchor })}</span> : t('Placing the camera…')}
      actions={<IconButton icon={folded ? ChevronDown : ChevronUp} label={folded ? t('Show the layers') : t('Fold away')} tooltipSide="right"
        aria-expanded={!folded} onClick={() => setFolded(!folded)} />}>
      {!folded && (
        <>
          <PanelSection>
            {TOGGLES.map(([key, label]) => (
              <ToggleRow key={key} label={t(label)} count={counts[key]} checked={layers[key]} onChange={on => setLayers({ ...layers, [key]: on })} />
            ))}
          </PanelSection>
          <PanelSection title={t('Spacecraft, by where they are')}>
            <ul className="grid grid-cols-3 gap-x-3 gap-y-1.5">
              {LEGEND.map(([region, label]) => (
                <li key={region} className="flex min-w-0 items-center gap-1.5 text-meta text-ink-2">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: REGION_COLOR[region] }} />
                  <span className="truncate">{t(label)}</span>
                </li>
              ))}
            </ul>
          </PanelSection>
          <AboutTheData deep={deep} />
        </>
      )}
    </Panel>
  );
}
