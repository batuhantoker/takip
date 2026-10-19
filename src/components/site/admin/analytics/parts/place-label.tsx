import type { DeviceBrief } from '../analytics-types';
import { accuracyText, deviceText, flag, placeShort, placeText } from '../lib/place';

type PlaceLike = { country: string | null; region?: string | null; city?: string | null };
type DeviceLike = Pick<DeviceBrief, 'latitude' | 'longitude' | 'accuracyM' | 'label'>;

const TAG = 'ml-1.5 inline-flex h-4 items-center rounded-[3px] border px-1 text-[10px] font-medium uppercase tracking-wide align-[1px]';

/** A place with its flag, and the address under it when given; `fromIp` tags it as the address's guess. */
export function PlaceLabel({ place, ip, short = false, fromIp = false }: { place: PlaceLike | null | undefined; ip?: string | null; short?: boolean; fromIp?: boolean }) {
  const mark = flag(place?.country);
  const known = !!(place && (place.country || place.city));
  return (
    <span className="min-w-0">
      <span className={known ? 'text-ink-2' : 'text-ink-3'} title={placeText(place)}>
        {mark && <span aria-hidden className="mr-1">{mark}</span>}
        {short ? placeShort(place) : placeText(place)}
        {fromIp && <span className={`${TAG} border-line text-ink-3`} title="Guessed from the IP address; can be hundreds of km off">from IP</span>}
      </span>
      {ip && <span className="block font-mono text-[11px] text-ink-3">{ip}</span>}
    </span>
  );
}

/** Where the browser said it was, tagged "shared" with its accuracy. */
export function SharedLabel({ device }: { device: DeviceLike }) {
  const accuracy = accuracyText(device.accuracyM);
  return (
    <span className="min-w-0 text-ink-1" title={`${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}`}>
      {deviceText(device)}
      <span className={`${TAG} border-green/35 text-green`}>shared{accuracy ? ` ${accuracy}` : ''}</span>
    </span>
  );
}

/** Where someone is: their shared location first when they have one, then the IP's guess under it. */
export function WhereLabel({ device, place, ip, short = false }: { device: DeviceLike | null | undefined; place: PlaceLike | null | undefined; ip?: string | null; short?: boolean }) {
  if (!device) return place ? <PlaceLabel place={place} ip={ip} short={short} fromIp /> : <span className="text-ink-3">not placed</span>;
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <SharedLabel device={device} />
      {place && <span className="text-[11px]"><PlaceLabel place={place} ip={ip} short fromIp /></span>}
    </span>
  );
}

/** DB-IP Lite is CC BY 4.0, and Nominatim's names are © OpenStreetMap (ODbL): each is credited where its places show. */
export function DbIpCredit({ osm = false }: { osm?: boolean }) {
  const link = 'hover:text-ink-1 hover:underline';
  return (
    <p className="text-[11px] text-ink-3">
      <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className={link}>IP geolocation by DB-IP</a>
      {osm && <> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className={link}>Place names © OpenStreetMap contributors</a></>}
    </p>
  );
}

/** Just the OpenStreetMap credit, for lists of shared locations alone. */
export function OsmCredit() {
  return (
    <p className="text-[11px] text-ink-3">
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-ink-1 hover:underline">Place names © OpenStreetMap contributors</a>
    </p>
  );
}
