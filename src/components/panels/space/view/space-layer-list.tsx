'use client';

import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { PanelSection } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { Region } from '@/lib/space/craft/fleet';
import { DEEP_SKY_PLACED } from '@/lib/space/deep/deep-sky';
import type { NearbyStarCatalog } from '@/lib/space/deep/nearby-stars';
import type { OuterPayload } from '@/lib/space/deep/outer';
import { REGION_COLOR } from '@/lib/space/scene/craft/layer';
import type { SpaceLayers } from '@/lib/space/scene/types';

/** What the space view draws, the spacecraft colours, and where it all comes from: the left panel's body, and a phone's Layers sheet in space. */

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
  ['deepSky', msg('Nebulae and galaxies, photographed')],
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
            t('Nebulae, clusters and galaxies: pictures from ESA/Webb, ESO, NOIRLab and the Digitized Sky Survey, each placed by its own astrometry.'),
            t('Beyond: the 2MASS Redshift Survey (Huchra et al. 2012), SDSS DR17 galaxies and quasars, and the cosmic microwave background from ESA Planck.'),
            t('Past positions in a flight replay: JPL Horizons, with the planets from JPL’s mean orbital elements between encounters.'),
            t('Sizes are true; distant things are drawn as dots so they stay visible.'),
            t('The heliosphere, Oort cloud and galactic disc are models, marked as illustrations.'),
          ].join(' ')}
        </p>
      )}
    </div>
  );
}

const NO_DEEP = { outer: null, catalog: null };

export default function SpaceLayerList({ layers, setLayers, counts = {}, deep = NO_DEEP }: {
  layers: SpaceLayers;
  setLayers: (l: SpaceLayers) => void;
  /** How many of each are drawn, where known. */
  counts?: Partial<Record<keyof SpaceLayers, string>>;
  deep?: { outer: OuterPayload | null; catalog: NearbyStarCatalog | null };
}) {
  const t = useT();
  return (
    <>
      <PanelSection>
        {TOGGLES.map(([key, label]) => (
          <ToggleRow key={key} label={t(label)} count={counts[key] ?? (key === 'deepSky' ? String(DEEP_SKY_PLACED.length) : undefined)} checked={layers[key]} onChange={on => setLayers({ ...layers, [key]: on })} />
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
  );
}
