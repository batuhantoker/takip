import type { DotTone } from '@/components/ui/tag';
import type { AlertItem, QuakeAlert, WarningAlert } from '@/lib/intel/alerts/live-alerts';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** "just now", "4 min ago", "3 h ago", "2 days ago". */
export function ago(ts: number | string | null | undefined, now: number): string {
  const ms = typeof ts === 'string' ? Date.parse(ts) : ts;
  if (ms == null || !Number.isFinite(ms)) return '';
  const mins = Math.max(0, Math.floor((now - ms) / MIN));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The time column: minutes within the hour, the clock time within two days, then the date. */
export function stamp(ts: number, now: number): string {
  const mins = Math.floor((now - ts) / MIN);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins} min`;
  const d = new Date(ts);
  const yesterday = new Date(now - 24 * HOUR);
  if (sameDay(d, new Date(now)) || sameDay(d, yesterday)) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  // A notice still in force from last December should not read as this December.
  if (d.getFullYear() !== new Date(now).getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Oct 13, 01:10" in a 24-hour clock like the time column; the year only when it is not this one. */
export function fullDate(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric';
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year })}, ${clock(d)}`;
}

/** "until 15:00", "until 15:00 tomorrow", "until 16 Oct, 15:00": the year only when it is not this one. */
export function until(ts: number, now: number): string {
  const d = new Date(ts);
  if (sameDay(d, new Date(now))) return `until ${clock(d)}`;
  if (sameDay(d, new Date(now + 24 * HOUR))) return `until ${clock(d)} tomorrow`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return `until ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' })}, ${clock(d)}`;
}

const SHORT_NAMES: Record<string, string> = { uae: 'UAE', us: 'US', usa: 'US', uk: 'UK', drc: 'DRC', eu: 'EU' };

/** Country keys arrive lowercase ("yemen", "united states"); a place name should not. */
export const placeName = (s: string) =>
  SHORT_NAMES[s.toLowerCase()] ?? (s === s.toLowerCase() ? s.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase()) : s);

/** "9.04° N, 82.23° W", as the status bar writes positions. */
export const position = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`;

/** When a list of things that happened splits into "Last hour", "Earlier today" and so on. */
export function bucketOf(ts: number, now: number): string {
  if (now - ts < HOUR) return 'Last hour';
  const d = new Date(ts);
  if (sameDay(d, new Date(now))) return 'Earlier today';
  if (sameDay(d, new Date(now - 24 * HOUR))) return 'Yesterday';
  return 'Older';
}

/** "ends in 16 h", "ends in 20 min", "ended". */
export function endsIn(expires: number, now: number): string {
  const left = expires - now;
  if (left <= 0) return 'ended';
  if (left < HOUR) return `ends in ${Math.max(1, Math.round(left / MIN))} min`;
  const hours = Math.round(left / HOUR);
  if (hours < 48) return `ends in ${hours} h`;
  return `ends in ${Math.round(hours / 24)} days`;
}

export const SEVERITY_LABEL: Record<WarningAlert['severity'], string> = { high: 'Severe', medium: 'Moderate', low: 'Advisory' };
export const SEVERITY_GROUP: Record<WarningAlert['severity'], string> = { high: 'Severe', medium: 'Moderate', low: 'Advisories' };

export function quakeTone(m: number): DotTone {
  return m >= 6 ? 'red' : m >= 5 ? 'amber' : 'muted';
}

/** Colour only where it says how grave something is; everything else stays muted. */
export function toneOf(item: AlertItem): DotTone {
  if (item.kind === 'warning') return item.severity === 'high' ? 'red' : item.severity === 'medium' ? 'amber' : 'blue';
  if (item.kind === 'quake') return quakeTone(item.magnitude);
  if (item.alertKind === 'rocket') return 'red';
  if (item.alertKind === 'event') return 'amber';
  return 'muted';
}

export const toneLabel = (item: AlertItem): string | undefined => {
  if (item.kind === 'warning') return SEVERITY_LABEL[item.severity];
  if (item.kind === 'quake') return item.magnitude >= 5 ? 'Strong earthquake' : undefined;
  return item.alertKind === 'rocket' ? 'Rocket or missile report' : item.alertKind === 'event' ? 'Incident report' : undefined;
};

export const magnitude = (q: Pick<QuakeAlert, 'magnitude'>) => `M${q.magnitude.toFixed(1)}`;

export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`;
