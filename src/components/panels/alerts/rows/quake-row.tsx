'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Property, PropertyList } from '@/components/ui/property-list';
import type { LocateOptions, QuakeAlert } from '@/lib/alerts/live-alerts';
import { AlertRow, Meta } from './alert-row';
import { fullDate, magnitude, position, toneLabel, toneOf } from '@/components/panels/alerts/format';
import { openLink } from './row-parts';

const PAGER: Record<string, string> = {
  green: 'Little damage',
  yellow: 'Some damage possible',
  orange: 'Significant damage likely',
  red: 'Extensive damage likely',
};

export default function QuakeRow({ item, now, selected, onSelect, onLocate }: {
  item: QuakeAlert;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onLocate: (lat: number, lng: number, options?: LocateOptions) => void;
}) {
  const show = () => onLocate(item.lat, item.lng);
  return (
    <AlertRow
      tone={toneOf(item)}
      toneLabel={toneLabel(item)}
      title={<><span className="font-mono tabular-nums">{magnitude(item)}</span> · {item.place}</>}
      ts={item.ts}
      now={now}
      selected={selected}
      onSelect={onSelect}
      meta={<Meta parts={[
        'USGS',
        item.depth != null && `${Math.round(item.depth)} km deep`,
        item.tsunami && 'tsunami flagged',
        item.felt ? `felt by ${item.felt.toLocaleString()} people` : null,
      ]} />}
      actions={<>
        <IconButton size="sm" label="Show on the map" icon={MapPin} onClick={show} />
        {item.url && <IconButton size="sm" label="Open the USGS event page" icon={ExternalLink} onClick={() => openLink(item.url!)} />}
      </>}
    >
      <div className="flex flex-col gap-3">
        {/* Magnitude and depth are already on the row; the open row adds what it does not say. */}
        <PropertyList>
          <Property label="Time" value={fullDate(item.ts)} mono={false} />
          <Property label="Epicentre" value={position(item.lat, item.lng)} />
          {item.felt ? <Property label="Felt reports" value={item.felt.toLocaleString()} /> : null}
          {item.tsunami && <Property label="Tsunami" value="Flagged by USGS" />}
          {item.pager && <Property label="Expected impact" value={PAGER[item.pager] ?? item.pager} />}
        </PropertyList>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={MapPin} onClick={show}>Show on map</Button>
          {item.url && <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => openLink(item.url!)}>USGS event page</Button>}
        </div>
      </div>
    </AlertRow>
  );
}
