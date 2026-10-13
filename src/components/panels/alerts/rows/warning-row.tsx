'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import type { AlertItem, LocateOptions, WarningAlert } from '@/lib/alerts/live-alerts';
import { AlertRow, Meta } from './alert-row';
import { endsIn, plural, SEVERITY_LABEL, toneLabel, toneOf, until } from '@/components/panels/alerts/format';
import { openLink, SimilarList } from './row-parts';
import { warningHeadline, warningPlace, type WarningPlace } from '@/lib/alerts/warning-copy';

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

/** "Jazan, Saudi Arabia", or for a notice sent to many districts, "Saudi Arabia, 14 areas". */
function whereText(headline: string, place: WarningPlace, others: WarningAlert[]): string | null {
  if (others.length) {
    const countries = new Set(others.map(w => warningPlace(w.area, w.title).country));
    if (place.country && countries.size === 1 && countries.has(place.country)) return `${place.country}, ${others.length + 1} areas`;
    return plural(others.length + 1, 'area');
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
  const headline = warningHeadline(item);
  const place = warningPlace(item.area, item.title);
  const others = otherPlaces(item, similar.filter((s): s is WarningAlert => s.kind === 'warning'));
  const show = (w: WarningAlert) => onLocate(w.lat, w.lng, { zoom: 6 });
  const where = whereText(headline, place, others);
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
        item.expires != null && endsIn(item.expires, now),
      ]} />}
      actions={<>
        <IconButton size="sm" label="Show where it was issued" icon={MapPin} onClick={() => show(item)} />
        {item.url && <IconButton size="sm" label={`Open the ${item.provider} notice`} icon={ExternalLink} onClick={() => openLink(item.url!)} />}
      </>}
    >
      <div className="flex flex-col gap-3">
        {original.length > headline.length + 12 && <p className="text-small text-ink-2">{original}</p>}
        {place.parts.length > 0 && (
          <ul className="flex flex-col gap-1 text-small text-ink-2">
            {place.parts.slice(0, 6).map(p => <li key={p} className="line-clamp-3">{p}</li>)}
            {place.parts.length > 6 && <li className="text-ink-3">and {place.parts.length - 6} more areas</li>}
          </ul>
        )}
        <p className="text-meta text-ink-3">
          Graded {SEVERITY_LABEL[item.severity].toLowerCase()} by {item.provider}
          {item.expires != null && item.expires > now && <> · {until(item.expires, now)}</>}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={MapPin} onClick={() => show(item)}>Show on map</Button>
          {item.url && <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => openLink(item.url!)}>Open notice</Button>}
        </div>
        <SimilarList
          title="Also issued for"
          rows={others.map(w => {
            const p = warningPlace(w.area, w.title);
            return {
              key: w.id,
              label: p.parts.join('; ') || p.short || warningHeadline(w),
              meta: w.expires != null ? endsIn(w.expires, now) : null,
              onClick: () => show(w),
            };
          })}
        />
      </div>
    </AlertRow>
  );
}
