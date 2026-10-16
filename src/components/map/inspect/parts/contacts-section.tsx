'use client';

import { useMemo } from 'react';
import { Plane, Ship } from 'lucide-react';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { toFeet } from '@/lib/feeds/aviation/flight-watch';
import { CONTACT_RADIUS_KM, nearestContacts } from '@/lib/feeds/contacts';
import { compass } from '@/components/map/inspect/format';
import { requestTrack } from '@/components/map/inspect/track-request';
import { Note } from './inspect-card';

/**
 * The nearest aircraft and ships around this one, nearest first. Picking one opens it, flies there and
 * follows it, as a shared link would.
 */
export function ContactsSection({ data, subject }: {
  data: Record<string, unknown>;
  subject: { kind: 'aircraft' | 'ship'; id: string; lat: number; lng: number };
}) {
  // Rounded, so a moving subject doesn't recount tens of thousands of aircraft on every frame.
  const lat = Math.round(subject.lat * 50) / 50, lng = Math.round(subject.lng * 50) / 50;
  const contacts = useMemo(
    () => nearestContacts(data, { ...subject, lat, lng }, 6),
    // Each poll replaces the arrays; `data` itself is the same object throughout.
    [data.commercial_flights, data.private_flights, data.private_jets, data.military_flights, data.maritime_ships, subject.kind, subject.id, lat, lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <PanelSection title="Nearby" hint={`within ${CONTACT_RADIUS_KM} km`}>
      {contacts.length ? contacts.map(c => {
        const Icon = c.kind === 'aircraft' ? Plane : Ship;
        const detail = c.kind === 'aircraft'
          ? (c.alt != null ? `${toFeet(c.alt).toLocaleString()} ft` : null)
          : (c.speed != null ? `${Math.round(c.speed)} kn` : null);
        return (
          <ListRow
            key={`${c.kind}:${c.id}`}
            compact
            leading={<Icon aria-hidden className="size-4 text-ink-3" strokeWidth={1.75} />}
            title={c.name}
            meta={detail}
            trailing={`${c.km < 10 ? c.km.toFixed(1) : Math.round(c.km)} km ${compass(c.bearing)}`}
            onClick={() => requestTrack({ kind: c.kind, id: c.id })}
            aria-label={`Go to ${c.name} and follow it`}
          />
        );
      }) : <Note>No aircraft or ships in the feeds within {CONTACT_RADIUS_KM} km</Note>}
    </PanelSection>
  );
}
