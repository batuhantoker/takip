'use client';

import { Bus, CableCar, Ship, TrainFront, TramFront } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { Property, PropertyList } from '@/components/ui/property-list';
import { Stat } from '@/components/ui/stat';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import type { MapRef } from '@/components/map/types';
import { readableRoute, TRANSIT_STATUS, transitKmh, transitTitle, transitWhere } from '@/lib/feeds/transit/describe';
import type { TransitMode } from '@/lib/feeds/transit/modes';
import { TRANSIT_TRACK_MS } from '@/lib/feeds/transit/view';
import { ago, bearing, compass } from '@/components/map/inspect/format';
import { InspectCard, SourceLinks, StatRow, WhereRow } from '@/components/map/inspect/parts/inspect-card';
import { MoveActions } from '@/components/map/inspect/parts/inspect-actions';
import type { TransitTarget } from '@/components/map/inspect/types';
import type { LiveTransit } from '@/components/map/inspect/use-tracked-transit';
import { useAge, useFollow } from '@/components/map/inspect/use-follow';
import { describePlace, usePlaceName } from '@/components/map/inspect/use-place-name';

/** Past this the position is old news: the trip may have ended or the feed stalled. */
const STALE_MS = 5 * 60_000;

const MODE_ICON: Partial<Record<TransitMode, typeof Bus>> = { metro: TrainFront, rail: TrainFront, tram: TramFront, ferry: Ship, cable: CableCar };

export function TransitInspect({ target, live, shown, mapRef, onClose }: {
  target: TransitTarget;
  live: LiveTransit | null;
  /** Where the marker rests, snapped onto the route; the feed's raw fix until then. */
  shown: { lat: number; lng: number } | null;
  mapRef: MapRef;
  onClose: () => void;
}) {
  const t = useT();
  const v = live ?? target;
  const pos = shown ?? { lat: v.lat, lng: v.lng };
  const { following, setFollowing } = useFollow(mapRef, pos, `transit:${target.id}`);
  const place = usePlaceName(pos.lat, pos.lng);
  // The feed's own age when we last heard, plus the time since.
  const age = (v.age ?? 0) * 1000 + useAge(live ?? target);

  const kmh = transitKmh(v.speed);
  const route = readableRoute(v.route);
  const status = transitWhere(v) ?? (v.status != null && TRANSIT_STATUS[v.status] ? t(TRANSIT_STATUS[v.status]) : undefined);
  const stale = age > STALE_MS;

  return (
    <InspectCard
      icon={(v.mode && MODE_ICON[v.mode]) || Bus}
      title={transitTitle(v)}
      subtitle={v.operator || v.feed}
      tags={<>
        {kmh != null && <Tag>{kmh >= 2 ? t('Moving') : t('Stationary')}</Tag>}
        {v.scheduled ? <Tag>{t('Timetable, not live')}</Tag> : v.estimated && <Tag>{t('Estimated position')}</Tag>}
        {stale && <Tag tone="amber">{t('No recent position')}</Tag>}
      </>}
      onClose={onClose}
      headerActions={<MoveActions mapRef={mapRef} lat={pos.lat} lng={pos.lng} zoom={15} following={following} onFollow={setFollowing} />}
      footer={<span>{v.scheduled
        ? t('Where its timetable has it now · this system publishes nothing live')
        : v.estimated
          ? t('Stop reported {ago} · placed from its timetable, not GPS', { ago: ago(age, t) })
          : t('Position {ago} · checked every {n} s', { ago: ago(age, t), n: TRANSIT_TRACK_MS / 1000 })}</span>}
    >
      <StatRow>
        <Stat size="sm" label={t('Speed')} value={kmh != null ? String(kmh) : '—'} unit="km/h" />
        {v.bearing != null && <Stat size="sm" label={t('Heading')} value={bearing(v.bearing)} unit={compass(v.bearing)} />}
      </StatRow>
      <PanelSection title={t('Vehicle')} className="mt-6">
        <PropertyList>
          {route && <Property label={t('Route')} value={route} mono={false} />}
          {!route && v.route && <Property label={t('Route id')} value={v.route} mono />}
          {v.label && <Property label={t('Vehicle')} value={v.label} mono />}
          {v.plate && <Property label={t('Plate')} value={v.plate} mono />}
          {status && <Property label={t('Status')} value={status} mono={false} />}
          {v.operator && v.feed && v.operator !== v.feed && <Property label={t('Feed')} value={v.feed} mono={false} />}
        </PropertyList>
      </PanelSection>
      <PanelSection title={t('Where')}>
        <WhereRow lat={pos.lat} lng={pos.lng} place={describePlace(t, place, 'near')} />
      </PanelSection>
      {v.license && /^https?:\/\//.test(v.license) && (
        <PanelSection title={t('Source')}>
          <SourceLinks links={[{ href: v.license, label: t('Data licence') }]} />
        </PanelSection>
      )}
    </InspectCard>
  );
}
