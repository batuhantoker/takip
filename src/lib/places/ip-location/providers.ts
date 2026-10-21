import type { IpCandidate } from './consensus';

type Provider = {
  name: string;
  /** `ip` null asks about the caller's own connection (development, where that is the developer's). */
  url: (ip: string | null) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each provider's own JSON
  read: (body: any) => Omit<IpCandidate, 'source'> | null;
  headers?: Record<string, string>;
};

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const coord = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryFromCode = (code: unknown) => {
  const c = text(code);
  try {
    return c ? regionNames.of(c.toUpperCase()) : undefined;
  } catch {
    return c;
  }
};

function at(lat: unknown, lon: unknown, rest: Omit<IpCandidate, 'source' | 'lat' | 'lon'>) {
  const la = coord(lat);
  const lo = coord(lon);
  if (la === null || lo === null || Math.abs(la) > 90 || Math.abs(lo) > 180 || (la === 0 && lo === 0)) return null;
  return { lat: la, lon: lo, ...rest };
}

/* All asked at once; the order breaks ties between equally supported answers. */
export const PROVIDERS: Provider[] = [
  {
    name: 'ipinfo.io',
    url: ip => (ip ? `https://ipinfo.io/${ip}/json` : 'https://ipinfo.io/json'),
    read: d => {
      if (d.bogon || typeof d.loc !== 'string') return null;
      const [lat, lon] = d.loc.split(',');
      return at(lat, lon, {
        query: text(d.ip), city: text(d.city), regionName: text(d.region), country: countryFromCode(d.country),
        tz: text(d.timezone), isp: text(d.org)?.replace(/^AS\d+\s+/, ''), org: text(d.org)?.replace(/^AS\d+\s+/, ''), as: text(d.org),
      });
    },
  },
  {
    // Free tier is plaintext HTTP only; safe here because this is server to server.
    name: 'ip-api.com',
    url: ip => `http://ip-api.com/json/${ip ?? ''}?fields=status,lat,lon,city,regionName,country,query,isp,org,as,timezone`,
    read: d => (d.status !== 'success' ? null : at(d.lat, d.lon, {
      query: text(d.query), city: text(d.city), regionName: text(d.regionName), country: text(d.country),
      tz: text(d.timezone), isp: text(d.isp), org: text(d.org), as: text(d.as),
    })),
  },
  {
    name: 'ipwho.is',
    url: ip => `https://ipwho.is/${ip ?? ''}`,
    read: d => (!d.success ? null : at(d.latitude, d.longitude, {
      query: text(d.ip), city: text(d.city), regionName: text(d.region), country: text(d.country),
      tz: text(d.timezone?.id), isp: text(d.connection?.isp), org: text(d.connection?.org),
      as: d.connection?.asn ? `AS${d.connection.asn} ${d.connection.org ?? ''}`.trim() : undefined,
    })),
  },
  {
    name: 'ipapi.co',
    url: ip => (ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/'),
    headers: { 'User-Agent': 'TAKIP/0.1' },
    read: d => (d.error ? null : at(d.latitude, d.longitude, {
      query: text(d.ip), city: text(d.city), regionName: text(d.region), country: text(d.country_name),
      tz: text(d.timezone), isp: text(d.org), org: text(d.org), as: d.asn ? `${d.asn} ${d.org ?? ''}`.trim() : undefined,
    })),
  },
  {
    // Its timeZones lists every zone of the country, so it can't say which one the address is in.
    name: 'freeipapi.com',
    url: ip => `https://freeipapi.com/api/json/${ip ?? ''}`,
    read: d => at(d.latitude, d.longitude, {
      query: text(d.ipAddress), city: text(d.cityName), regionName: text(d.regionName), country: text(d.countryName),
      isp: text(d.asnOrganization), org: text(d.asnOrganization), as: d.asn ? `AS${d.asn} ${d.asnOrganization ?? ''}`.trim() : undefined,
    }),
  },
];

/** Cloudflare's own placing, when the zone has the "Add visitor location headers" managed transform on. */
export function fromCloudflare(headers: Headers): IpCandidate[] {
  const place = at(headers.get('cf-iplatitude'), headers.get('cf-iplongitude'), {
    city: text(headers.get('cf-ipcity')), regionName: text(headers.get('cf-region')),
    country: countryFromCode(headers.get('cf-ipcountry')), tz: text(headers.get('cf-timezone')),
  });
  return place ? [{ source: 'cloudflare', ...place }] : [];
}
