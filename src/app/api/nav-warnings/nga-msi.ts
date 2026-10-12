/**
 * TAKIP — NGA Maritime Safety Information broadcast navigational warnings, no key. US public domain.
 * One record per in-force NAVAREA IV/XII, HYDROLANT, HYDROPAC or HYDROARC warning. Positions exist only
 * in the free text, as degrees-minutes (`34-12.5N 025-30.0E`, `45-05N 033-33E`) or with seconds (`20-03-44N`).
 * The API serves only the in-force set (`status` is ignored), and as of 2026-10 nothing issued after
 * 2024-05-10 (its own `latest-warning` endpoint agrees): in force means never cancelled, not recent.
 * A survey vessel "TOWING ... LONG CABLES" is towing seismic streamers, not working on a submarine cable.
 */

export const NGA_BROADCAST_WARN_URL = 'https://msi.nga.mil/api/publications/broadcast-warn?output=json&status=A';
export const NGA_NAV_WARNINGS_PAGE = 'https://msi.nga.mil/NavWarnings';

export const MAX_POINTS = 50;
const MAX_TEXT = 2000;

export interface NgaWarning {
  msgYear: number;
  msgNumber: number;
  navArea: string;
  subregion?: string | null;
  text: string;
  issueDate?: string | null;
  authority?: string | null;
  cancelDate?: string | null;
}

export type NavWarningKind = 'distress' | 'cable' | 'firing' | 'hazard' | 'navaid' | 'other';

export interface NavWarning {
  id: string;
  /** NGA's own reference, e.g. `HYDROLANT 950/24`. */
  ref: string;
  title: string;
  kind: NavWarningKind;
  cable?: 'fault' | 'operations';
  vessel?: string;
  lat: number;
  lng: number;
  points: [number, number][];
  area: string;
  issued?: string;
  text: string;
  source: string;
}

const NAV_AREAS: Record<string, string> = {
  '4': 'NAVAREA IV',
  '12': 'NAVAREA XII',
  A: 'HYDROLANT',
  P: 'HYDROPAC',
  C: 'HYDROARC',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** `DDHHMMZ MON YYYY` → ISO 8601, or null. */
export function parseNgaDate(s: string | null | undefined): string | null {
  const m = /^(\d{2})(\d{2})(\d{2})Z ([A-Z]{3}) (\d{4})$/.exec((s ?? '').trim().toUpperCase());
  if (!m) return null;
  const day = +m[1];
  const hour = +m[2];
  const minute = +m[3];
  const month = MONTHS.indexOf(m[4]);
  if (month < 0 || hour > 23 || minute > 59) return null;
  const d = new Date(Date.UTC(+m[5], month, day, hour, minute));
  return d.getUTCDate() === day ? d.toISOString() : null;
}

// A dot in place of the first dash (`143.46.0E`) is a typo NGA has published.
const DMS = '(\\d{1,3})(?:-|\\.(?=\\d{2}\\.\\d))(\\d{2}(?:\\.\\d+)?)(?:-(\\d{2}(?:\\.\\d+)?))?';
// No trailing \b: `057-43.1E0` is another published typo.
const PAIR = new RegExp(`\\b${DMS}([NS])\\s*,?\\s*${DMS}([EW])(?![A-Z])`, 'g');

const round = (v: number) => Math.round(v * 1e5) / 1e5;

function toDegrees(deg: string, min: string, sec: string | undefined, hemi: string, max: number): number | null {
  const m = +min;
  const s = sec ? +sec : 0;
  if (m >= 60 || s >= 60) return null;
  const v = +deg + m / 60 + s / 3600;
  if (v > max) return null;
  return round(hemi === 'S' || hemi === 'W' ? -v : v);
}

/** Every lat/lng pair in the text, in order, as decimal degrees. Pairs with impossible values are skipped. */
export function extractCoordinates(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of text.toUpperCase().matchAll(PAIR)) {
    const lat = toDegrees(m[1], m[2], m[3], m[4], 90);
    const lng = toDegrees(m[5], m[6], m[7], m[8], 180);
    if (lat != null && lng != null) out.push([lat, lng]);
  }
  return out;
}

