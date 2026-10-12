import { ALERT_KINDS, timeAgo, type AlertKind } from './alert-digest';
import type { FlightRoute } from './flight-path';
import type { ScheduledRoute } from './flight-watch';
import type { AlertPinProps } from './map-alert-pins';
import { SHIP_CLASSES, shipColor } from './ship-filter';
import { weatherLabel } from './weather-field';

type FeatureProps = NonNullable<GeoJSON.GeoJsonProperties>;

/** What /api/flight-route adds to the schedule when given a position. */
export type ScheduleReply = ScheduledRoute & {
  progress?: number;
  totalDistanceKm?: number;
  departureTime?: string | null;
  arrivalTime?: string | null;
};

const pStyle = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;`;
const linkStyle = `display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;font-family:'JetBrains Mono',monospace;`;

// ── XSS PROTECTION HELPERS ──
export const htmlEsc = (s: any): string => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export const idSafe = (s: any): string => String(s ?? '').replace(/[^a-zA-Z0-9_\.\-]/g, '');
// Escaped for an href/src attribute: a quote in a feed URL would otherwise open a handler.
export const urlSafe = (s: any): string => { const u = String(s ?? ''); return /^https?:\/\//i.test(u) ? htmlEsc(u) : '#'; };

const formatTime = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });
  } catch { return '—'; }
};

export const muted = (text: string) => `<span style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;">${text}</span>`;
const airportCell = (label: string, ap: { iata?: string; icao: string; city?: string } | null, right = false) =>
  `<div${right ? ' style="text-align:right;"' : ''}><span style="color:#5C5A54;font-size:8px;">${label}</span><br/>` +
  `<span style="color:#E8E6E0;font-size:13px;font-weight:700;">${ap ? htmlEsc(ap.iata || ap.icao) : '····'}</span> ` +
  `<span style="color:#5C5A54;font-size:9px;">${htmlEsc(ap?.city || '')}</span></div>`;

export function flightPopupHtml(p: FeatureProps, coords: number[], cs: string, icao: string, routeLoadingId: string, known: (v: unknown, filler: string) => string): string {
  return `<div style="${pStyle}border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#E8E6E0;font-size:15px;font-weight:700;letter-spacing:0.08em;">${htmlEsc(cs)}</span>
            <span style="color:#5C5A54;font-size:10px;">${htmlEsc(p.icao24||'')}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px;">
            <div><span style="color:#5C5A54;font-size:9px;">MODEL</span><br/><span id="ac-model-${icao}" style="color:#B0BEC5;">${htmlEsc(known(p.model, 'Unknown'))}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">ALT</span><br/><span style="color:#B0BEC5;">${p.alt?Math.round(p.alt)+'m':'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">SPEED</span><br/><span style="color:#B0BEC5;">${p.speed_knots||'—'}kt</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">HDG</span><br/><span style="color:#B0BEC5;">${Math.round(p.heading||0)}°</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">REG</span><br/><span id="ac-reg-${icao}" style="color:#B0BEC5;">${htmlEsc(known(p.registration, 'N/A'))}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">POS</span><br/><span style="color:#B0BEC5;">${coords[1].toFixed(2)},${coords[0].toFixed(2)}</span></div>
          </div>
          ${icao ? `<div id="ac-op-${icao}" style="margin-top:6px;color:#78909C;font-size:9px;"></div>` : ''}
          <button onclick="window.takipWatchFlight && window.takipWatchFlight({ icao24: '${icao}', callsign: '${idSafe(cs)}' })" style="width:100%;margin-top:8px;padding:6px 12px;background:rgba(0,229,255,0.10);border:1px solid rgba(0,229,255,0.35);color:#7FE9FF;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:bold;letter-spacing:0.1em;border-radius:4px;cursor:pointer;">+ WATCH THIS AIRCRAFT</button>
          <div id="${routeLoadingId}" style="margin-top:8px;padding:6px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            ${muted('RESOLVING ROUTE…')}
          </div>
          <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">
            <a href="https://www.flightaware.com/live/flight/${encodeURIComponent(cs)}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">FLIGHTAWARE</a>
            <a href="https://globe.adsbexchange.com/?icao=${encodeURIComponent(p.icao24||'')}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">ADS-B</a>
            <a href="https://www.radarbox.com/data/flights/${encodeURIComponent(cs)}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">RADARBOX</a>
          </div>
        </div>`;
}

