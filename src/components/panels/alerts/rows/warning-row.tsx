'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { AlertItem, LocateOptions, WarningAlert } from '@/lib/intel/alerts/live-alerts';
import { AlertRow, Meta } from './alert-row';
import { endsIn, toneLabel, toneOf, until } from '@/components/panels/alerts/format';
import { openLink, SimilarList } from './row-parts';
import { warningHeadline, warningPlace, type WarningPlace } from '@/lib/intel/alerts/warning-copy';

/* Issuers send one notice per district, often twice; the folded copies are worth listing once per place. */
function otherPlaces(lead: WarningAlert, others: WarningAlert[]) {
  const seen = new Set([placeKey(lead)]);
  return others.filter(w => {
    const k = placeKey(w);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const placeKey = (w: WarningAlert) => warningPlace(w.area, w.title).parts.join(';') || w.id;

const GRADED: Record<WarningAlert['severity'], string> = {
  high: msg('Graded severe by {provider}'),
  medium: msg('Graded moderate by {provider}'),
  low: msg('Graded advisory by {provider}'),
};

/** "Jazan, Saudi Arabia", or for a notice sent to many districts, "Saudi Arabia, 14 areas". */
function whereText(headline: string, place: WarningPlace, others: WarningAlert[], t: Translate): string | null {
  if (others.length) {
    const countries = new Set(others.map(w => warningPlace(w.area, w.title, t).country));
    if (place.country && countries.size === 1 && countries.has(place.country)) {
      return t('{country}, {n, plural, one {# area} other {# areas}}', { country: place.country, n: others.length + 1 });
    }
    return t('{n, plural, one {# area} other {# areas}}', { n: others.length + 1 });
  }
  // A place the headline already names ("Flood alert in Nepal") is not worth a second mention.
  return place.short && !headline.toLowerCase().includes(place.short.toLowerCase()) ? place.short : null;
}

export default function WarningRow({ item, similar, now, selected, onSelect, onLocate }: {
  item: WarningAlert;
  similar: AlertItem[];
  now: number;
  selected: boolean;
  onSelect: () => void;
  onLocate: (lat: number, lng: number, options?: LocateOptions) => void;
}) {
  const t = useT();
  const headline = warningHeadline(item);
  const place = warningPlace(item.area, item.title, t);
  const others = otherPlaces(item, similar.filter((s): s is WarningAlert => s.kind === 'warning'));
  const show = (w: WarningAlert) => onLocate(w.lat, w.lng, { zoom: 6 });
  const where = whereText(headline, place, others, t);
  const original = item.title.trim();

  return (
    <AlertRow
      tone={toneOf(item)}
      toneLabel={toneLabel(item)}
      title={headline}
      ts={item.ts}
      now={now}
      selected={selected}
      onSelect={onSelect}
      meta={<Meta parts={[
        item.provider,
        where,
        item.expires != null && endsIn(item.expires, now, t),
      ]} />}
      actions={<>
        <IconButton size="sm" label={t('Show where it was issued')} icon={MapPin} onClick={() => show(item)} />
        {item.url && <IconButton size="sm" label={t('Open the {provider} notice', { provider: item.provider })} icon={ExternalLink} onClick={() => openLink(item.url!)} />}
      </>}
    >
      <div className="flex flex-col gap-3">
        {original.length > headline.length + 12 && <p className="text-small text-ink-2">{original}</p>}
        {place.parts.length > 0 && (
          <ul className="flex flex-col gap-1 text-small text-ink-2">
            {place.parts.slice(0, 6).map(p => <li key={p} className="line-clamp-3">{p}</li>)}
            {place.parts.length > 6 && <li className="text-ink-3">{t('and {n} more areas', { n: place.parts.length - 6 })}</li>}
          </ul>
        )}
        <p className="text-meta text-ink-3">
          {t(GRADED[item.severity], { provider: item.provider })}
          {item.expires != null && item.expires > now && <> · {until(item.expires, now, t)}</>}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={MapPin} onClick={() => show(item)}>{t('Show on map')}</Button>
          {item.url && <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => openLink(item.url!)}>{t('Open notice')}</Button>}
        </div>
        <SimilarList
          title={t('Also issued for')}
          rows={others.map(w => {
            const p = warningPlace(w.area, w.title, t);
            return {
              key: w.id,
              label: p.parts.join('; ') || p.short || warningHeadline(w),
              meta: w.expires != null ? endsIn(w.expires, now, t) : null,
              onClick: () => show(w),
            };
          })}
        />
      </div>
    </AlertRow>
  );
}
