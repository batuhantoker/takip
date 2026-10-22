import type { AlertKind } from './digest';
import { toStory } from './gdelt-alerts';

/** A Live Alerts report as /api/news sends it — only the fields a pin reads. */
export interface PinnedReport {
  id: string;
  alert_kind?: string;
  title: string;
  source_name: string;
  lean?: string | null;
  published: string;
  link?: string | null;
  coords?: [number, number] | null;
  place?: { name: string; label: string; precision: string } | null;
  media?: { kind?: string; video?: string | null; thumb?: string | null; duration?: string | null } | null;
}

/** GDELT's stories (/api/gdelt-events) as pins beside the reports: events, placed where GDELT put them. */
export function storyPins(events: unknown[]): PinnedReport[] {
  const now = Date.now();
  return events.flatMap(e => {
    const s = toStory(e, now);
    return s ? [{
      id: s.id, alert_kind: 'event', title: s.title, source_name: `GDELT · ${s.outlets}`, published: new Date(s.ts).toISOString(),
      link: s.link, coords: [s.lat, s.lng] as [number, number], place: { name: s.place, label: s.place, precision: s.precision },
    }] : [];
  });
}

/** A report posted this recently gets the pulsing ring. */
const ALERT_FRESH_MS = 15 * 60_000;

/** What a pin carries: flat, as map feature properties must be. */
export interface AlertPinProps {
  id: string;
  kind: AlertKind;
  /** Reports pinned to this same place, this one included. */
  stack: number;
  /** Posted in the last quarter of an hour. */
  fresh: boolean;
  title: string;
  source_name: string;
  lean: string;
  published: string;
  link: string;
  place_name: string;
  place_label: string;
  precision: string;
  media_kind: string;
  video: string;
  thumb: string;
  duration: string;
}

export interface AlertPinFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: AlertPinProps;
}

export function alertPinFeatures(reports: PinnedReport[], alertPinIds: string[] | null): AlertPinFeature[] {
  /* The feed hides what its filters exclude; the map follows it, so a search
     or a theatre filter narrows the pins to the reports being read. */
  const shown = alertPinIds ? new Set(alertPinIds) : null;
  const now = Date.now();

  const placed = reports.flatMap((n): { n: PinnedReport; lat: number; lng: number }[] => {
    if (!n?.place || !Array.isArray(n.coords)) return [];
    const [lat, lng] = n.coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    if (shown && !shown.has(n.id)) return [];
    return [{ n, lat, lng }];
  });

  // How many reports name each place, so a town can say it carries several.
  const perPlace = new Map<string, number>();
  for (const { lat, lng } of placed) {
    const key = `${lat},${lng}`;
    perPlace.set(key, (perPlace.get(key) ?? 0) + 1);
  }

  return placed.map(({ n, lat, lng }): AlertPinFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id: n.id,
      kind: n.alert_kind === 'rocket' || n.alert_kind === 'event' ? n.alert_kind : 'news',
      stack: perPlace.get(`${lat},${lng}`) ?? 1,
      fresh: now - Date.parse(n.published) < ALERT_FRESH_MS,
      title: n.title,
      source_name: n.source_name,
      lean: n.lean ?? '',
      published: n.published,
      link: n.link ?? '',
      place_name: n.place!.name,
      place_label: n.place!.label,
      precision: n.place!.precision,
      media_kind: n.media?.kind ?? '',
      video: n.media?.video ?? '',
      thumb: n.media?.thumb ?? '',
      duration: n.media?.duration ?? '',
    },
  }));
}
