'use client';

import { useRef, useState, type ComponentProps, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Popover } from '@/components/ui/popover';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import type { ArcgisLayers } from '@/components/panels/arcgis/use-arcgis-layers';
import { towardMiddle, type Corner } from '@/components/shell/layout/lib/model';
import type { DrawnShape } from '@/lib/places/areas/draw';
import type { PicksSnapshot } from '@/lib/history/countries/view';
import type { HistorySession } from '@/lib/history/session';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import type { ReplaySession } from '@/lib/map/replay/session';
import { useRecent } from './hooks/use-recent';
import { useShowingState } from './hooks/use-showing-state';
import { NOTHING_SEEN, remember, shownGroups, type ShownRow } from './lib/held-rows';
import { recentFor } from './lib/recent';
import { countRows, rowsFor } from './lib/showing-rows';
import { summaryFor } from './lib/showing-summary';
import { ShowingPanel } from './parts/showing-panel';

// Matches the Map | Space control's pill.
const PILL = 'pointer-events-auto flex h-[38px] items-center rounded-float border border-line bg-surface-1 p-[3px] shadow-float';
const SEGMENT = cx('flex h-full items-center gap-1.5 rounded-card pr-2 pl-2.5 text-small font-medium whitespace-nowrap', FOCUS_RING, TRANSITION);

/** The pill as the popover's trigger, so the popover lines up with its edge. */
function Chip({ count, live, down, ...trigger }: Omit<ComponentProps<'button'>, 'children'> & { count: number; live: boolean; down: boolean }) {
  const t = useT();
  const open = !!trigger['aria-expanded'];
  const Chevron = down ? ChevronDown : ChevronUp;
  return (
    <div className={PILL}>
      <button type="button" {...trigger} className={cx(SEGMENT, open ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1')}>
        <Dot tone={live ? 'green' : 'muted'} />
        {t('Showing')}
        <span className="font-mono text-ink-3 tabular-nums">{count.toLocaleString(t.intl)}</span>
        <Chevron aria-hidden className="size-3.5 text-ink-3" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export type ShowingPanelId = 'layers' | 'history' | 'draw';

/**
 * "Showing 4", in its corner of the map (top right unless moved; beside Map | Space on a phone): what the map is drawing right now. It opens
 * on the mode and time in words, then every layer, event family, border and colouring on the map, each with its switch,
 * then what the person had on recently, to switch back on.
 */
export default function ShowingChip({ isMobile, corner = 'top-right', revealed, layers, chosen, setLayers, history, families, replay, arcgis, areas, onOpen }: {
  isMobile: boolean;
  /** Desktop only: a phone keeps it beside Map | Space. */
  corner?: Corner;
  revealed: boolean;
  /** What the map is given: today's data is off while History runs. */
  layers: ActiveLayers;
  /** What the person has switched on, for the layers History pauses. */
  chosen: ActiveLayers;
  setLayers: Dispatch<SetStateAction<ActiveLayers>>;
  history: HistorySession | null;
  families: string[];
  replay: ReplaySession | null;
  arcgis: Pick<ArcgisLayers, 'arcgisLayers' | 'updateLayer'>;
  areas: DrawnShape[];
  /** Opens a panel; a phone has only Layers. */
  onOpen: (panel: ShowingPanelId) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const state = useShowingState({ layers, chosen, history, families, replay, arcgis: arcgis.arcgisLayers, areas, clocks: open });
  const groups = rowsFor(state, t);
  const recent = useRecent({ mode: state.mode, rows: groups.flatMap(g => g.rows) }, new Set(arcgis.arcgisLayers.map(l => l.id)), revealed);

  const [seen, setSeen] = useState(NOTHING_SEEN);
  const nextSeen = open ? remember(seen, groups) : NOTHING_SEEN;
  if (nextSeen !== seen) setSeen(nextSeen);

  // Switching the colouring back on brings back every pick that was there, not just the one that coloured.
  const picks = useRef<PicksSnapshot | null>(null);
  const flip = (row: ShownRow, on: boolean) => {
    const off = row.off;
    switch (off?.kind) {
      case 'layer': setLayers(prev => ({ ...prev, [off.key]: on })); return;
      case 'arcgis': arcgis.updateLayer(off.id, { visible: on }); return;
      case 'family': history?.setFamily(off.family, on); return;
      case 'borders': history?.setLayer(off.code, on); return;
      case 'deep': history?.setDeep(on); return;
      case 'countries':
        if (!history) return;
        if (!on) {
          picks.current = history.countries.snapshot();
          history.countries.select(null);
        } else if (picks.current?.coloured === off.code) history.countries.restore(picks.current);
        else history.countries.select(off.code);
    }
  };

  const panel: ShowingPanelId = history && !isMobile ? 'history' : 'layers';
  const shown = shownGroups(nextSeen, groups);
  const listed = new Set(shown.flatMap(g => g.rows.map(r => r.id)));
  const menu = towardMiddle(isMobile ? 'bottom-left' : corner);
  return (
    <Popover label={t('What the map is showing')} placement={menu.vertical} align={menu.alongSide} open={open} onOpenChange={setOpen}
      className={cx('p-0', isMobile ? 'w-[calc(100vw-24px)]' : 'w-[340px]')}
      trigger={<Chip count={countRows(groups)} live={state.mode === 'live'} down={menu.vertical === 'bottom'} />}>
      {close => (
        <ShowingPanel summary={summaryFor(state, t)} groups={shown} recent={recentFor(recent, state.mode, listed).map(i => ({ ...i, on: false }))}
          tall={isMobile} onSwitch={flip}
          onOpenAreas={isMobile ? undefined : () => { close(); onOpen('draw'); }}
          footer={{ label: panel === 'history' ? t('Open History') : t('Open Layers'), onClick: () => { close(); onOpen(panel); } }} />
      )}
    </Popover>
  );
}
