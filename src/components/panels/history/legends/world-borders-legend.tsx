'use client';

import type { HistorySession } from '@/lib/history/session';
import { clockYear, clockYearLabel, FIRST_YEAR, LAST_YEAR, WORLD_BORDERS } from '@/lib/history/world-borders';
import { LegendCard } from './legend-card';

/** Over the History timeline while world borders are on: which year's borders are showing and where they come from. */
export default function WorldBordersLegend({ session }: { session: HistorySession }) {
  const year = clockYear(session.clock.time());
  return (
    <LegendCard title={WORLD_BORDERS.label} meta={year < FIRST_YEAR ? 'No borders this early' : `Borders of ${clockYearLabel(Math.min(year, LAST_YEAR))}`}
      closeLabel="Hide world borders" onClose={() => session.setLayer(WORLD_BORDERS.code, false)}
      source={<>From Cliopatria by the Seshat Global History Databank (CC BY 4.0), year by year and drawn for world scale.</>}>
      <p className="text-meta text-ink-3">A colony or member state takes the colour of the empire or union it belongs to.</p>
    </LegendCard>
  );
}