export function flightRouteEndsHtml(origin: FlightRoute['origin'], destination: FlightRoute['destination']): string {
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              ${airportCell('FROM', origin)}<span style="color:#5C5A54;font-size:11px;">&rarr;</span>${airportCell('TO', destination, true)}
            </div>`;
}

export function flightScheduleHtml(ends: string, sched: ScheduleReply): string {
  const pct = Math.round((sched.progress || 0) * 100);
  const distKm = sched.totalDistanceKm || 0;
  return `${ends}
              <div style="height:2px;background:rgba(255,255,255,0.06);border-radius:1px;margin:6px 0;"><div style="width:${pct}%;height:100%;background:rgba(255,255,255,0.35);border-radius:1px;"></div></div>
              <div style="display:flex;justify-content:space-between;font-size:10px;color:#78909C;">
                <span>DEP ${formatTime(sched.departureTime ?? null)}</span>
                <span>${pct}% &middot; ${distKm.toLocaleString()}km</span>
                <span>ARR ${formatTime(sched.arrivalTime ?? null)}</span>
              </div>`;
}

export function earthquakePopupHtml(p: FeatureProps, coords: number[]): string {
  const link = p.source === 'NIGGG-BAS'
    ? { href: 'https://ndc.niggg.bas.bg/', label: 'NIGGG-BAS' }
    : p.source === 'EMSC'
      ? { href: urlSafe(p.url), label: 'EMSC DETAILS' }
      : { href: `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(p.id||'')}`, label: 'USGS DETAILS' };
  // A twin credited to the same network is the same solution, not a second opinion.
  const twin = p.twin_source
    ? `<div style="font-size:9px;color:#5C5A54;margin-top:6px;">ALSO ${htmlEsc(p.twin_source)} M${htmlEsc(p.twin_magnitude)}${p.twin_network ? ` · ${htmlEsc(p.twin_network)}` : ''}</div>`
    : '';
  return `<div style="${pStyle}border:1px solid rgba(255,149,0,0.3);">
        <div style="color:#FF9500;font-size:14px;font-weight:700;margin-bottom:4px;">M${htmlEsc(p.magnitude)} EARTHQUAKE</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${htmlEsc(p.place||'Unknown location')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">DEPTH</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.depth||'—')}km</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}</span></div>
        </div>${twin}
        <a href="${link.href}" target="_blank" style="${linkStyle}color:#FF9500;border:1px solid rgba(255,149,0,0.4);background:rgba(255,149,0,0.1);">📊 ${link.label}</a>
      </div>`;
}

export function firePopupHtml(p: FeatureProps, coords: number[]): string {
  return `<div style="${pStyle}border:1px solid rgba(255,107,0,0.3);">
        <div style="color:#FF6B00;font-size:12px;font-weight:700;margin-bottom:6px;">🔥 ACTIVE FIRE DETECTED</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">BRIGHTNESS</span><br/><span style="color:#FF6B00;">${p.brightness||'—'}K</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <a href="https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;l:noaa20-viirs,viirs,modis_a,modis_t;@${coords[0]},${coords[1]},10z" target="_blank" style="${linkStyle}color:#FF6B00;border:1px solid rgba(255,107,0,0.4);background:rgba(255,107,0,0.1);">🛰️ NASA FIRMS MAP</a>
      </div>`;
}

export function malwarePopupHtml(p: FeatureProps): string {
  const tType = (p.threat_type || 'malware').replace(/_/g, ' ').toUpperCase();
  const statusColor = p.status === 'online' ? '#39FF14' : '#FF1744';
  const place = [p.city, p.country].filter(Boolean).join(', ') || 'UNKNOWN';
  const host = p.as_name ? `AS${p.asn} ${p.as_name}` : '';
  const urls = Number(p.url_count) || 1;
  // Every field below is observed. Where the old popup linked to a generic
  // browse page, this links to the specific URLhaus report behind the node.
  const ref = urlSafe(p.reference);

  return `<div style="${pStyle}border:1px solid rgba(255,23,68,0.4);box-shadow:inset 0 0 12px rgba(255,23,68,0.1);min-width:250px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,23,68,0.3);padding-bottom:6px;margin-bottom:8px;">
          <div style="color:#FF1744;font-size:12px;font-weight:700;letter-spacing:0.1em;text-shadow:0 0 4px rgba(255,23,68,0.5);">[ ${htmlEsc(tType)} ]</div>
          <div style="color:#5C5A54;font-size:9px;">${htmlEsc(place)}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:2px;">${htmlEsc(p.malware || 'Unclassified payload')}</div>
        ${host ? `<div style="color:#5C5A54;font-size:9px;margin-bottom:10px;">${htmlEsc(host)}</div>` : '<div style="margin-bottom:10px;"></div>'}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;">
          <div><span style="color:#5C5A54;">HOST</span><br/><span style="color:#00E5FF;font-family:monospace;">${htmlEsc(p.ip)}:${htmlEsc(String(p.port ?? 0))}</span></div>
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${statusColor};">${htmlEsc((p.status||'unknown').toUpperCase())}</span></div>
          <div><span style="color:#5C5A54;">LIVE URLS</span><br/><span style="color:#E8E6E0;">${urls}</span></div>
          <div><span style="color:#5C5A54;">LAST REPORT</span><br/><span style="color:#E8E6E0;">${htmlEsc((p.last_seen || '').split(' ')[0] || '—')}</span></div>
        </div>
        <div style="color:#5C5A54;font-size:9px;margin-bottom:10px;">First seen ${htmlEsc((p.first_seen || '').split(' ')[0] || '—')}${p.reporter ? ` · reported by ${htmlEsc(p.reporter)}` : ''}</div>
        <div style="display:flex;gap:6px;">
          ${ref ? `<a href="${ref}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:#E8E6E0;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);">URLHAUS REPORT ↗</a>` : ''}
        </div>
      </div>`;
}

const QUAD_COLOR: Record<string, string> = { '1': '#00E676', '2': '#00E5FF', '3': '#FF9500', '4': '#FF3D3D' };

export function gdeltEventPopupHtml(p: FeatureProps): string {
  const accent = QUAD_COLOR[String(p.quad)] ?? '#9B978E';
  const src = urlSafe(p.url);
  const tone = Number(p.tone);
  return `
      <div style="${pStyle}border:1px solid ${accent}66;min-width:250px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${accent};box-shadow:0 0 8px ${accent};"></span>
          <span style="color:${accent};font-size:10px;font-weight:700;letter-spacing:0.15em;">${htmlEsc(p.quad_label)}</span>
        </div>
        <div style="color:#E8E6E0;font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.name)}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;color:#9B978E;">
          <span style="opacity:0.6;">Goldstein</span><span style="color:${Number(p.goldstein) < 0 ? '#FF3D3D' : '#00E676'};">${htmlEsc(p.goldstein)}</span>
          <span style="opacity:0.6;">Avg tone</span><span style="color:${tone < 0 ? '#FF9500' : '#00E676'};">${htmlEsc(p.tone)}</span>
          <span style="opacity:0.6;">Articles</span><span style="color:#E8E6E0;">${htmlEsc(p.articles)}</span>
          <span style="opacity:0.6;">Country</span><span style="color:#E8E6E0;">${htmlEsc(p.country || '—')}</span>
        </div>
        <div style="margin-top:8px;font-size:9px;color:#5C5A54;">GDELT 2.0 · ${htmlEsc(String(p.date).slice(0, 16).replace('T', ' '))}Z</div>
        ${src !== '#' ? `<a href="${src}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${accent};border:1px solid ${accent}66;background:${accent}1a;">SOURCE ARTICLE</a>` : ''}
      </div>`;
}

export function outagePopupHtml(p: FeatureProps): string {
  // MapLibre serialises feature properties, so booleans can arrive as strings.
  const ongoing = p.ongoing === true || p.ongoing === 'true';
  const accent = ongoing ? '#FFB300' : '#8B7325';
  const src = urlSafe(p.url);
  return `
      <div style="${pStyle}border:1px solid ${accent}66;min-width:250px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${accent};box-shadow:0 0 8px ${accent};"></span>
          <span style="color:${accent};font-size:10px;font-weight:700;letter-spacing:0.15em;">
            ${ongoing ? 'ONGOING OUTAGE' : 'RESOLVED OUTAGE'}
          </span>
        </div>
        <div style="color:#E8E6E0;font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.country_name)}</div>
        ${p.description ? `<div style="color:#9B978E;font-size:10px;line-height:1.6;margin-bottom:8px;">${htmlEsc(p.description)}</div>` : ''}
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;color:#9B978E;">
          <span style="opacity:0.6;">Cause</span><span style="color:#E8E6E0;">${htmlEsc(p.cause || 'Unspecified')}</span>
          <span style="opacity:0.6;">Scope</span><span style="color:#E8E6E0;">${htmlEsc(p.scope || 'Nationwide')}</span>
          <span style="opacity:0.6;">Started</span><span style="color:#E8E6E0;">${htmlEsc(String(p.start).slice(0, 16).replace('T', ' '))}</span>
          ${p.end ? `<span style="opacity:0.6;">Ended</span><span style="color:#E8E6E0;">${htmlEsc(String(p.end).slice(0, 16).replace('T', ' '))}</span>` : ''}
        </div>
        <div style="margin-top:8px;font-size:9px;color:#5C5A54;">Cloudflare Radar</div>
        ${src !== '#' ? `<a href="${src}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${accent};border:1px solid ${accent}66;background:${accent}1a;">RADAR DETAIL</a>` : ''}
      </div>`;
}

export function attackOriginPopupHtml(p: FeatureProps): string {
  return `
      <div style="${pStyle}border:1px solid rgba(255,61,61,0.4);min-width:230px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="width:7px;height:7px;border-radius:50%;background:#FF3D3D;box-shadow:0 0 8px #FF3D3D;"></span>
          <span style="color:#FF3D3D;font-size:10px;font-weight:700;letter-spacing:0.15em;">L3 ATTACK ORIGIN</span>
        </div>
        <div style="color:#E8E6E0;font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.country_name)}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;color:#9B978E;">
          <span style="opacity:0.6;">Share</span><span style="color:#FF6B6B;font-weight:700;">${htmlEsc(p.share)}%</span>
          <span style="opacity:0.6;">Code</span><span style="color:#E8E6E0;">${htmlEsc(p.country)}</span>
        </div>
        <div style="margin-top:8px;font-size:9px;color:#5C5A54;line-height:1.5;">
          Share of observed layer-3 attack traffic by origin · Cloudflare Radar
        </div>
      </div>`;
}

export function incidentPopupHtml(p: FeatureProps): string {
  // These are GDACS alerts and each one carries its own report URL. This
  // used to guess a Liveuamap regional war map from the coordinates
  // instead, which sent every event outside the six hardcoded boxes — all
  // of the Americas, Asia and Oceania among them — to the Ukraine map.
  const src = urlSafe(p.url);
  // GDACS is a natural-disaster feed. Every event here was headed
  // "CONFLICT EVENT" — on a live sample that mislabelled 342 of 369
  // events, nearly all of them wildfires.
  const KIND: Record<string, [string, string]> = {
    earthquake: ['🌐 EARTHQUAKE',   '#FF9500'],
    wildfire:   ['🔥 WILDFIRE',     '#FF6B1A'],
    flood:      ['🌊 FLOOD',        '#00B0FF'],
    weather:    ['🌀 TROPICAL CYCLONE', '#00E5FF'],
    volcano:    ['🌋 VOLCANO',      '#FF3D3D'],
    drought:    ['☀️ DROUGHT',      '#FFD500'],
  };
  const [kindLabel, kindColor] = KIND[String(p.kind)] ?? ['⚠️ GLOBAL INCIDENT', '#FF3D3D'];

  return `<div style="${pStyle}border:1px solid ${kindColor}4d;">
        <div style="color:${kindColor};font-size:12px;font-weight:700;margin-bottom:6px;">${kindLabel}</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.name||'Unclassified incident')}</div>
        ${src !== '#' ? `<a href="${src}" target="_blank" rel="noopener noreferrer" style="${linkStyle}flex:1;text-align:center;color:${kindColor};border:1px solid ${kindColor}66;background:${kindColor}26;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ OPEN SOURCE ↗ ]</a>` : ''}
      </div>`;
}

export function conflictPopupHtml(p: FeatureProps, coords: number[]): string {
  const color = p.severity === 'war' ? '#FF1744' : p.severity === 'high' ? '#FF9500' : '#FFD500';
  return `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:6px;">⚠️ ${htmlEsc(p.label || 'WARNING EVENT')}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.description || 'Global event detected at this location.')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${color};">${(p.severity||'unknown').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        ${p.sourceUrl ? `<a href="${urlSafe(p.sourceUrl)}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:${color};border:1px solid ${color}40;background:${color}15;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ OPEN SOURCE ↗ ]</a>` : ''}
      </div>`;
}

const SDK_SOURCE_URLS: Record<string, string> = {
  'AIS Maritime': 'https://www.marinetraffic.com',
  'AIS Stream': 'https://aisstream.io',
  'AIS → Lattice': 'https://aisstream.io',
  'ADS-B / OpenSky': 'https://opensky-network.org',
  'ADS-B → Lattice': 'https://opensky-network.org',
  'Naval Intelligence': 'https://www.odni.gov',
};

export function sdkLinkPopupHtml(p: FeatureProps): string {
  const srcUrl = p.url || SDK_SOURCE_URLS[p.source] || '/';
  const domainLabel = p.domain === 'SEA' ? '⚓ MARITIME' : p.domain === 'AIR' ? '✈ AIR CORRIDOR' : '🛡 NAVAL INTEL';
  const domainColor = p.domain === 'SEA' ? '#4FC3F7' : p.domain === 'AIR' ? '#B3E5FC' : '#81D4FA';
  const linkStyle = 'text-decoration:none;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:0.05em;';
  return `<div style="${pStyle}border:1px solid ${domainColor}40;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${domainColor};box-shadow:0 0 8px ${domainColor};"></div>
            <span style="color:${domainColor};font-size:11px;font-weight:700;letter-spacing:0.1em;">${domainLabel}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;">
            <div><span style="color:#5C5A54;">FROM</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.fromName || 'Origin')}</span></div>
            <div><span style="color:#5C5A54;">TO</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.toName || 'Destination')}</span></div>
            <div><span style="color:#5C5A54;">DOMAIN</span><br/><span style="color:${domainColor};">${p.domain}</span></div>
            <div><span style="color:#5C5A54;">SOURCE</span><br/><a href="${urlSafe(srcUrl)}" target="_blank" style="color:${domainColor};text-decoration:underline;cursor:pointer;">${htmlEsc(p.source || 'TAKIP')}</a></div>
          </div>
          <a href="${urlSafe(srcUrl)}" target="_blank" style="${linkStyle}color:${domainColor};border:1px solid ${domainColor}40;background:${domainColor}18;display:inline-block;margin-top:4px;">OPEN SOURCE ↗</a>
        </div>`;
}

/* ── Botnet C2 infrastructure (abuse.ch Feodo Tracker) ──
   Every field below is read off the blocklist row. The popup used to lead
   with a randomly chosen attack verb and a fabricated attacker origin;
   what a row actually supports is an address, a family, a hosting
   country and two observation timestamps. */
export function c2ServerPopupHtml(p: FeatureProps): string {
  const online = p.status === 'online';
  const c = online ? '#FF6D00' : '#8A8880';
  const row = (label: string, value: string, color = '#E8E6E0', mono = false) =>
    `<div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">${label}</span><br/><span style="color:${color};${mono ? 'font-family:monospace;' : ''}">${value}</span></div>`;
  return `<div style="${pStyle}border:1px solid ${c}40;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${c}30;padding-bottom:6px;margin-bottom:8px;">
          <div style="color:${c};font-size:12px;font-weight:700;letter-spacing:0.12em;">BOTNET C2 SERVER</div>
          <div style="font-size:8px;padding:2px 6px;border-radius:3px;font-weight:700;letter-spacing:0.1em;background:${c}20;color:${c};border:1px solid ${c}50;">${htmlEsc((p.status || 'unknown').toUpperCase())}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:10px;">${htmlEsc(p.malware || 'Family not reported')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.35);padding:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.04);">
          ${row('C2 ADDRESS', htmlEsc(p.ip || '—'), '#00E5FF', true)}
          ${row('PORT', htmlEsc(String(p.port ?? '—')), '#FFD600', true)}
          ${row('HOSTED IN', htmlEsc(p.country || 'Not reported'))}
          ${row('AS', htmlEsc(p.as_number ? `AS${p.as_number}` : '—'), '#E8E6E0', true)}
          ${row('FIRST SEEN', htmlEsc(p.first_seen || 'Not reported'))}
          ${row('LAST ONLINE', htmlEsc(p.last_online || 'Not reported'))}
        </div>
        ${p.hostname ? `<div style="font-size:9px;color:#8A8880;margin-bottom:8px;font-family:monospace;word-break:break-all;">${htmlEsc(p.hostname)}</div>` : ''}
        <div style="font-size:8px;color:#5C5A54;line-height:1.5;margin-bottom:8px;">Blocklist entry, not an observed attack. Marker sits at the hosting country's centroid, not the host's location.</div>
        <div style="font-size:7px;color:#5C5A54;text-align:center;letter-spacing:0.1em;">SOURCE: <a href="${urlSafe(p.source_url || 'https://feodotracker.abuse.ch/browse/')}" target="_blank" style="color:${c};text-decoration:underline;">ABUSE.CH FEODO TRACKER ↗</a></div>
      </div>`;
}

