/**
 * TAKIP TI Assist: what TI did on the map, as a person would say it.
 *
 * The tools report back in words meant for the model ("on: maritime ·
 * off: fires", "Flew to Hormuz (26.57, 56.25), zoom 7"); the conversation
 * shows "Switched on Ships · Switched off Fires" and "Flew to Hormuz".
 */
import type { ActionView } from '@/lib/oi/assist/client';

/** Short names for the map layers TI can switch, as the Layers panel would say them. */
const LAYER_NAME: Record<string, string> = {
  flights: 'Airliners', private: 'Private planes', jets: 'Business jets', military: 'Military aircraft', maritime: 'Ships',
  satellites: 'Satellites', cctv: 'Cameras', live_news: 'Live news', earthquakes: 'Earthquakes', fires: 'Fires', weather: 'Weather warnings',
  radiation: 'Radiation', infrastructure: 'Infrastructure', global_incidents: 'Disaster alerts', alert_pins: 'News pins', war_alerts: 'Air-raid alerts',
  airport_delays: 'Airport delays', chokepoint_flow: 'Chokepoint traffic', outbreaks: 'Outbreaks', day_night: 'Day and night', cables: 'Undersea cables',
  live_clouds: 'Clouds', wx_temperature: 'Temperature', wx_wind: 'Wind', wx_radar: 'Rain radar', hiking_routes: 'Hiking routes', terrain_3d: '3D terrain',
  cyber_attacks: 'Cyber attacks', gdelt_events: 'GDELT events', cf_outages: 'Internet outages', malware: 'Malware servers', balloons: 'Balloons',
  launches: 'Rocket launches', aurora: 'Aurora', service_status: 'Service status', gps_jamming: 'GPS interference',
};

const PANEL_NAME: Record<string, string> = { markets: 'Markets', alerts: 'Alerts', intel: 'Recon', layers: 'Layers', directions: 'Route', forecast: 'Forecast', workspace: 'the workspace' };

export const layerName = (k: string) => LAYER_NAME[k] ?? cap(k.replace(/_/g, ' '));
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const arg = (a: ActionView, k: string) => (typeof a.args[k] === 'string' || typeof a.args[k] === 'number' ? String(a.args[k]) : '');

/** The layers an action switched, on and off. */
export function layerChange(a: ActionView): { on: string[]; off: string[] } {
  return { on: list(a.args.on), off: list(a.args.off) };
}

/** Where a go_to action landed, from its result: "Flew to Hormuz (26.57, 56.25), zoom 7". */
export function flewTo(a: ActionView): { name: string; lat: number; lng: number; zoom: number } | null {
  const m = a.summary?.match(/^Flew to (.+) \((-?[\d.]+), (-?[\d.]+)\), zoom ([\d.]+)/);
  return m ? { name: m[1], lat: Number(m[2]), lng: Number(m[3]), zoom: Number(m[4]) } : null;
}

/**
 * One line for an action: what it is doing while it runs, what it did once done.
 * `carded`: a result card under the turn already shows what it found, so the line only names the act.
 */
export function actionLine(a: ActionView, carded = false): string {
  const done = a.status === 'ok';
  if (a.status === 'error') return cap(a.summary || 'That did not work');
  switch (a.tool) {
    case 'go_to': {
      const at = flewTo(a);
      if (at) return `Flew to ${at.name}`;
      return `Flying to ${arg(a, 'place') || [arg(a, 'lat'), arg(a, 'lng')].filter(Boolean).join(', ') || 'a place'}`;
    }
    case 'layers': {
      const { on, off } = layerChange(a);
      return [
        on.length ? `${done ? 'Switched' : 'Switching'} on ${on.map(layerName).join(', ')}` : '',
        off.length ? `${done ? 'Switched' : 'Switching'} off ${off.map(layerName).join(', ')}` : '',
      ].filter(Boolean).join(' · ') || 'Layers';
    }
    case 'open': return `${done ? 'Opened' : 'Opening'} ${PANEL_NAME[arg(a, 'panel')] ?? arg(a, 'panel')}`;
    case 'map_view': return done && a.summary ? `Switched to the ${a.summary}` : 'Changing the map';
    case 'forecast': return done ? (carded ? 'Started a forecast' : `Started a forecast: ${arg(a, 'question')}`) : `Starting a forecast: ${arg(a, 'question')}`;
    case 'workspace': return a.args.open === false ? 'Closed the workspace' : `${done ? 'Opened' : 'Opening'} the workspace${arg(a, 'view') ? ` on the ${arg(a, 'view')}` : ''}`;
    case 'clear': return done ? 'Cleared the marks' : 'Clearing the marks';
  }
  const what = `${arg(a, 'layer') ? layerName(arg(a, 'layer')) : 'the map'}${arg(a, 'text') ? ` “${arg(a, 'text')}”` : ''}${arg(a, 'near') ? ` near ${arg(a, 'near')}` : ''}`;
  const lens = arg(a, 'near') ? `a camera near ${arg(a, 'near')}` : 'a camera';
  if (done && carded) {
    switch (a.tool) {
      case 'find': return `Searched ${what}`;
      case 'scan': return 'Read what is in view';
      case 'camera': return `Looked through ${lens}`;
      case 'show': return `Listed ${arg(a, 'title') || 'results'}`;
      case 'markets': return `Read ${list(a.args.symbols).join(', ') || 'the markets'}`;
    }
  }
  if (done && a.summary) return cap(a.summary);
  switch (a.tool) {
    case 'find': return `Finding ${what}`;
    case 'scan': return 'Reading what is in view';
    case 'camera': return `Looking through ${lens}`;
    case 'highlight': {
      const n = Array.isArray(a.args.points) ? a.args.points.length : 0;
      return `Marking ${n} place${n === 1 ? '' : 's'}`;
    }
    case 'show': return `Listing ${arg(a, 'title') || 'results'}`;
    case 'markets': return `Reading ${list(a.args.symbols).join(', ') || 'the markets'}`;
    case 'select': return `Opening ${arg(a, 'name')}`;
    default: return cap(a.summary || '');
  }
}
