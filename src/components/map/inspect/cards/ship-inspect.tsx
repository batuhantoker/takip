'use client';

import type { ReactNode } from 'react';
import { Ship } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { Property, PropertyList } from '@/components/ui/property-list';
import { Stat } from '@/components/ui/stat';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import type { MapRef } from '@/components/map/types';
import { course } from '@/lib/map/course';
import { SHIP_CLASSES, UNDERWAY_KNOTS } from '@/lib/feeds/maritime/ship-filter';
import { ago, bearing, compass, num } from '@/components/map/inspect/format';
import { InspectCard, SourceLinks, StatRow, WhereRow } from '@/components/map/inspect/parts/inspect-card';
import { MoveActions } from '@/components/map/inspect/parts/inspect-actions';
import type { LiveShip } from '@/components/map/inspect/live';
import type { ShipTarget } from '@/components/map/inspect/types';
import { useAge, useFollow } from '@/components/map/inspect/use-follow';
import { describePlace, usePlaceName } from '@/components/map/inspect/use-place-name';

export function ShipInspect({ target, live, mapRef, onClose, nearby }: {
  target: ShipTarget;
  live: LiveShip | null;
  mapRef: MapRef;
  onClose: () => void;
  /** The aircraft and ships around it. */
  nearby?: ReactNode;
}) {
  const t = useT();
  const lat = live?.lat ?? target.lat;
  const lng = live?.lng ?? target.lng;
  const { following, setFollowing } = useFollow(mapRef, { lat, lng }, `ship:${target.id}`);
  const place = usePlaceName(lat, lng);
  const age = useAge(live);

  const type = live?.type ?? target.type;
  const shipClass = SHIP_CLASSES.find(c => c.type === type)?.label;
  const typeLabel = shipClass ? t(shipClass) : t('Vessel');
  const speed = num(live?.speed ?? target.speed);
  const hdg = course(live?.heading ?? target.heading, speed);
  const destination = String(live?.destination ?? target.destination ?? '').trim();
  const flag = live?.flag ?? target.flag;
  const name = String(live?.name ?? target.name ?? '').trim();
  const mmsi = encodeURIComponent(target.mmsi);

  return (
    <InspectCard
      icon={Ship}
      title={name && name !== target.mmsi ? name : t('Unnamed vessel')}
      subtitle={[typeLabel, flag].filter(Boolean).join(' · ')}
      tags={<>
        {speed != null && <Tag>{speed >= UNDERWAY_KNOTS ? t('Under way') : t('Stationary')}</Tag>}
        {!live && <Tag tone="amber">{t('No recent position')}</Tag>}
      </>}
      onClose={onClose}
      headerActions={<MoveActions mapRef={mapRef} lat={lat} lng={lng} zoom={11} following={following} onFollow={setFollowing} share={{ kind: 'ship', id: target.id }} />}
      footer={<span>{live ? `AIS · ${ago(age, t)}` : t('Not in the latest AIS update')}</span>}
    >
      <StatRow>
        <Stat size="sm" label={t('Speed')} value={speed != null ? speed.toFixed(1) : '—'} unit="kn" />
        {hdg != null && <Stat size="sm" label={t('Heading')} value={bearing(hdg)} unit={compass(hdg)} />}
      </StatRow>
      <PanelSection title={t('Voyage')} className="mt-6">
        <PropertyList>
          <Property label={t('Destination')} value={destination || t('Not reported')} mono={false} />
          {flag && <Property label={t('Flag')} value={flag} mono={false} />}
          <Property label="MMSI" value={target.mmsi} mono />
        </PropertyList>
      </PanelSection>
      <PanelSection title={t('Where')}>
        <WhereRow lat={lat} lng={lng} place={describePlace(t, place, 'in')} />
      </PanelSection>
      {nearby}
      <PanelSection title={t('Open in')}>
        <SourceLinks links={[
          { href: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`, label: 'MarineTraffic' },
          { href: `https://www.vesselfinder.com/vessels/details/${mmsi}`, label: 'VesselFinder' },
        ]} />
      </PanelSection>
    </InspectCard>
  );
}