export function scanTargetPopupHtml(p: FeatureProps, coords: number[]): string {
  return `<div style="${pStyle}border:1px solid rgba(255,61,61,0.5);">
        <div style="color:#FF3D3D;font-size:12px;font-weight:700;margin-bottom:6px;">🎯 TARGET: ${htmlEsc(p.id)}</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${htmlEsc(p.city || 'Unknown')}, ${htmlEsc(p.country || 'Unknown')} — ${htmlEsc(p.isp || 'Unknown ISP')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">TYPE</span><br/><span style="color:#00E5FF;">${(p.type || 'UNKNOWN').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
      </div>`;
}

export function supplierPopupHtml(p: FeatureProps): string {
  const color = p.risk_level === 'CRITICAL' ? '#FF1744' : p.risk_level === 'HIGH' ? '#FF9500' : '#00BCD4';
  const activeThreats = p.active_threats ? JSON.parse(p.active_threats) : [];
  
  let threatsHtml = '';
  if (activeThreats.length > 0) {
    threatsHtml = `<div style="margin-top:8px;padding-top:6px;border-top:1px solid ${color}40;color:${color};font-size:9px;font-weight:bold;">
          ACTIVE THREATS:<br/>${activeThreats.map((t: string) => `⚠ ${htmlEsc(t)}`).join('<br/>')}
        </div>`;
  }

  return `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">🏢 ${htmlEsc(p.name)}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${htmlEsc(p.category)} | ${htmlEsc(p.city)}, ${htmlEsc(p.country)}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">SCM RISK LEVEL</span><br/><span style="color:${color};font-weight:bold;">${p.risk_level}</span></div>
        </div>
        ${threatsHtml}
      </div>`;
}

