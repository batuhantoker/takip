import { placeOutage, type Outage } from './outage';

/**
 * Cloudflare Radar's outage annotations (/radar/annotations/outages) and traffic anomalies (/radar/traffic_anomalies).
 * Fields are optional because Cloudflare adds and reorders them between API versions. Cloud-region outages
 * (`origins`) and ones given only as GeoNames regions (`geoIds`) have no country here and are left out.
 */

interface Place { code?: string; name?: string }
interface AsnDetail { asn?: string | number; name?: string; location?: Place }

export interface RawAnnotation {
  id?: string;
  locations?: string[];
  locationsDetails?: Place[];
  asnsDetails?: AsnDetail[];
  scope?: string | null;
  outage?: { outageCause?: string; outageType?: string };
  description?: string;
  startDate?: string;
  endDate?: string | null;
  linkedUrl?: string;
}

export interface RawAnomaly {
  uuid?: string;
  type?: string;
  startDate?: string;
  endDate?: string | null;
  locationDetails?: Place | null;
  asnDetails?: AsnDetail | null;
  visibleInDataSources?: string[];
}

const RADAR = 'https://radar.cloudflare.com';
// A detector's start and a person's write-up of the same drop rarely differ by more than this.
const SAME_EVENT_MS = 2 * 3_600_000;

const networkName = (a: AsnDetail) => `AS${a.asn}${a.name ? ` ${a.name}` : ''}`;

/** One pin per country an annotation names, its own or its networks'. */
export function mapAnnotations(annotations: RawAnnotation[]): Outage[] {
  const out: Outage[] = [];
  for (const a of annotations) {
    const names = new Map<string, string>();
    const networks = new Map<string, string[]>();
    for (const d of a.locationsDetails ?? []) if (d.code) names.set(d.code, d.name || d.code);
    for (const n of a.asnsDetails ?? []) {
      const code = n.location?.code;
      if (!code || n.asn == null) continue;
      if (!names.has(code)) names.set(code, n.location?.name || code);
      networks.set(code, [...(networks.get(code) ?? []), networkName(n)]);
    }
    // A network can be registered abroad (Iraq's Earthlink is in the UAE): the countries an annotation names win.
    const located = a.locations ?? [];
    if (located.length === 1) networks.set(located[0], [...networks.values()].flat());
    // A typhoon or an exam shutdown lists the networks it hit too; only a network's own outage is named for them.
    const named = !located.length || a.outage?.outageType === 'NETWORK';
    for (const code of located.length ? located : networks.keys()) {
      const pin = placeOutage(code, {
        id: `${a.id ?? 'outage'}-${code}`,
        source: 'cloudflare',
        kind: 'annotation',
        country_name: names.get(code) || code,
        network: named ? networks.get(code)?.join(', ') ?? null : null,
        // Cloudflare's type (NATIONWIDE, NETWORK, REGIONAL, PLATFORM) where it gives no free-text scope.
        scope: a.scope || a.outage?.outageType || '',
        cause: a.outage?.outageCause || '',
        description: a.description || '',
        start: a.startDate || '',
        end: a.endDate || null,
        ongoing: !a.endDate,
        url: a.linkedUrl || `${RADAR}/outage-center`,
        seen_in: [],
      });
      if (pin) out.push(pin);
    }
  }
  return out;
}

/** Drops Cloudflare's detector saw, unless an annotation for the same country and time already describes one. */
export function mapAnomalies(anomalies: RawAnomaly[], annotated: Outage[]): Outage[] {
  const out: Outage[] = [];
  for (const a of anomalies) {
    const asn = a.type === 'AS' ? a.asnDetails : null;
    const place = asn ? asn.location : a.type === 'LOCATION' ? a.locationDetails : null;
    const code = place?.code;
    if (!code || (asn && asn.asn == null)) continue;
    const start = Date.parse(a.startDate ?? '');
    if (annotated.some(o => o.country === code.toUpperCase() && Math.abs(Date.parse(o.start) - start) <= SAME_EVENT_MS)) continue;
    const pin = placeOutage(code, {
      id: `anomaly-${a.uuid ?? `${code}-${a.startDate}`}`,
      source: 'cloudflare',
      kind: 'anomaly',
      country_name: place?.name || code,
      network: asn ? networkName(asn) : null,
      scope: '',
      cause: '',
      description: '',
      start: a.startDate || '',
      end: a.endDate || null,
      ongoing: !a.endDate,
      url: asn ? `${RADAR}/as${asn.asn}` : `${RADAR}/${code.toLowerCase()}`,
      seen_in: a.visibleInDataSources ?? [],
    });
    if (pin) out.push(pin);
  }
  return out;
}
