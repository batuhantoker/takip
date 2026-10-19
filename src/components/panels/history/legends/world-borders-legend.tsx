'use client';

import type { HistorySession } from '@/lib/history/session';
import { clockYear, clockYearLabel, FIRST_YEAR, LAST_YEAR, WORLD_BORDERS } from '@/lib/history/world-borders';
import { useT } from '@/components/ui/use-t';
import { LegendCard } from './legend-card';

/** Over the History timeline while world borders are on: which year's borders are showing and where they come from. */
export default function WorldBordersLegend({ session }: { session: HistorySession }) {
  const t = useT();
  const year = clockYear(session.clock.time());
  return (
    <LegendCard title={t(WORLD_BORDERS.label)} meta={year < FIRST_YEAR ? t('No borders this early') : t('Borders of {year}', { year: clockYearLabel(Math.min(year, LAST_YEAR), t) })}
      closeLabel={t('Hide world borders')} onClose={() => session.setLayer(WORLD_BORDERS.code, false)}
      source={t('From Cliopatria by the Seshat Global History Databank (CC BY 4.0), year by year and drawn for world scale.')}>
      <p className="text-meta text-ink-3">{t('A colony or member state takes the colour of the empire or union it belongs to.')}</p>
    </LegendCard>
  );
}
