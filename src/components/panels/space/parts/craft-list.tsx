'use client';

import { useMemo, useState } from 'react';
import { CloudOff, History, SearchX } from 'lucide-react';
import { Disclosure } from '@/components/ui/disclosure';
import { IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { REGION_LABEL, REGION_ORDER, type FleetCraft, type FleetPayload, type Region } from '@/lib/space/fleet';
import { lightTime } from '@/lib/space/format';
import { requestWorld } from '@/lib/space/world-events';
import { DistanceCell } from './distance-cell';

const START_FOLDED: Region[] = ['earth-orbit'];

const focusFor = (r: Region) =>
  r === 'moon' ? 'moon' : r === 'mars' ? 'mars' : r === 'earth-orbit' || r === 'cislunar' ? 'earth' : 'solar';

/** Who flies it and when it went up (or ended); never the Horizons ID, which means nothing to a person. */
function aboutCraft(c: FleetCraft): string | undefined {
  const launched = c.cospar && /^\d{4}-/.test(c.cospar) ? `launched ${c.cospar.slice(0, 4)}` : null;
  const parts = [c.agency, c.ended ? `ended ${c.ended}` : launched].filter(Boolean) as string[];
  if (!parts.length) return undefined;
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function CraftRow({ c }: { c: FleetCraft }) {
  const about = aboutCraft(c);
  return (
    <ListRow
      title={<span className={c.ended ? 'text-ink-2' : undefined}>{c.name}</span>}
      subtitle={about ? <span className="text-ink-3">{about}</span> : undefined}
      aria-label={`Show ${c.name} in space`}
      onClick={() => requestWorld({ focus: focusFor(c.region), select: { kind: 'craft', id: c.id } })}
      trailing={(
        <>
          <DistanceCell km={c.earthKm} light={lightTime(c.lightSec)} />
          {/* Quiet until the row is pointed at or focused, so a column of identical icons does not shout. */}
          {c.region !== 'earth-orbit' ? (
            <span className="opacity-50 transition-opacity duration-150 group-hover/row:opacity-100 focus-within:opacity-100 motion-reduce:transition-none">
              <IconButton size="sm" icon={History} label={`Watch ${c.name}’s flight`} tooltipSide="left"
                onClick={() => requestWorld({ focus: 'solar', replay: c.id })} />
            </span>
          ) : <span aria-hidden className="size-7" />}
        </>
      )}
    />
  );
}

/** Every spacecraft JPL Horizons can place right now, grouped by where it is. */
export default function CraftList({ fleet, failed, query }: { fleet: FleetPayload | null; failed: boolean; query: string }) {
  const [toggled, setToggled] = useState<Set<Region>>(new Set());
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const craft = (fleet?.craft ?? []).filter(c => !q || `${c.name} ${c.agency ?? ''} ${c.cospar ?? ''}`.toLowerCase().includes(q));
    return REGION_ORDER.map(r => ({ region: r, craft: craft.filter(c => c.region === r) })).filter(g => g.craft.length);
  }, [fleet, query]);

  if (!fleet && failed) return <EmptyState icon={CloudOff} title="JPL Horizons did not answer" body="It tries again every minute while this is open." />;
  if (!fleet) return <p className="px-4 py-6 text-small text-ink-3">Asking JPL Horizons where everything is…</p>;
  if (!groups.length) return <EmptyState icon={SearchX} title={`No spacecraft match “${query.trim()}”`} body="Search by name, agency or COSPAR ID." />;

  const flip = (r: Region) => setToggled(s => {
    const n = new Set(s);
    if (n.has(r)) n.delete(r); else n.add(r);
    return n;
  });

  return (
    <div className="px-4 pb-4">
      {groups.map(({ region, craft }) => {
        const open = query ? true : START_FOLDED.includes(region) === toggled.has(region);
        return (
          <Disclosure key={region} title={REGION_LABEL[region]} hint={craft.length} open={open} onOpenChange={() => flip(region)}>
            {craft.map(c => <CraftRow key={c.id} c={c} />)}
          </Disclosure>
        );
      })}
    </div>
  );
}

