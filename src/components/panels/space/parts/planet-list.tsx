'use client';

import { useMemo } from 'react';
import { CloudOff, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { useT } from '@/components/ui/use-t';
import { LY_KM } from '@/lib/space/astro';
import type { ExoHost, ExoplanetPayload } from '@/lib/space/deep/exoplanets';
import { requestWorld } from '@/lib/space/world-events';
import { DistanceCell } from './distance-cell';

const HOSTS_SHOWN = 200;

function HostRow({ h }: { h: ExoHost }) {
  const t = useT();
  const found = Math.min(...h.planets.map(p => p[4] || 9999));
  return (
    <ListRow
      title={h.name}
      subtitle={<span className="text-ink-3">{t('{n, plural, one {# planet} other {# planets}} · first found {year}', { n: h.planets.length, year: String(found) })}</span>}
      aria-label={t('Fly to {name}', { name: h.name })}
      onClick={() => requestWorld({ focus: 'stars', select: { kind: 'exohost', name: h.name } })}
      trailing={<DistanceCell km={h.ly * LY_KM} />}
    />
  );
}

/** Stars with known planets, nearest first, each a click from its place among the stars. */
export default function PlanetList({ exo, failed, query }: { exo: ExoplanetPayload | null; failed: boolean; query: string }) {
  const t = useT();
  const hosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exo?.hosts ?? []).filter(h => !q || h.name.toLowerCase().includes(q) || h.planets.some(p => p[0].toLowerCase().includes(q)));
  }, [exo, query]);

  if (!exo && failed) return <EmptyState icon={CloudOff} title={t('The Exoplanet Archive did not answer')} body={t('It tries again every minute while this is open.')} />;
  if (!exo) return <p className="px-4 py-6 text-small text-ink-3">{t('Asking the NASA Exoplanet Archive…')}</p>;
  if (!hosts.length) return <EmptyState icon={SearchX} title={t('No star or planet matches “{query}”', { query: query.trim() })} body={t('Try a catalogue name such as TRAPPIST-1 or Kepler-452 b.')} />;
  return (
    <div className="px-4 pb-4">
      {hosts.slice(0, HOSTS_SHOWN).map(h => <HostRow key={h.name} h={h} />)}
      {hosts.length > HOSTS_SHOWN && (
        <p className="pt-3 text-meta text-ink-3">
          {t('The nearest {shown} of {total}. Search to find the rest.', { shown: HOSTS_SHOWN, total: hosts.length })}
        </p>
      )}
    </div>
  );
}