export function sweepDevicePopupHtml(p: FeatureProps): string {
  const ports = JSON.parse(p.ports || '[]');
  const vulns = JSON.parse(p.vulns || '[]');
  const hostnames = JSON.parse(p.hostnames || '[]');
  const riskColors: Record<string, string> = { CRITICAL: '#FF3D3D', HIGH: '#FF6B00', MEDIUM: '#FFD700', LOW: '#76FF03', INFO: '#5C5A54' };
  return `<div style="font-family:monospace;font-size:11px;color:#E8E6E0;">
        <div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:${p.color};">${p.device_type}</div>
        <div style="font-size:12px;margin-bottom:8px;color:#fff;">${p.ip}</div>
        ${hostnames.length > 0 ? `<div style="font-size:9px;color:#8A8880;margin-bottom:6px;">${hostnames.join(', ')}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">PORTS</span><br/><span style="color:#E8E6E0;">${ports.length}</span></div>
          <div><span style="color:#5C5A54;">RISK</span><br/><span style="color:${riskColors[p.risk_level] || '#666'};">${p.risk_level}</span></div>
        </div>
        <div style="font-size:9px;color:#8A8880;margin-bottom:6px;">Open: ${ports.slice(0, 12).join(', ')}${ports.length > 12 ? ' ...' : ''}</div>
        ${vulns.length > 0 ? `<div style="font-size:9px;color:#FF3D3D;margin-bottom:6px;">⚠ CVEs: ${vulns.slice(0, 5).join(', ')}${vulns.length > 5 ? ` +${vulns.length - 5} more` : ''}</div>` : ''}
      </div>`;
}

export function balloonPopupHtml(p: FeatureProps): string {
  return `<div style="${pStyle}border:1px solid ${p.color}40;">
        <div style="color:${p.color};font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🎈 ${p.callsign}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.type.toUpperCase()} / STATUS: ${p.status.toUpperCase()}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">ALTITUDE</span><br/><span style="color:#E8E6E0;">${p.altitude} m</span></div>
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:#E8E6E0;">${Math.round(p.speed)} km/h</span></div>
          <div><span style="color:#5C5A54;">VERT RATE</span><br/><span style="color:${p.verticalRate > 0 ? '#00E676' : '#FF3D3D'};">${p.verticalRate.toFixed(1)} m/s</span></div>
          <div><span style="color:#5C5A54;">TEMP</span><br/><span style="color:#E8E6E0;">${p.temperature}°C</span></div>
        </div>
      </div>`;
}

const RAD_COLORS: Record<string, string> = { SPIKE: '#FF9500', ELEVATED: '#FFB300', OFFLINE: '#8A877F', UNRATED: '#B39DDB' };

/** What the status means for this reading; UNRATED and OFFLINE are not "normal". */
function radiationVerdict(p: FeatureProps): string {
  const base = Number.isFinite(Number(p.baseline)) ? `${p.baseline} nSv/h` : null;
  const delta = Number(p.delta);
  switch (p.status) {
    case 'SPIKE':
    case 'ELEVATED':
      return `${delta >= 0 ? '+' : ''}${delta} over its 7-day mean${base ? ` of ${base}` : ''}. Rain washing radon out of the air does this for a few hours.`;
    case 'NORMAL':
      return `Within its own previous week${base ? ` (mean ${base})` : ''}.`;
    case 'OFFLINE':
      return 'No reading for over 6 hours; this is the last one it sent.';
    default:
      return 'No history to judge this reading against.';
  }
}

export function radiationPopupHtml(p: FeatureProps): string {
  const color = RAD_COLORS[String(p.status)] ?? '#AB47BC';
  const t = Date.parse(String(p.time ?? ''));
  const when = Number.isFinite(t) ? `${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC` : '—';
  const place = [p.city, p.country].filter(Boolean).map(htmlEsc).join(', ');
  return `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">☢️ ${htmlEsc(p.name)}</div>
        ${place ? `<div style="font-size:9px;color:#aaa;margin-bottom:8px;">${place}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">READING</span><br/><span style="color:${color};font-weight:bold;">${htmlEsc(p.reading)} nSv/h</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">STATUS</span><br/><span style="color:${color};">${htmlEsc(p.status)}</span><br/><span style="color:#aaa;font-size:9px;">${htmlEsc(radiationVerdict(p))}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">MEASURED</span><br/><span style="color:#E8E6E0;">${htmlEsc(when)}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">NETWORK</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.network)}</span></div>
        </div>
      </div>`;
}

export function weatherPointPopupHtml(p: Record<string, unknown>, coords: GeoJSON.Position): string {
  const color = '#4FC3F7';
  const val = (v: unknown, unit: string, digits = 0) => (v == null || v === '' || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toFixed(digits)}${unit}`);
  const compass = (deg: unknown) => {
    const d = Number(deg);
    return Number.isFinite(d) ? ['N','NE','E','SE','S','SW','W','NW'][Math.round(((d % 360) + 360) % 360 / 45) % 8] : '';
  };
  const cell = (label: string, value: string) => `<div><span style="color:#5C5A54;">${label}</span><br/><span style="color:${color};font-family:monospace;">${value}</span></div>`;
  return `<div style="${pStyle}border:1px solid ${color}60;min-width:220px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${color}40;padding-bottom:6px;margin-bottom:8px;">
          <div style="color:${color};font-size:12px;font-weight:700;letter-spacing:0.1em;">[ WEATHER ]</div>
          <div style="color:#5C5A54;font-size:9px;">${htmlEsc(p.hour ?? '')}</div>
        </div>
        <div style="color:#E8E6E0;font-size:20px;font-weight:bold;">${val(p.temp, '°C', 1)}</div>
        <div style="color:#E8E6E0;font-size:10px;margin-bottom:10px;">${htmlEsc(weatherLabel(p.code == null ? null : Number(p.code)))}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;">
          ${cell('WIND', `${val(p.wind, ' km/h')} ${compass(p.windDir)}`)}
          ${cell('GUSTS', val(p.gust, ' km/h'))}
          ${cell('PRECIP (1H)', val(p.precip, ' mm', 1))}
          ${cell('CLOUD', val(p.cloud, '%'))}
        </div>
        <div style="color:#5C5A54;font-size:9px;">${coords[1].toFixed(0)}°, ${coords[0].toFixed(0)}° · 10° grid sample · Open-Meteo (CC BY 4.0)</div>
      </div>`;
}

export function shipPopupHtml(p: FeatureProps, coords: number[]): string {
  const color = shipColor(p.type);
  const icon = p.type === 'military' ? '⚔️' : p.type === 'tanker' ? '🛢️' : '🚢';
  const typeLabel = SHIP_CLASSES.find(c => c.type === p.type)?.label ?? 'Vessel';
  const num = (v: unknown, digits: number, unit: string) => (v == null || v === '' || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toFixed(digits)}${unit}`);
  
  return `<div style="${pStyle}border:1px solid ${color}60;box-shadow:inset 0 0 12px ${color}15;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${color}40;padding-bottom:6px;margin-bottom:8px;">
          <div style="color:${color};font-size:12px;font-weight:700;letter-spacing:0.1em;">${icon} [ ${htmlEsc(typeLabel.toUpperCase())} ]</div>
          <div style="color:#5C5A54;font-size:9px;">MMSI ${htmlEsc(p.mmsi)}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:10px;">${htmlEsc(p.name || 'UNIDENTIFIED VESSEL')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;">
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:${color};font-family:monospace;">${num(p.speed, 1, ' kn')}</span></div>
          <div><span style="color:#5C5A54;">HEADING</span><br/><span style="color:${color};font-family:monospace;">${num(p.heading, 0, '°')}</span></div>
          <div><span style="color:#5C5A54;">LATITUDE</span><br/><span style="color:#E8E6E0;font-family:monospace;">${coords[1].toFixed(4)}°</span></div>
          <div><span style="color:#5C5A54;">LONGITUDE</span><br/><span style="color:#E8E6E0;font-family:monospace;">${coords[0].toFixed(4)}°</span></div>
        </div>
        <div><span style="color:#5C5A54;font-size:9px;">DESTINATION: </span><span style="color:#E8E6E0;font-size:9px;">${htmlEsc(p.destination || 'UNKNOWN')}</span></div>
        <a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${idSafe(p.mmsi)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}flex:1;text-align:center;color:${color};border:1px solid ${color}40;background:${color}15;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ OPEN SOURCE ↗ ]</a>
      </div>`;
}

export function weatherEventPopupHtml(p: FeatureProps, coords: number[]): string {
  const iconEmoji = p.icon === 'cyclone' ? '🌀' : p.icon === 'volcano' ? '🌋' : p.icon === 'flood' ? '🌊' : p.icon === 'drought' ? '🏜️' : p.icon === 'ice' ? '🧊' : p.icon === 'weather' ? '⚠️' : p.icon === 'alert' ? '🚨' : '⚡';
  return `<div style="${pStyle}border:1px solid rgba(224,64,251,0.3);max-width:320px;">
        <div style="color:#E040FB;font-size:14px;font-weight:700;margin-bottom:6px;">${iconEmoji} ${htmlEsc(p.type || 'Weather Event')}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.title || 'Unknown event')}</div>
        ${p.area ? `<div style="font-size:9px;color:#aaa;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.area)}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${p.severity === 'high' ? '#FF1744' : '#FFD700'};">${htmlEsc(String(p.severity || 'low').toUpperCase())}</span></div>
          <div><span style="color:#5C5A54;">${p.provider ? 'ISSUER' : 'COORDS'}</span><br/><span style="color:#E8E6E0;">${p.provider ? htmlEsc(p.provider) : `${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°`}</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          ${p.source ? `<a href="${urlSafe(p.source)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:#E040FB;border:1px solid rgba(224,64,251,0.4);background:rgba(224,64,251,0.1);">📡 SOURCE</a>` : ''}
        </div>
      </div>`;
}

export function nuclearPopupHtml(p: FeatureProps, coords: number[]): string {
  const status = String(p.status ?? '');

  // Same order and colours as the infra-dots paint expression above, so the
  // popup's accent always matches the dot the user just clicked.
  const accent =
    status.includes('SEISMIC RISK') ? '#E65100' :
    status === 'Active Conflict Zone' ? '#D32F2F' :
    status.includes('Decommission') ? '#546E7A' :
    status === 'Under Construction' ? '#FFA726' :
    '#26A69A';

  // A facility with no reactor (waste storage, enrichment) and a research
  // reactor rated in thermal MW both carry 0 here — neither is an electrical
  // figure, so both render as "—" rather than as a real 0 MWe.
  const row = (label: string, value: string, color = '#E8E6E0') =>
    `<div><span style="color:#5C5A54;">${label}</span><br/><span style="color:${color};">${value}</span></div>`;

  const ref = p.sourceUrl
    ? `<a href="${htmlEsc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${accent};border:1px solid ${accent}66;background:${accent}1A;">REFERENCE</a>`
    : '';

  return `<div style="${pStyle}border:1px solid ${accent}4D;">
        <div style="color:${accent};font-size:14px;font-weight:700;margin-bottom:2px;">☢️ ${htmlEsc(p.name || 'Nuclear Facility')}</div>
        <div style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;margin-bottom:10px;">${htmlEsc([p.city, p.country].filter(Boolean).join(', ')) || '—'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 6px;font-size:9px;">
          ${row('STATUS', htmlEsc(status) || '—', accent)}
          ${row('OWNER', htmlEsc(p.owner) || '—')}
          ${row('REACTORS', p.reactors ? htmlEsc(p.reactors) : '—', accent)}
          ${row('CAPACITY', p.capacityMW ? `${Number(p.capacityMW).toLocaleString()} MWe` : '—')}
        </div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);font-size:9px;color:#5C5A54;">
          ${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${ref}
          <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},14z/data=!3m1!1e3" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:#8A8880;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.04);">SATELLITE</a>
        </div>
      </div>`;
}

export function portPopupHtml(p: FeatureProps): string {
  const typeColor = p.type === 'naval' ? '#FF3D3D' : p.type === 'energy' ? '#FF9500' : '#00BCD4';
  const typeLabel = p.type === 'naval' ? 'NAVAL BASE' : p.type === 'energy' ? 'ENERGY PORT' : 'CONTAINER PORT';
  
  const congestionHtml = p.congestion ? `
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div><span style="color:#5C5A54;font-size:9px;">CONGESTION</span><br/><span style="color:${p.congestion === 'SEVERE' ? '#FF1744' : p.congestion === 'CONGESTED' ? '#FF9500' : '#00E676'};font-weight:bold;font-size:10px;">${p.congestion}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">EST. DWELL TIME</span><br/><span style="color:#E8E6E0;font-weight:bold;font-size:10px;">${p.dwell_time || 'Unknown'}</span></div>
          </div>
        </div>` : '';

  return `<div style="${pStyle}border:1px solid ${typeColor}40;">
        <div style="color:${typeColor};font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="color:#999;font-size:9px;margin-bottom:6px;">${typeLabel} — ${p.country}</div>
        ${p.volume ? `<div style="font-size:9px;color:#aaa;">Volume: <span style="color:${typeColor};font-weight:bold;">${p.volume}</span></div>` : ''}
        ${p.fleet ? `<div style="font-size:9px;color:#aaa;">Fleet: <span style="color:${typeColor};font-weight:bold;">${p.fleet}</span></div>` : ''}
        ${p.rank ? `<div style="font-size:9px;color:#aaa;">Global Rank: <span style="color:${typeColor};font-weight:bold;">#${p.rank}</span></div>` : ''}
        ${congestionHtml}
      </div>`;
}

export function chokepointPopupHtml(p: FeatureProps): string {
  const riskCol = p.risk === 'CRITICAL' ? '#FF1744' : p.risk === 'HIGH' ? '#FF9500' : p.risk === 'ELEVATED' ? '#FFD700' : '#00E676';
  return `<div style="${pStyle}border:1px solid ${riskCol}40;">
        <div style="color:#FF9500;font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="font-size:9px;color:#aaa;">Traffic: <span style="color:#fff;">${p.traffic}</span></div>
        <div style="font-size:9px;color:#aaa;">Risk: <span style="color:${riskCol};font-weight:bold;">${p.risk}</span></div>
      </div>`;
}

export const alertPopupHtml = (reports: AlertPinProps[]) => {
  const [p, ...rest] = reports;
  const c = (ALERT_KINDS[p.kind as AlertKind] ?? ALERT_KINDS.news).color;
  const label = (ALERT_KINDS[p.kind as AlertKind] ?? ALERT_KINDS.news).label;
  const link = urlSafe(p.link);
  const video = urlSafe(p.video);
  const thumb = urlSafe(p.thumb);
  /* Footage plays in place where Telegram serves the file; a video it
     only shows in the app gets its preview and a way through to it. */
  const media = video !== '#'
    ? `<video src="${video}"${thumb !== '#' ? ` poster="${thumb}"` : ''} controls playsinline preload="none" style="display:block;width:100%;max-height:180px;margin-top:10px;border-radius:6px;background:#000;"></video>`
    : thumb !== '#'
      ? `<a href="${link}" target="_blank" rel="noopener noreferrer" style="display:block;position:relative;margin-top:10px;">
              <img src="${thumb}" referrerpolicy="no-referrer" alt="" style="display:block;width:100%;max-height:180px;object-fit:cover;border-radius:6px;">
              ${p.media_kind === 'video' ? `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:#fff;font-size:9px;letter-spacing:0.1em;padding:4px 10px;border-radius:12px;">▶ WATCH ON TELEGRAM${p.duration ? ` · ${htmlEsc(p.duration)}` : ''}</span>` : ''}
            </a>`
      : '';
  const more = rest.slice(0, 4).map(r => {
    const rc = (ALERT_KINDS[r.kind as AlertKind] ?? ALERT_KINDS.news).color;
    return `<a href="${urlSafe(r.link)}" target="_blank" rel="noopener noreferrer" style="display:flex;gap:6px;align-items:baseline;color:#C9C5BC;text-decoration:none;font-size:10px;line-height:1.35;margin-top:5px;">
          <span style="flex:none;width:6px;height:6px;border-radius:50%;background:${rc};transform:translateY(-1px);"></span>
          <span>${htmlEsc(r.title)} <span style="color:#5C5A54;">· ${htmlEsc(r.source_name)} · ${htmlEsc(timeAgo(r.published))}</span></span>
        </a>`;
  }).join('');
  return `
      <div style="${pStyle}border:1px solid ${c}66;width:300px;max-width:100%;padding:14px;max-height:min(44vh,440px);overflow-y:auto;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:9.5px;letter-spacing:0.12em;">
          <span style="width:7px;height:7px;border-radius:50%;background:${c};box-shadow:0 0 8px ${c};"></span>
          <span style="color:${c};font-weight:700;">${label}</span>
          <span style="color:#8A8880;margin-left:auto;">${htmlEsc(timeAgo(p.published))}</span>
        </div>
        <div style="color:#F2EFE8;font-family:Inter,system-ui,sans-serif;font-size:12.5px;font-weight:600;line-height:1.35;">${htmlEsc(p.title)}</div>
        <div style="margin-top:6px;font-size:9.5px;color:#8A8880;">${htmlEsc(p.source_name)}${p.lean ? ` · <span style="color:#9B978E;">${htmlEsc(p.lean)}</span>` : ''}</div>
        <div style="margin-top:6px;font-size:9.5px;color:${c};" title="The place the post names, resolved against OpenStreetMap. Town-level: a post names a place, not an exact spot.">📍 ${htmlEsc(p.place_label)}<span style="color:#5C5A54;"> · ${p.precision === 'region' ? 'region' : 'place'} named in the post · © OpenStreetMap</span></div>
        ${media}
        ${link !== '#' ? `<a href="${link}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${c};border:1px solid ${c}66;background:${c}1a;">OPEN POST ↗</a>` : ''}
        ${more ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);"><div style="font-size:8.5px;letter-spacing:0.14em;color:#5C5A54;">ALSO HERE</div>${more}</div>` : ''}
      </div>`;
};
