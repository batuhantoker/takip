/**
 * TAKIP TI Assist: what TI did on the map, as a person would say it.
 *
 * The tools report back in words meant for the model ("on: maritime ·
 * off: fires", "Flew to Hormuz (26.57, 56.25), zoom 7"); the conversation
 * shows "Switched on Ships · Switched off Fires" and "Flew to Hormuz".
 */
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { ActionView } from './use-assist';

/** Short names for the map layers TI can switch, as the Layers panel would say them. */
const LAYER_NAME: Record<string, string> = {
  flights: msg('Airliners'), private: msg('Private planes'), jets: msg('Business jets'), military: msg('Military aircraft'), maritime: msg('Ships'),
  satellites: msg('Satellites'), cctv: msg('Cameras'), alpr: msg('Plate readers'), traffic: msg('Road traffic'), live_news: msg('Live news'), earthquakes: msg('Earthquakes'), fires: msg('Fires'), weather: msg('Weather warnings'),
  radiation: msg('Radiation'), infrastructure: msg('Infrastructure'), global_incidents: msg('Disaster alerts'), alert_pins: msg('News pins'), war_alerts: msg('Air-raid alerts'),
  airport_delays: msg('Airport delays'), chokepoint_flow: msg('Chokepoint traffic'), outbreaks: msg('Outbreaks'), day_night: msg('Day and night'), cables: msg('Undersea cables'),
  live_clouds: msg('Clouds'), wx_temperature: msg('Temperature'), wx_wind: msg('Wind'), wx_radar: msg('Rain radar'), wx_lightning: msg('Lightning'), hiking_routes: msg('Hiking routes'), things_to_do: msg('Things to do'), transit: msg('Buses and trains'), terrain_3d: msg('3D terrain'),
  cyber_attacks: msg('Cyber attacks'), gdelt_events: msg('GDELT events'), cf_outages: msg('Internet outages'), malware: msg('Malware servers'), balloons: msg('Balloons'),
  launches: msg('Rocket launches'), aurora: msg('Aurora'), service_status: msg('Service status'), gps_jamming: msg('GPS interference'),
  airport_weather: msg('Airport weather'), sigmets: msg('Hazard airspace'),
};

const PANEL_NAME: Record<string, string> = {
  markets: msg('Markets'), alerts: msg('Alerts'), intel: msg('Recon'), layers: msg('Layers'), directions: msg('Route'), forecast: msg('Forecast'), workspace: msg('the workspace'),
};

/** The workspace's centre views, as the reader knows them. */
const VIEW_NAME: Record<string, string> = { globe: msg('globe'), graph: msg('graph'), timeline: msg('timeline'), table: msg('table') };

/** The pieces of a map_view result ("globe, satellite basemap"). */
const MAP_VIEW_WORD: Record<string, string> = {
  globe: msg('globe'), 'flat map': msg('flat map'), 'dark basemap': msg('dark basemap'), 'satellite basemap': msg('satellite basemap'),
};

