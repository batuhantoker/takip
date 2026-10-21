'use client';

import type { HistorySession } from '@/lib/history/session';
import { ALIGNMENTS, WAR_LAYERS } from '@/lib/history/war-layers';
import { useT } from '@/components/ui/use-t';
import { LegendCard } from './legend-card';
import { Swatch } from '@/components/panels/history/parts/swatch';

const axis = ALIGNMENTS.find(a => a.key === 'axis')!.color;
/** Occupation is a status, not a border, so the map hatches it over the country's own colour. */
export const occupiedFill = (color: string) => `repeating-linear-gradient(135deg, ${axis} 0 1px, transparent 1px 4px), ${color}`;

/** Over the History timeline while wartime borders are on: what the colours mean and where the borders come from. */
export default function WarLegend({ session, compact }: { session: HistorySession; compact?: boolean }) {
  const t = useT();
  const layers = WAR_LAYERS.filter(l => session.layers().includes(l.code));
  if (!layers.length) return null;
  return (
    <LegendCard compact={compact} title={layers.map(l => t(l.label)).join(', ')} meta={layers.map(l => l.years).join(', ')}
      closeLabel={t('Hide the borders')} onClose={() => layers.forEach(l => session.setLayer(l.code, false))}
      source={<>{layers.map(l => t(l.note)).join(' ')} {t('From the Stanford Spatial History Lab.')}</>}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {ALIGNMENTS.map(a => (
          <li key={a.key} className="flex min-w-0 items-center gap-2 text-small text-ink-2">
            <Swatch color={a.color} shape="bar" style={a.key === 'occupied' ? { background: occupiedFill(a.color) } : undefined} />
            <span className="truncate">{t(a.label)}</span>
          </li>
        ))}
      </ul>
    </LegendCard>
  );
}