function unique(points: [number, number][]): [number, number][] {
  const seen = new Set<string>();
  return points.filter(p => {
    const key = p.join();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Vertex average. A set straddling 180° is averaged on 0–360, or it would centre on the far side of the globe. */
export function centreOf(points: [number, number][]): [number, number] {
  const lngs = points.map(p => p[1]);
  const wraps = Math.max(...lngs) - Math.min(...lngs) > 180;
  let lng = mean(lngs.map(l => (wraps && l < 0 ? l + 360 : l)));
  if (lng > 180) lng -= 360;
  return [round(mean(points.map(p => p[0]))), round(lng)];
}

const DISTRESS = /\b(?:DISTRESS (?:SIGNALS?|CALLS?|ALERTS?|BEACONS?|RELAY)|IN DISTRESS|MAN OVERBOARD|PERSONS? OVERBOARD|OVERDUE|UNREPORTED|ASSIST IF POSSIBLE|REQUESTING ASSISTANCE|MEDICAL ASSISTANCE|SEARCH AND RESCUE|FLARES? SIGHTED|TAKING ON WATER)\b/;
// Never bare CABLES: see the seismic streamers note above.
const CABLE = /\b(?:CABLE ?SHIPS?|(?:SUBMARINE|UNDERWATER|SUBSEA|FIBER OPTIC|FIBRE OPTIC) CABLES?|CABLES? (?:OPERATIONS?|LAYING|LAY|REPAIRS?|WORKS?|FAULTS?|BREAKS?|DAMAGED?|BURIAL|RECOVERY|INSTALLATION))\b/;
const CABLE_FAULT = /\b(?:FAULTS?|FAULTY|BREAKS?|BROKEN|DAMAGED?|SEVERED)\b/;
// "EXERCISE EXTREME CAUTION" is advice, not an exercise.
const FIRING = /\b(?:FIRING|GUNNERY|MISSILES?|ROCKETS?|LIVE FIRE|LIVE AMMUNITION|HAZARDOUS OPERATIONS|SPACE DEBRIS|EXERCISES?(?! (?:EXTREME |GREAT |EXTRA )?CAUTION))\b/;
const HAZARD = /\b(?:DERELICT|WRECKS?|WRECKAGE|ADRIFT|DRIFTING|OBSTRUCTIONS?|MINES?|MINING|MINEFIELD|UNEXPLODED|ORDNANCE|SUBMERGED|SANK|SUNK|AGROUND|SHOALS?|UNCHARTED REEFS?|REEFS? REPORTED|DEPTHS? (?:LESS THAN CHARTED|REPORTED)|FISHING GEAR|CONTAINERS?|ICEBERGS?|VOLCANIC|DISCOLORED WATER|EARTHQUAKE|TSUNAMI|OIL SPILL|GAS LEAK)\b/;
const NAVAID = /\b(?:LIGHTS?|LIGHTHOUSE|BUOYS?|BEACONS?|RACONS?|DAYMARKS?|NAVAIDS?|NAVIGATIONAL AIDS?|AIS|GPS|GNSS|DGPS|NAVTEX|DSC|MF|HF|VHF|RADIO|COMMUNICATION FACILIT(?:Y|IES))\b/;
const NAVAID_STATUS = /\b(?:UNLIT|UNRELIABLE|INOPERATIVE|DISCONTINUED|OFF AIR|OFF STATION|MISSING|REMOVED|DESTROYED|DAMAGED|ESTABLISHED|RELOCATED|CHANGED|RANGE REDUCED|REDUCED POWER|EXTINGUISHED|OUT OF SERVICE|UNABLE)\b/;

export function classifyWarning(text: string): { kind: NavWarningKind; cable?: 'fault' | 'operations' } {
  const t = text.toUpperCase().replace(/\s+/g, ' ');
  // Distress first: "MAN OVERBOARD FROM CABLESHIP ..." is a rescue, not cable work.
  if (DISTRESS.test(t)) return { kind: 'distress' };
  if (CABLE.test(t)) return { kind: 'cable', cable: CABLE_FAULT.test(t) ? 'fault' : 'operations' };
  if (FIRING.test(t)) return { kind: 'firing' };
  if (HAZARD.test(t)) return { kind: 'hazard' };
  if (NAVAID.test(t) && NAVAID_STATUS.test(t)) return { kind: 'navaid' };
  return { kind: 'other' };
}

const VESSEL = /\bBY (?:CABLE ?SHIP|M\/V|C\/S|R\/V) ([A-Z0-9][A-Z0-9 '-]*?)(?= (?:ALONG|IN|AT|ON|AND|UNTIL|TOWING|WITH|FROM|DURING)\b|[.,:;(]|$)/;

export function vesselOf(text: string): string | undefined {
  return VESSEL.exec(text.toUpperCase().replace(/\s+/g, ' '))?.[1];
}

/** The leading place lines ("GULF OF GUINEA.", "NIGERIA."), as sea and country. */
export function regionOf(text: string): string | undefined {
  const parts: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.length > 48 || !/^[A-Z][A-Z .,'()&/-]*\.$/.test(line)) break;
    parts.push(line.slice(0, -1));
  }
  if (!parts.length) return undefined;
  return (parts.length > 2 ? [parts[0], parts[parts.length - 1]] : parts).join(', ');
}

const LABELS: Record<NavWarningKind, string> = {
  distress: 'Distress / SAR',
  cable: 'Cable operations',
  firing: 'Firing / hazardous operations',
  hazard: 'Navigational hazard',
  navaid: 'Navaid / radio service',
  other: 'Navigational warning',
};

export function toNavWarning(w: NgaWarning): NavWarning | null {
  const all = unique(extractCoordinates(w.text));
  if (!all.length) return null;
  const [lat, lng] = centreOf(all);
  const { kind, cable } = classifyWarning(w.text);
  const areaName = NAV_AREAS[w.navArea] ?? `Area ${w.navArea}`;
  const ref = `${areaName} ${w.msgNumber}/${String(w.msgYear).slice(-2)}`;
  const label = cable === 'fault' ? 'Cable fault' : LABELS[kind];
  const sub = (w.subregion ?? '').trim();
  const text = w.text.trim();

  const event: NavWarning = {
    id: `nga-${w.navArea}-${w.msgYear}-${w.msgNumber}`,
    ref,
    title: `${label} — ${regionOf(w.text) ?? ref}`,
    kind,
    lat,
    lng,
    points: all.slice(0, MAX_POINTS),
    area: !sub ? areaName : sub === 'GEN' ? `${areaName}, general` : `${areaName}, subregion ${sub}`,
    text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text,
    source: NGA_NAV_WARNINGS_PAGE,
  };
  if (cable) event.cable = cable;
  const vessel = kind === 'cable' ? vesselOf(w.text) : undefined;
  if (vessel) event.vessel = vessel;
  const issued = parseNgaDate(w.issueDate);
  if (issued) event.issued = issued;
  return event;
}

export function toNavWarnings(records: NgaWarning[]): { warnings: NavWarning[]; unplaced: number } {
  const warnings: NavWarning[] = [];
  let unplaced = 0;
  for (const r of records) {
    const e = toNavWarning(r);
    if (e) warnings.push(e);
    else unplaced++;
  }
  return { warnings, unplaced };
}

function isWarning(r: unknown): r is NgaWarning {
  const w = r as Partial<NgaWarning> | null;
  return !!w && typeof w.text === 'string' && typeof w.navArea === 'string'
    && Number.isFinite(w.msgNumber) && Number.isFinite(w.msgYear);
}

export function parseBroadcastWarn(json: unknown): NgaWarning[] {
  const list = (json as Record<string, unknown> | null)?.['broadcast-warn'];
  if (!Array.isArray(list)) throw new Error('NGA MSI: unexpected broadcast-warn shape');
  return list.filter(isWarning);
}
