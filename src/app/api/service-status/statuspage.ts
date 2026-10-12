/**
 * TAKIP — vendor status from Atlassian Statuspage summaries (/api/v2/summary.json), no key; each vendor's own terms.
 * Self-reported and slow to go red. The pin is the vendor's HQ city, a placement of convenience, not where the
 * outage is. Not on Statuspage: AWS, GCP, Azure, Anthropic, Zoom, GitLab, Heroku, Hetzner. SendGrid now redirects to Twilio's page.
 */

export interface Vendor { id: string; name: string; host: string; city: string; lat: number; lng: number }

export const VENDORS: Vendor[] = [
  { id: 'github', name: 'GitHub', host: 'www.githubstatus.com', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { id: 'cloudflare', name: 'Cloudflare', host: 'www.cloudflarestatus.com', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { id: 'openai', name: 'OpenAI', host: 'status.openai.com', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { id: 'discord', name: 'Discord', host: 'status.discord.com', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { id: 'twilio', name: 'Twilio', host: 'status.twilio.com', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { id: 'npm', name: 'npm', host: 'status.npmjs.org', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { id: 'statuspage', name: 'Atlassian Statuspage', host: 'metastatuspage.com', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { id: 'atlassian', name: 'Atlassian', host: 'status.atlassian.com', city: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { id: 'datadog', name: 'Datadog', host: 'status.datadoghq.com', city: 'New York', lat: 40.7128, lng: -74.006 },
  { id: 'digitalocean', name: 'DigitalOcean', host: 'status.digitalocean.com', city: 'New York', lat: 40.7128, lng: -74.006 },
  { id: 'mongodb', name: 'MongoDB', host: 'status.mongodb.com', city: 'New York', lat: 40.7128, lng: -74.006 },
  { id: 'snowflake', name: 'Snowflake', host: 'status.snowflake.com', city: 'Bozeman', lat: 45.677, lng: -111.0429 },
  { id: 'linode', name: 'Linode (Akamai)', host: 'status.linode.com', city: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
];

export type Indicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance';
const RANK: Record<Indicator, number> = { none: 0, maintenance: 1, minor: 2, major: 3, critical: 4 };

export interface Incident { name: string; status: string; impact: string; url: string | null; started_at: string | null; update: string | null }

export interface VendorStatus {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  indicator: Indicator;
  description: string;
  /** Unresolved incidents; scheduled maintenance is left out. */
  incidents: Incident[];
  url: string;
}

interface Summary {
  page?: { url?: string };
  status?: { indicator?: string; description?: string };
  incidents?: { name?: string; status?: string; impact?: string; shortlink?: string; started_at?: string; incident_updates?: { body?: string }[] }[];
}

export function mapSummary(vendor: Vendor, json: unknown): VendorStatus {
  const s = json as Summary | null;
  const raw = s?.status?.indicator;
  if (!s?.status || typeof raw !== 'string') throw new Error(`${vendor.name}: not a Statuspage summary`);
  const indicator: Indicator = raw in RANK ? (raw as Indicator) : 'minor';
  return {
    id: vendor.id,
    name: vendor.name,
    city: vendor.city,
    lat: vendor.lat,
    lng: vendor.lng,
    indicator,
    description: s.status.description ?? '',
    incidents: (s.incidents ?? []).map(i => ({
      name: i.name ?? 'Incident',
      status: i.status ?? '',
      impact: i.impact ?? '',
      url: i.shortlink ?? null,
      started_at: i.started_at ?? null,
      update: i.incident_updates?.[0]?.body?.slice(0, 280) ?? null,
    })),
    url: s.page?.url || `https://${vendor.host}`,
  };
}

/** Vendors with something to report, one map pin per HQ city, worst first. */
export function degradedByCity(statuses: VendorStatus[]) {
  const byCity = new Map<string, VendorStatus[]>();
  for (const v of statuses) {
    if (v.indicator === 'none' && !v.incidents.length) continue;
    byCity.set(v.city, [...(byCity.get(v.city) ?? []), v]);
  }
  return [...byCity.values()].map(list => {
    const sorted = [...list].sort((a, b) => RANK[b.indicator] - RANK[a.indicator] || b.incidents.length - a.incidents.length);
    return { city: sorted[0].city, lat: sorted[0].lat, lng: sorted[0].lng, worst: sorted[0].indicator, vendors: sorted };
  });
}
