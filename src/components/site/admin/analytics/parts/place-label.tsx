import { flag, placeShort, placeText } from '../lib/place';

type PlaceLike = { country: string | null; region?: string | null; city?: string | null };

/** A place with its flag, and the address under it when given. */
export function PlaceLabel({ place, ip, short = false }: { place: PlaceLike | null | undefined; ip?: string | null; short?: boolean }) {
  const mark = flag(place?.country);
  const known = !!(place && (place.country || place.city));
  return (
    <span className="min-w-0">
      <span className={known ? 'text-ink-2' : 'text-ink-3'} title={placeText(place)}>
        {mark && <span aria-hidden className="mr-1">{mark}</span>}
        {short ? placeShort(place) : placeText(place)}
      </span>
      {ip && <span className="block font-mono text-[11px] text-ink-3">{ip}</span>}
    </span>
  );
}

/** DB-IP Lite is CC BY 4.0: wherever its places show, it is credited once. */
export function DbIpCredit() {
  return (
    <p className="text-[11px] text-ink-3">
      <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="hover:text-ink-1 hover:underline">IP geolocation by DB-IP</a>
    </p>
  );
}
