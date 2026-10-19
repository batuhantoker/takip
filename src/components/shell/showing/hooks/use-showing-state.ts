'use client';

import { useEffect, useReducer } from 'react';
import { useT } from '@/components/ui/use-t';
import { countLayersOn } from '@/components/shell/sidebar/nav-items';
import type { ImportedLayer } from '@/lib/map/layers/arcgis';
import type { DrawnShape } from '@/lib/places/areas/draw';
import { nameOf } from '@/lib/history/countries/indicator-groups';
import { projectedAt } from '@/lib/history/projection';
import { rampFor } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { maAt } from '@/lib/history/paleo/deep-time';
import { CHAPTERS } from '@/lib/history/paleo/story';
import type { ReplaySession } from '@/lib/map/replay/session';
import type { ShowingState } from '@/components/shell/showing/lib/showing-state';

const EVERY_MS = 250;

/** What the country colouring shows, ignoring the hovered country, which changes with every pointer move. */
const colouringKey = (h: HistorySession) => {
  const s = h.countries.state();
  return `${s.status}:${s.status === 'off' ? '' : s.code}:${h.countries.dark()}:${!!h.countries.projection()}`;
};

/** Re-renders when History's borders, events, colouring or deep time change, and with the clocks while `clocks` is on. */
function usePastTick(history: HistorySession | null, replay: ReplaySession | null, clocks: boolean) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = () => { timer ??= setTimeout(() => { timer = undefined; rerender(); }, EVERY_MS); };
    const offs: (() => unknown)[] = [];
    if (history) {
      let colouring = colouringKey(history);
      offs.push(history.subscribe(rerender), history.story.subscribe(rerender), history.countries.subscribe(() => {
        const next = colouringKey(history);
        if (next !== colouring) { colouring = next; rerender(); }
      }));
      if (clocks) offs.push(history.clock.subscribe(kick), history.deepClock.subscribe(kick));
    }
    if (replay && clocks) offs.push(replay.clock.subscribe(kick));
    return () => {
      offs.forEach(off => off());
      clearTimeout(timer);
    };
  }, [history, replay, clocks]);
}

/** The state the chip's rows and summary are built from, kept current with History's session outside React. */
export function useShowingState({ layers, chosen, history, families, replay, arcgis, areas, clocks }: {
  /** What the map is given. */
  layers: Record<string, unknown>;
  /** What the person has switched on. */
  chosen: Record<string, unknown>;
  history: HistorySession | null;
  /** The families the map draws: none in deep time. */
  families: string[];
  replay: ReplaySession | null;
  arcgis: ImportedLayer[];
  areas: DrawnShape[];
  clocks: boolean;
}): ShowingState {
  const t = useT();
  usePastTick(history, replay, clocks);
  const deep = !!history?.deep();
  const time = history && !deep ? history.clock.time() : replay ? replay.clock.time() : null;
  const pick = history && !deep ? history.countries.state() : null;
  const chapter = deep ? history!.story.index() : null;
  return {
    mode: history ? (deep ? 'deep' : 'history') : replay ? 'replay' : 'live',
    time,
    projected: !!history && time !== null && projectedAt(history.countries.projection(), time),
    ma: deep ? maAt(history!.deepClock.time()) : null,
    chapter: chapter === null || !CHAPTERS[chapter] ? null : t(CHAPTERS[chapter].title),
    layers,
    paused: history || replay ? countLayersOn(chosen as Record<string, boolean>) - countLayersOn(layers as Record<string, boolean>) : 0,
    families,
    borders: history?.layers()[0] ?? null,
    colouring: pick && pick.status !== 'off' ? { code: pick.code, name: nameOf(pick, true, t), ramp: rampFor(history!.countries.dark()) } : null,
    arcgis: arcgis.filter(l => l.visible).map(l => ({ id: l.id, title: l.title, color: l.color })),
    areas: { count: areas.length, color: areas[0]?.color ?? null },
  };
}
