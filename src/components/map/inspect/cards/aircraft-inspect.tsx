'use client';

import { Eye, EyeOff, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PanelSection } from '@/components/ui/panel';
import { Property, PropertyList } from '@/components/ui/property-list';
import { Stat } from '@/components/ui/stat';
import { Tag } from '@/components/ui/tag';
import type { MapRef } from '@/components/map/types';
import { course } from '@/lib/map/course';
import { toFeet } from '@/lib/flights/watch';
import { ago, bearing, compass, num } from '@/components/map/inspect/format';
import { InspectCard, Note, SourceLinks, StatRow, WhereRow } from '@/components/map/inspect/parts/inspect-card';
import { MoveActions } from '@/components/map/inspect/parts/inspect-actions';
import { FLIGHT_LAYER_LABEL, type LiveFlight } from '@/components/map/inspect/live';
import { RouteBlock } from './route-block';
import type { AircraftTarget } from '@/components/map/inspect/types';
import { useAge, useFollow } from '@/components/map/inspect/use-follow';
import { describePlace, usePlaceName } from '@/components/map/inspect/use-place-name';

const EMERGENCY: Record<string, string> = { '7500': 'Hijack code', '7600': 'Radio failure', '7700': 'Emergency' };

export function AircraftInspect({ target, live, mapRef, watching, onWatch, onUnwatch, onClose }: {
  target: AircraftTarget;
  /** The aircraft in the latest feed, or null once it has dropped out. */
  live: LiveFlight | null;
  mapRef: MapRef;
  watching: boolean;
  onWatch: () => void;
  onUnwatch: () => void;
  onClose: () => void;
}) {
  const lat = live?.lat ?? target.lat;
  const lng = live?.lng ?? target.lng;
  const { following, setFollowing } = useFollow(mapRef, { lat, lng }, `aircraft:${target.id}`);
  const place = usePlaceName(lat, lng);
  const age = useAge(live);

  const airframe = typeof target.airframe === 'object' ? target.airframe : null;
  const model = airframe?.model || airframe?.typeCode || target.model;
  const registration = airframe?.registration || target.registration;
  const title = target.callsign || registration || target.icao24.toUpperCase();
  const subtitle = target.airframe === 'loading' && !model ? 'Identifying the aircraft…'
    : [model || 'Type unknown', airframe?.operator].filter(Boolean).join(' · ');
  const squawk = live?.squawk ? String(live.squawk) : null;
  const emergency = squawk ? EMERGENCY[squawk] : undefined;
  const cs = encodeURIComponent(target.callsign.replace(/\s+/g, ''));

  const altM = num(live?.alt ?? target.alt);
  const speed = num(live?.speed_knots ?? target.speed);
  // Many transponders never set the ground flag; a parked or taxiing aircraft reports about 0 ft and a slow speed.
  const onGround = !!live?.grounded || (altM != null && altM < 30 && (speed ?? 0) < 50);
  const hdg = course(live?.heading ?? target.heading, speed);

  return (
    <InspectCard
      icon={Plane}
      title={title}
      subtitle={subtitle}
      tags={<>
        <Tag>{FLIGHT_LAYER_LABEL[target.layer]}</Tag>
        {onGround && <Tag>On the ground</Tag>}
        {emergency && <Tag tone="red">{emergency} · {squawk}</Tag>}
        {!live && <Tag tone="amber">Out of range</Tag>}
      </>}
      onClose={onClose}
      headerActions={<MoveActions mapRef={mapRef} lat={lat} lng={lng} zoom={8} following={following} onFollow={setFollowing} />}
      footer={<>
        {target.icao24 && (watching
          ? <Button size="sm" icon={EyeOff} onClick={onUnwatch}>Stop watching</Button>
          : <Button size="sm" variant="primary" icon={Eye} onClick={onWatch}>Watch</Button>)}
        <span className="ml-auto">{live ? `ADS-B · ${ago(age)}` : 'No longer in the live feed'}</span>
      </>}
    >
      <StatRow>
        <Stat size="sm" label="Altitude" value={onGround ? '0' : altM != null ? toFeet(altM).toLocaleString() : '—'} unit="ft" />
        <Stat size="sm" label="Speed" value={speed != null ? Math.round(speed) : '—'} unit="kt" />
        {hdg != null && <Stat size="sm" label="Heading" value={bearing(hdg)} unit={compass(hdg)} />}
      </StatRow>
      <PanelSection title="Route" className="mt-6">
        <RouteBlock route={target.route} />
      </PanelSection>
      <PanelSection title="Aircraft">
        <PropertyList>
          <Property label="Registration" value={registration || '—'} mono />
          <Property label="Squawk" value={squawk ? <span className={emergency ? 'text-red' : undefined}>{squawk}</span> : '—'} mono />
          <Property label="ICAO address" value={target.icao24 || '—'} mono />
        </PropertyList>
        {target.airframe === 'unavailable' && <Note>The aircraft registry did not answer.</Note>}
      </PanelSection>
      <PanelSection title="Where">
        <WhereRow lat={lat} lng={lng} place={describePlace(place)} />
      </PanelSection>
      <PanelSection title="Open in">
        <SourceLinks links={[
          !!cs && { href: `https://www.flightaware.com/live/flight/${cs}`, label: 'FlightAware' },
          !!target.icao24 && { href: `https://globe.adsbexchange.com/?icao=${encodeURIComponent(target.icao24)}`, label: 'ADS-B Exchange' },
        ]} />
      </PanelSection>
    </InspectCard>
  );
}
