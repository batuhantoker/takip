import { existsSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { Reader, type CityResponse } from 'maxmind';
import type { Logger } from 'pino';
import { silentLogger } from '../obs/logger';

/** Where an address is, as far as the database knows; country is ISO 3166-1 alpha-2. */
export type IpPlace = { country: string | null; region: string | null; city: string | null; latitude: number | null; longitude: number | null };
export type IpLocator = (ip: string) => IpPlace | null;

const CACHE_MAX = 5000;

/** A record with nothing in it (a private or unknown address) reads as no answer. */
export function toPlace(record: CityResponse | null): IpPlace | null {
  if (!record) return null;
  const place = {
    country: record.country?.iso_code ?? record.registered_country?.iso_code ?? null,
    region: record.subdivisions?.[0]?.names?.en ?? null,
    city: record.city?.names?.en ?? null,
    latitude: record.location?.latitude ?? null,
    longitude: record.location?.longitude ?? null,
  };
  return place.country || place.city ? place : null;
}

/**
 * Looks addresses up in the DB-IP Lite city database at `path` (npm run geoip -w @takip/api). The ~130 MB file is
 * read on the first lookup, not at boot; without it every answer is null and one line says why.
 */
export function openIpLocator(path: string, logger: Logger = silentLogger): IpLocator {
  let reader: Reader<CityResponse> | null | undefined;
  const cache = new Map<string, IpPlace | null>();
  return ip => {
    if (!isIP(ip)) return null;
    if (reader === undefined) {
      reader = existsSync(path) ? new Reader<CityResponse>(readFileSync(path)) : null;
      if (!reader) logger.warn({ path }, 'no IP location database; places stay empty until `npm run geoip -w @takip/api`');
    }
    if (!reader) return null;
    if (cache.has(ip)) return cache.get(ip)!;
    const place = toPlace(reader.get(ip));
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(ip, place);
    return place;
  };
}

export const noLocator: IpLocator = () => null;
