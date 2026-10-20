'use client';

import { Orbit, Satellite } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { Property, PropertyList } from '@/components/ui/property-list';
import { Stat } from '@/components/ui/stat';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { MapRef } from '@/components/map/types';
import { InspectCard, Note, SourceLinks, StatRow, WhereRow } from '@/components/map/inspect/parts/inspect-card';
import { MoveActions } from '@/components/map/inspect/parts/inspect-actions';
import { useFollow } from '@/components/map/inspect/use-follow';
import { placeName, usePlaceName } from '@/components/map/inspect/use-place-name';
import { SatellitePasses } from '@/components/map/inspect/parts/satellite-passes';

/** A picked satellite. The marker sits at altitude, so the card stands in for a popup. */
export interface SatelliteDetail {
  name: string;
  lat: number;
  lng: number;
  /** Kilometres above the ellipsoid — the real figure, not the drawn one. */
  alt: number;
  color?: string;
  mission?: string;
  category?: string;
  noradId?: string;
  /** From the orbit reply; null until it lands or if the TLE gave no period. */
  periodMinutes?: number | null;
  /** Whether the orbit track on the globe is on its way, drawn, or unavailable. */
  track: 'loading' | 'ready' | 'unavailable';
  /** The element set the marker is propagated from, when the catalogue sent it. */
  line1?: string;
  line2?: string;
  /** Picked by a page's frame, not a click: ringed with its orbit, but no card. */
  quiet?: boolean;
}

const EARTH_RADIUS_KM = 6371;

/** GEO is a narrow band, not "anything high": a Molniya apogee is not geostationary. */
function regime(altKm: number): { label: string; note: string } {
  if (altKm < 2000) return { label: 'LEO', note: msg('Low Earth orbit') };
  if (altKm < 35000) return { label: 'MEO', note: msg('Medium Earth orbit') };
  if (altKm <= 36500) return { label: 'GEO', note: msg('Geostationary') };
  return { label: 'HEO', note: msg('High orbit') };
}

/** Circular-orbit speed implied by the period; for scale, not precision. */
const speedKmS = (altKm: number, periodMinutes: number) => (2 * Math.PI * (EARTH_RADIUS_KM + altKm)) / (periodMinutes * 60);

/** Low orbits in minutes, high ones in hours. */
function period(minutes: number): { value: string; unit: string } {
  return minutes < 180 ? { value: String(Math.round(minutes)), unit: 'min' } : { value: (minutes / 60).toFixed(1), unit: 'h' };
}

export function SatelliteInspect({ sat, mapRef, onClose }: { sat: SatelliteDetail; mapRef: MapRef; onClose: () => void }) {
  const t = useT();
  const { following, setFollowing } = useFollow(mapRef, { lat: sat.lat, lng: sat.lng }, `satellite:${sat.noradId ?? sat.name}`);
  const place = usePlaceName(sat.lat, sat.lng);
  const shell = regime(sat.alt);
  const id = sat.noradId ? encodeURIComponent(sat.noradId) : null;
  const mission = sat.mission && sat.mission !== 'Unknown' ? sat.mission : null;

  return (
    <InspectCard
      icon={Satellite}
      title={sat.name}
      subtitle={[mission, t(shell.note)].filter(Boolean).join(' · ')}
      tags={<Tag>{shell.label}</Tag>}
      onClose={onClose}
      headerActions={<MoveActions mapRef={mapRef} lat={sat.lat} lng={sat.lng} zoom={3} following={following} onFollow={setFollowing} share={sat.noradId ? { kind: 'satellite', id: sat.noradId } : undefined} />}
      footer={<span>{t('Position from the latest orbital elements')}</span>}
    >
      <StatRow>
        <Stat size="sm" label={t('Altitude')} value={Math.round(sat.alt).toLocaleString(t.intl)} unit="km" />
        <Stat size="sm" label={t('Speed')} value={sat.periodMinutes ? speedKmS(sat.alt, sat.periodMinutes).toFixed(2) : '—'} unit="km/s" />
        <Stat size="sm" label={t('Period')} value={sat.periodMinutes ? period(sat.periodMinutes).value : '—'} unit={sat.periodMinutes ? period(sat.periodMinutes).unit : undefined} />
      </StatRow>
      <PanelSection title={t('Orbit')} className="mt-6">
        <PropertyList>
          <Property label="NORAD ID" value={sat.noradId || '—'} mono />
          {mission && <Property label={t('Mission')} value={mission} mono={false} />}
        </PropertyList>
        <Note icon={Orbit}>
          {sat.track === 'loading' ? t('Plotting the orbit…') : sat.track === 'ready' ? t('Orbit drawn on the globe') : t('No orbit track for this satellite')}
        </Note>
      </PanelSection>
      {sat.line1 && sat.line2 && <SatellitePasses line1={sat.line1} line2={sat.line2} mapRef={mapRef} />}
      <PanelSection title={t('Directly below')}>
        <WhereRow lat={sat.lat} lng={sat.lng} place={place ? (place.sea ? t('The {sea}', { sea: placeName(t, place) }) : place.name) : null} />
      </PanelSection>
      {id && (
        <PanelSection title={t('Open in')}>
          <SourceLinks links={[
            { href: `https://www.n2yo.com/satellite/?s=${id}`, label: 'N2YO' },
            { href: `https://celestrak.org/satcat/table-satcat.php?CATNR=${id}`, label: 'CelesTrak' },
          ]} />
        </PanelSection>
      )}
    </InspectCard>
  );
}
