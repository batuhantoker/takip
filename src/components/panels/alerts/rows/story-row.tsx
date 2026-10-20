'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import type { LocateOptions } from '@/lib/intel/alerts/live-alerts';
import type { StoryAlert } from '@/lib/intel/alerts/gdelt-alerts';
import { AlertRow, Meta } from './alert-row';
import { toneLabel, toneOf } from '@/components/panels/alerts/format';
import { LinkPreviewCard } from '@/components/panels/alerts/parts/link-preview-card';
import { useLinkPreview } from '@/components/panels/alerts/hooks/use-link-preview';
import { Carriers, openLink } from './row-parts';

type Locate = (lat: number, lng: number, options?: LocateOptions) => void;

export const storyTarget = (s: StoryAlert): [number, number, LocateOptions] => [s.lat, s.lng, { zoom: s.precision === 'city' ? 8 : 6 }];

/** "Moscow, Moskva, Russia" → "Moscow, Russia". */
const shortPlace = (name: string) => {
  const parts = name.split(',').map(p => p.trim()).filter(Boolean);
  return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : name;
};

const hhmm = (ts: number) => new Date(ts).toISOString().slice(11, 16);

/** A GDELT story: its lead article's headline, where it is, and how widely it is reported. */
export default function StoryRow({ item, now, selected, onSelect, onLocate }: {
  item: StoryAlert;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onLocate: Locate;
}) {
  const t = useT();
  const { preview, loading } = useLinkPreview(item.link, selected);
  const place = shortPlace(item.place);
  const target = storyTarget(item);

  return (
    <AlertRow
      tone={toneOf(item)}
      toneLabel={toneLabel(item)}
      title={item.title}
      ts={item.ts}
      now={now}
      selected={selected}
      onSelect={onSelect}
      meta={<Meta parts={[
        t('GDELT'),
        place,
        t('{n, plural, one {# outlet} other {# outlets}}', { n: item.outlets }),
      ]} />}
      actions={<>
        <IconButton size="sm" label={t('Show {place} on the map', { place })} icon={MapPin} onClick={() => onLocate(...target)} />
        {item.link && <IconButton size="sm" label={t('Open the article')} icon={ExternalLink} onClick={() => openLink(item.link!)} />}
      </>}
    >
      <div className="flex flex-col gap-3">
        {item.link && <LinkPreviewCard href={item.link} preview={preview} loading={loading} showTitle={preview?.title !== item.title} />}

        <p className="text-small text-ink-2">
          {[item.actors.join(' → '), item.action].filter(Boolean).join(' · ')}
          {item.precision === 'region' && <span className="text-ink-3"> · {t('Placed at the state or province centre')}</span>}
        </p>

        <p className="text-meta text-ink-3">
          {[
            t('{reports, plural, one {# report} other {# reports}} · {outlets, plural, one {# outlet} other {# outlets}}', { reports: item.reports, outlets: item.outlets }),
            item.goldstein != null && t('Goldstein {value}', { value: item.goldstein }),
            item.tone != null && t('tone {value}', { value: item.tone.toFixed(1) }),
            t('GDELT 2.0 · reported {from}–{to} UTC', { from: hhmm(item.first), to: hhmm(item.last) }),
          ].filter(Boolean).join(' · ')}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={MapPin} onClick={() => onLocate(...target)}>{t('Show {place}', { place })}</Button>
          {item.link && <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => openLink(item.link!)}>{t('Open article')}</Button>}
        </div>

        <Carriers title={t('Reports')} now={now}
          rows={item.links.filter(l => !(preview && l.url === item.link)).map(l => ({ key: l.url, name: l.outlet, note: l.title, ts: null, link: l.url }))} />
        <Carriers title={t('Other stories here')} now={now}
          rows={item.others.map(o => ({
            key: o.url, name: o.outlet, ts: null, link: o.url,
            note: [o.title, t('{n, plural, one {# report} other {# reports}}', { n: o.reports })].filter(Boolean).join(' · '),
          }))} />
      </div>
    </AlertRow>
  );
}
