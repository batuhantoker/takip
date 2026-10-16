/**
 * TAKIP — Hong Kong Observatory warning signals in force (typhoon signals,
 * rainstorm colours, landslip, tsunami…), no key. HKO open-data terms:
 * free reuse with attribution. HKO publishes nothing through WMO SWIC.
 *
 * `warnsum` is `{}` when nothing is in force; otherwise one object per
 * warning keyed by warning type, each with a `code` (TC8NE, WRAINB…) and an
 * `actionCode`. Shape follows HKO's Open Data API documentation: no warning
 * was in force when this was written.
 */

export const HKO_WARNSUM_URL = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en';
const HONG_KONG = { lat: 22.3193, lng: 114.1694 };

export interface HkoWarning {
  name?: string;
  code?: string;
  type?: string;
  actionCode?: string;
  issueTime?: string;
  updateTime?: string;
  expireTime?: string;
}

export interface HkoEvent {
  id: string;
  title: string;
  category: 'weatherAlerts';
  type: string;
  icon: 'cyclone' | 'weather';
  severity: 'low' | 'medium' | 'high';
  lat: number;
  lng: number;
  date?: string;
  expires?: string;
  area: string;
  source: string;
  provider: 'HKO';
}

const HIGH = new Set(['TC8NE', 'TC8NW', 'TC8SE', 'TC8SW', 'TC9', 'TC10', 'WRAINR', 'WRAINB', 'WTMW']);
const MEDIUM = new Set(['TC3', 'WRAINA', 'WL', 'WFNTSA', 'WMSGNL', 'WTCPRE8']);

export function hkoSeverity(code: string): HkoEvent['severity'] {
  return HIGH.has(code) ? 'high' : MEDIUM.has(code) ? 'medium' : 'low';
}

function iso(s: string | undefined): string | undefined {
  const t = Date.parse(s ?? '');
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

export function parseHkoWarnsum(json: unknown): HkoEvent[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('HKO: unexpected warnsum shape');
  return Object.entries(json as Record<string, HkoWarning>).flatMap(([key, w]) => {
    if (!w || typeof w !== 'object' || /cancel/i.test(w.actionCode ?? '')) return [];
    const code = (w.code || key).toUpperCase();
    const name = w.name?.trim() || key;
    const label = w.type?.trim() ? `${name} — ${w.type.trim()}` : name;
    return [{
      id: `hko-${key}-${code}`,
      title: `${label} (${code})`,
      category: 'weatherAlerts',
      type: name,
      icon: key === 'WTCSGNL' || code.startsWith('TC') ? 'cyclone' : 'weather',
      severity: hkoSeverity(code),
      ...HONG_KONG,
      date: iso(w.updateTime) ?? iso(w.issueTime),
      expires: iso(w.expireTime),
      area: 'Hong Kong',
      source: 'https://www.hko.gov.hk/en/wxinfo/dailywx/wxwarntoday.htm',
      provider: 'HKO',
    }];
  });
}
