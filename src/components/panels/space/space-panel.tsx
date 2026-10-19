'use client';

import { useId, useState } from 'react';
import { cx } from '@/components/ui/class-names';
import { Panel } from '@/components/ui/panel';
import { SearchField } from '@/components/ui/search-field';
import { Segmented, segmentId, type SegmentedOption } from '@/components/ui/segmented';
import { age } from '@/lib/space/format';
import CraftList from '@/components/panels/space/parts/craft-list';
import IssLive from '@/components/panels/space/parts/iss-live';
import PlanetList from '@/components/panels/space/parts/planet-list';
import { useExoplanets, useExoplanetsFailed, useFleet, useFleetFailed } from './use-space-data';

/**
 * The Space panel: every spacecraft JPL Horizons can place right now, by where
 * it is, each one a click from the space view; the stars known to have
 * planets; and the ISS live cameras.
 */

type Tab = 'craft' | 'planets' | 'iss';
const TAB_KEY = 'takip.space.tab';
const TABS: SegmentedOption<Tab>[] = [
  { value: 'craft', label: 'Spacecraft' },
  { value: 'planets', label: 'Planets' },
  { value: 'iss', label: 'ISS live' },
];

function loadTab(): Tab {
  try {
    const t = window.localStorage.getItem(TAB_KEY);
    return t === 'planets' || t === 'iss' ? t : 'craft';
  } catch { return 'craft'; }
}

/** `embedded`: body only, for the phone's sheet, which has its own title and close and does the scrolling. */
export default function SpaceDock({ onClose, embedded }: { onClose: () => void; embedded?: boolean }) {
  const id = useId();
  const [tab, setTabState] = useState<Tab>(() => (typeof window === 'undefined' ? 'craft' : loadTab()));
  const [craftQuery, setCraftQuery] = useState('');
  const [planetQuery, setPlanetQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const fleet = useFleet(tab === 'craft');
  const fleetFailed = useFleetFailed(tab === 'craft');
  const exo = useExoplanets(tab === 'planets');
  const exoFailed = useExoplanetsFailed(tab === 'planets');

  const setTab = (t: Tab) => {
    setTabState(t);
    setScrolled(false);
    try { window.localStorage.setItem(TAB_KEY, t); } catch { /* storage blocked */ }
  };

  const subtitle = tab === 'craft'
    ? fleet ? `${fleet.craft.length} craft · JPL Horizons · ${age(fleet.epoch)}${fleet.pending ? ` · ${fleet.pending} still loading` : ''}` : 'JPL Horizons'
    : tab === 'planets'
      ? exo ? `${exo.planets.toLocaleString('en-US')} planets around ${exo.hosts.length.toLocaleString('en-US')} stars · NASA Exoplanet Archive` : 'NASA Exoplanet Archive'
      : 'Outside cameras on the International Space Station';

  const searchable = tab !== 'iss';
  const query = tab === 'craft' ? craftQuery : planetQuery;
  const setQuery = tab === 'craft' ? setCraftQuery : setPlanetQuery;

  const list = tab === 'craft' ? <CraftList fleet={fleet} failed={fleetFailed} query={craftQuery} />
    : tab === 'planets' ? <PlanetList exo={exo} failed={exoFailed} query={planetQuery} />
      : <IssLive />;
  const placeholder = tab === 'craft' ? 'Find a spacecraft' : 'Find a star or planet';

  if (embedded) return (
    <>
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-surface-1 px-4 pb-2">
        <Segmented value={tab} onChange={setTab} options={TABS} id={id} semantics="tabs" label="Space" size="sm" full />
        {/* iOS zooms into inputs under 16 px. */}
        {searchable && <SearchField value={query} onChange={setQuery} autoComplete="off" spellCheck={false} placeholder={placeholder} className="h-10 [&_input]:text-base" />}
        <p className="truncate text-meta text-ink-3">{subtitle}</p>
      </div>
      <div key={tab} role="tabpanel" aria-labelledby={segmentId(id, tab)} className="-mx-4">{list}</div>
    </>
  );

  return (
    <Panel<Tab> title="Space" subtitle={subtitle} onClose={onClose} bare tabs={{ value: tab, onChange: setTab, options: TABS }}>
      {searchable && (
        <div className={cx('shrink-0 border-b px-4 pb-2 transition-colors duration-150', scrolled ? 'border-line' : 'border-transparent')}>
          <SearchField value={query} onChange={setQuery} autoComplete="off" spellCheck={false} placeholder={placeholder} />
        </div>
      )}
      <div key={tab} className="styled-scrollbar min-h-0 flex-1 overflow-y-auto" onScroll={e => setScrolled(e.currentTarget.scrollTop > 0)}>
        {list}
      </div>
    </Panel>
  );
}
