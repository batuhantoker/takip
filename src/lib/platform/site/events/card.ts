import type { Translate } from '@/lib/core/i18n/translator';
import { eventHeading, eventYears, kindLabel, placeName } from './copy';
import { findEvent } from './event-page';

/** An event page's share card: its kind, its name, and when and where, on History's picture with the place marked. */
export function eventCard(slug: string, t: Translate) {
  const found = findEvent(slug);
  if (!found || 'redirect' in found) return null;
  const e = found.page;
  return {
    kicker: kindLabel(t, e.kind),
    title: eventHeading(t, e),
    subtitle: [eventYears(t, e), placeName(e)].filter(Boolean).join(' · '),
    focus: e.lat !== null && e.lon !== null ? { lat: e.lat, lon: e.lon } : null,
  };
}