export const layerName = (k: string, t: Translate) => (LAYER_NAME[k] ? t(LAYER_NAME[k]) : cap(k.replace(/_/g, ' ')));
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
export function actionLine(a: ActionView, carded: boolean, t: Translate): string {
  const done = a.status === 'ok';
  const names = (keys: string[]) => keys.map(k => layerName(k, t)).join(', ');
  if (a.status === 'error') return cap(a.summary || t('That did not work'));
  switch (a.tool) {
    case 'go_to': {
      const at = flewTo(a);
      if (at) return t('Flew to {place}', { place: at.name });
      const where = arg(a, 'place') || [arg(a, 'lat'), arg(a, 'lng')].filter(Boolean).join(', ');
      return where ? t('Flying to {place}', { place: where }) : t('Flying to a place');
    }
    case 'layers': {
      const { on, off } = layerChange(a);
      return [
        on.length ? (done ? t('Switched on {layers}', { layers: names(on) }) : t('Switching on {layers}', { layers: names(on) })) : '',
        off.length ? (done ? t('Switched off {layers}', { layers: names(off) }) : t('Switching off {layers}', { layers: names(off) })) : '',
      ].filter(Boolean).join(' · ') || t('Layers');
    }
    case 'open': {
      const panel = PANEL_NAME[arg(a, 'panel')] ? t(PANEL_NAME[arg(a, 'panel')]) : arg(a, 'panel');
      if (a.args.close === true) return done ? t('Closed {panel}', { panel }) : t('Closing {panel}', { panel });
      return done ? t('Opened {panel}', { panel }) : t('Opening {panel}', { panel });
    }
    case 'move': return done && a.summary ? a.summary.replace(/^Camera: /, 'Camera ') : t('Moving the camera');
    case 'untrack': return done ? t('Stopped following') : t('Stopping the follow');
    case 'track': if (done && a.summary) return a.summary.replace(/ \((aircraft|ship|satellite) [^)]*\).*$/, ''); break;
    case 'link': return done ? t('Made a link to this view') : t('Making a link');
    case 'timeline': {
      if (done && a.summary) return a.summary;
      if (arg(a, 'mode') === 'live') return t('Going back to live');
      const time = arg(a, 'at');
      if (arg(a, 'mode') === 'history') return time ? t('Opening History at {time}', { time }) : t('Opening History');
      return time ? t('Opening Replay at {time}', { time }) : t('Opening Replay');
    }
    case 'map_view': {
      if (!done || !a.summary) return t('Changing the map');
      const view = a.summary.split(', ').map(w => (MAP_VIEW_WORD[w] ? t(MAP_VIEW_WORD[w]) : w)).join(', ');
      return t('Switched to the {view}', { view });
    }
    case 'forecast': {
      const question = arg(a, 'question');
      if (!done) return t('Starting a forecast: {question}', { question });
      return carded ? t('Started a forecast') : t('Started a forecast: {question}', { question });
    }
    case 'workspace': {
      if (a.args.open === false) return t('Closed the workspace');
      const view = arg(a, 'view') ? (VIEW_NAME[arg(a, 'view')] ? t(VIEW_NAME[arg(a, 'view')]) : arg(a, 'view')) : '';
      if (done) return view ? t('Opened the workspace on the {view}', { view }) : t('Opened the workspace');
      return view ? t('Opening the workspace on the {view}', { view }) : t('Opening the workspace');
    }
    case 'clear': return done ? t('Cleared the marks') : t('Clearing the marks');
  }
  let what = list(a.args.layers).length ? names(list(a.args.layers)) : arg(a, 'layer') ? layerName(arg(a, 'layer'), t) : t('the map');
  if (arg(a, 'text')) what = t('{what} “{text}”', { what, text: arg(a, 'text') });
  if (arg(a, 'near')) what = t('{what} near {place}', { what, place: arg(a, 'near') });
  if (arg(a, 'region')) what = t('{what} in {region}', { what, region: arg(a, 'region') });
  const plane = arg(a, 'callsign') || arg(a, 'registration') || arg(a, 'id') || t('an aircraft');
  const place = arg(a, 'place') || arg(a, 'near') || t('a place');
  const camera = arg(a, 'near') ? t('a camera near {place}', { place: arg(a, 'near') }) : t('a camera');
  const span = arg(a, 'from') ? `${arg(a, 'from')}${arg(a, 'to') ? `–${arg(a, 'to')}` : ''}` : '';
  const recordOf = arg(a, 'place') ? t('the record for {place}', { place: arg(a, 'place') }) : t('the record');
  const record = span ? `${recordOf}, ${span}` : recordOf;
  const from = arg(a, 'from') || t('here');
  const to = arg(a, 'to') || t('there');
  const kind = arg(a, 'kind').replace(/_/g, ' ');
  const title = arg(a, 'title');
  const symbols = list(a.args.symbols).join(', ');
  if (done && carded) {
    switch (a.tool) {
      case 'find': return t('Searched {what}', { what });
      case 'scan': return t('Read what is in view');
      case 'camera': return t('Looked through {camera}', { camera });
      case 'show': return title ? t('Listed {title}', { title }) : t('Listed results');
      case 'markets': return symbols ? t('Read {symbols}', { symbols }) : t('Read the markets');
      case 'aircraft': return t('Looked up {plane}', { plane });
      case 'weather': return t('Read the weather at {place}', { place });
      case 'pass': return a.args.overhead === true ? t('Read the sky over {place}', { place }) : t('Worked out passes over {place}', { place });
      case 'brief': return t('Briefed {place}', { place });
      case 'route': return t('Routed {from} to {to}', { from, to });
      case 'nearby': return t('Looked up {kind} near {place}', { kind, place });
      case 'chronicle': return t('Read {record}', { record });
      case 'past_event': return t('Looked up the event');
    }
  }
  if (done && a.summary) return cap(a.summary);
  switch (a.tool) {
    case 'find': return t('Finding {what}', { what });
    case 'scan': return t('Reading what is in view');
    case 'camera': return t('Looking through {camera}', { camera });
    case 'highlight': {
      const n = Array.isArray(a.args.points) ? a.args.points.length : 0;
      return t('{n, plural, one {Marking # place} other {Marking # places}}', { n });
    }
    case 'show': return title ? t('Listing {title}', { title }) : t('Listing results');
    case 'markets': return symbols ? t('Reading {symbols}', { symbols }) : t('Reading the markets');
    case 'select': return t('Opening {name}', { name: arg(a, 'name') });
    case 'track': {
      const target = arg(a, 'text') || arg(a, 'id');
      if (target) return t('Finding {target} to follow', { target });
      return arg(a, 'nearest_to') ? t('Finding the nearest aircraft to {place} to follow', { place: arg(a, 'nearest_to') }) : t('Finding it to follow');
    }
    case 'aircraft': return t('Looking up {plane}', { plane });
    case 'weather': return t('Reading the weather at {place}', { place });
    case 'pass': return a.args.overhead === true ? t('Reading the sky over {place}', { place }) : t('Working out passes over {place}', { place });
    case 'brief': return t('Briefing {place}', { place });
    case 'route': return t('Routing {from} to {to}', { from, to });
    case 'nearby': return t('Looking up {kind} near {place}', { kind, place });
    case 'chronicle': return t('Reading {record}', { record });
    case 'past_event': return t('Looking up event {id}', { id: arg(a, 'id') });
    default: return cap(a.summary || '');
  }
}
