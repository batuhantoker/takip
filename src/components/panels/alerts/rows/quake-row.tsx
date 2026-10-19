'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Property, PropertyList } from '@/components/ui/property-list';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { LocateOptions, QuakeAlert } from '@/lib/intel/alerts/live-alerts';
import { AlertRow, Meta } from './alert-row';
import { fullDate, magnitude, position, toneLabel, toneOf } from '@/components/panels/alerts/format';
import { openLink } from './row-parts';

const PAGER: Record<string, string> = {
  green: msg('Little damage'),
  yellow: msg('Some damage possible'),
  orange: msg('Significant damage likely'),
  red: msg('Extensive damage likely'),
};

export default function QuakeRow({ item, now, selected, onSelect, onLocate }: {
  item: QuakeAlert;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onLocate: (lat: number, lng: number, options?: LocateOptions) => void;
}) {
  const t = useT();
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
        item.depth != null && t('{n} km deep', { n: Math.round(item.depth) }),
        item.tsunami && t('tsunami flagged'),
        item.felt ? t('{n, plural, one {felt by # person} other {felt by # people}}', { n: item.felt }) : null,
      ]} />}
      actions={<>
        <IconButton size="sm" label={t('Show on the map')} icon={MapPin} onClick={show} />
        {item.url && <IconButton size="sm" label={t('Open the USGS event page')} icon={ExternalLink} onClick={() => openLink(item.url!)} />}
      </>}
    >
      <div className="flex flex-col gap-3">
        {/* Magnitude and depth are already on the row; the open row adds what it does not say. */}
        <PropertyList>
          <Property label={t('Time')} value={fullDate(item.ts, t)} mono={false} />
          <Property label={t('Epicentre')} value={position(item.lat, item.lng)} />
          {item.felt ? <Property label={t('Felt reports')} value={item.felt.toLocaleString(t.intl)} /> : null}
          {item.tsunami && <Property label={t('Tsunami')} value={t('Flagged by USGS')} />}
          {item.pager && <Property label={t('Expected impact')} value={PAGER[item.pager] ? t(PAGER[item.pager]) : item.pager} />}
        </PropertyList>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={MapPin} onClick={show}>{t('Show on map')}</Button>
          {item.url && <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => openLink(item.url!)}>{t('USGS event page')}</Button>}
        </div>
      </div>
    </AlertRow>
  );
}
