'use client';

import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from 'react';
import type { HistorySession } from '@/lib/history/session';
import { familiesOfKinds } from '@/lib/history/kinds';
import { atMa } from '@/lib/history/paleo/deep-time';
import { loadCountries } from '@/lib/places/areas/boundary-store';
import type { ReplaySession } from '@/lib/map/replay/session';
import { HISTORY_FAMILY_LINKS, parsePanelLink, parseViewModeLink, yearStart, type PanelLink, type ViewModeLink } from '@/lib/map/view-mode-link';
import type { SpaceFocus } from '@/lib/space/worlds';
import { SPEEDS } from '@/components/panels/history/lib/history-timeline-config';
import type { ToolId } from '@/components/shell/sidebar/dock';
import type { MobilePanel } from './types';

const TOOL: Record<PanelLink, ToolId> = {
  layers: 'layers', alerts: 'alerts', areas: 'draw', route: 'directions', recon: 'recon', arcgis: 'arcgis', ti: 'ai', space: 'space',
};
// Areas, Route and ArcGIS stay on the desktop.
const MOBILE: Partial<Record<PanelLink, MobilePanel>> = { layers: 'layers', alerts: 'intel', recon: 'recon', ti: 'ai', space: 'space' };

/** A span of years plays through in about a minute at most, at one of History's own speeds. */
function spanSpeed(from: number, to: number): number {
  const seconds = (to - from) / 1000;
  return SPEEDS.find(s => seconds / s.value <= 60)?.value ?? SPEEDS[SPEEDS.length - 1].value;
}

type Actions = {
  isMobile: boolean;
  history: HistorySession | null;
  replay: ReplaySession | null;
  startHistory: () => void;
  toggleReplay: () => void;
  enterSpace: (focus: SpaceFocus) => void;
  openTool: (tool: ToolId) => void;
  setMobilePanel: (panel: MobilePanel) => void;
};

/**
 * A link from a public page that opens another view (lib/map/view-mode-link.ts): History at a year, deep time,
 * Space at a body, Replay at a moment, or a sidebar panel. It acts once the splash has gone, and only once.
 */
export function useViewModeLink({ splashGone, autoLocateCancelled: autoLocateCancelledRef, ...actions }: Actions & {
  splashGone: boolean;
  autoLocateCancelled: MutableRefObject<boolean>;
}) {
  const linkRef = useRef<{ mode: ViewModeLink | null; panel: PanelLink | null } | null>(null);
  const actRef = useRef(actions);
  const openedRef = useRef(false);
  const timedRef = useRef(false);
  useEffect(() => { actRef.current = actions; });

  // Before useStartup's fly-in runs: a view of the past or of space has no use for the visitor's city.
  useLayoutEffect(() => {
    const p = new URLSearchParams(window.location.search);
    linkRef.current = { mode: parseViewModeLink(p), panel: parsePanelLink(p) };
    if (linkRef.current.mode && !p.has('lat')) autoLocateCancelledRef.current = true;
  }, [autoLocateCancelledRef]);

  useEffect(() => {
    const { mode, panel } = linkRef.current ?? { mode: null, panel: null };
    if (!splashGone || openedRef.current || (!mode && !panel)) return;
    openedRef.current = true;
    const a = actRef.current;
    if (mode?.view === 'history' || mode?.view === 'deep') {
      if (a.isMobile) { a.startHistory(); a.setMobilePanel('history'); } else a.openTool('history');
    } else if (mode?.view === 'space') a.enterSpace(mode.focus);
    else if (mode?.view === 'replay' && !a.replay) a.toggleReplay();
    if (panel) {
      const mobile = MOBILE[panel];
      if (!a.isMobile) a.openTool(TOOL[panel]);
      else if (mobile) a.setMobilePanel(mobile);
    }
  }, [splashGone]);

  // The session exists a render after it is started; set its time then.
  const { history, replay } = actions;
  useEffect(() => {
    const mode = linkRef.current?.mode;
    if (!openedRef.current || timedRef.current || !mode) return;
    if (mode.view === 'history' && history) {
      timedRef.current = true;
      const families = mode.kinds ? [...(mode.families ?? []), ...familiesOfKinds(mode.kinds)] : mode.families;
      if (families) for (const f of HISTORY_FAMILY_LINKS) history.setFamily(f, families.includes(f));
      if (mode.kinds) history.setKinds(mode.kinds);
      if (mode.layer) history.setLayer(mode.layer, true);
      // Before the clock moves: the metric only seeks when the clock is outside its years.
      if (mode.metric) history.countries.select(mode.metric, mode.source);
      if (mode.metric && mode.countries) {
        const keys = mode.countries;
        // The outlines the status bar already loads name each country as a click on the map would.
        loadCountries().then(list => {
          for (const key of keys) {
            const found = list.find(c => c.id === key);
            if (found && !history.chart.countries().some(c => c.key === key)) history.chart.toggle(key, found.name);
          }
        }, () => {});
      }
      if (mode.range) {
        const from = yearStart(mode.range.from), to = Math.min(Date.now(), yearStart(mode.range.to + 1));
        history.clock.seek(from);
        history.clock.setSpeed(spanSpeed(from, to));
        history.clock.play(to);
      } else if (mode.year !== null) { history.clock.seek(yearStart(mode.year)); history.clock.pause(); }
    } else if (mode.view === 'deep' && history) {
      timedRef.current = true;
      history.setDeep(true);
      if (mode.chapter !== null) history.story.go(mode.chapter);
      else if (mode.ma !== null) { history.deepClock.seek(atMa(mode.ma)); history.deepClock.pause(); }
    } else if (mode.view === 'replay' && replay) {
      timedRef.current = true;
      if (mode.at !== null) replay.clock.seek(mode.at);
    }
  }, [history, replay]);
}
