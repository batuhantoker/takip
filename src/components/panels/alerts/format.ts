import type { DotTone } from '@/components/ui/tag';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { AlertItem, QuakeAlert, WarningAlert } from '@/lib/intel/alerts/live-alerts';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** How long ago, in its largest whole unit: minutes within the hour, hours within the day, then days. */
export function elapsed(ts: number | string | null | undefined, now: number): { unit: 'now' | 'min' | 'h' | 'day'; n: number } | null {
  const ms = typeof ts === 'string' ? Date.parse(ts) : ts;
  if (ms == null || !Number.isFinite(ms)) return null;
  const mins = Math.max(0, Math.floor((now - ms) / MIN));
  if (mins < 1) return { unit: 'now', n: 0 };
  if (mins < 60) return { unit: 'min', n: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { unit: 'h', n: hours };
  return { unit: 'day', n: Math.floor(hours / 24) };
}

/** "just now", "4 min ago", "3 h ago", "2 days ago". */
export function ago(ts: number | string | null | undefined, now: number, t: Translate): string {
  const e = elapsed(ts, now);
  if (!e) return '';
  if (e.unit === 'now') return t('just now');
  if (e.unit === 'min') return t('{n} min ago', { n: e.n });
  if (e.unit === 'h') return t('{n} h ago', { n: e.n });
  return t('{n, plural, one {# day ago} other {# days ago}}', { n: e.n });
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The time column: minutes within the hour, the clock time within two days, then the date. */
export function stamp(ts: number, now: number, t: Translate): string {
  const mins = Math.floor((now - ts) / MIN);
  if (mins < 1) return t('now');
  if (mins < 60) return t('{n} min', { n: mins });
  const d = new Date(ts);
  const yesterday = new Date(now - 24 * HOUR);
  if (sameDay(d, new Date(now)) || sameDay(d, yesterday)) return clock(d, t);
  // A notice still in force from last December should not read as this December.
  if (d.getFullYear() !== new Date(now).getFullYear()) return d.toLocaleDateString(t.intl, { month: 'short', year: 'numeric' });
  return d.toLocaleDateString(t.intl, { day: 'numeric', month: 'short' });
}

const clock = (d: Date, t: Translate) => d.toLocaleTimeString(t.intl, { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Oct 13, 01:10" in a 24-hour clock like the time column; the year only when it is not this one. */
export function fullDate(ts: number, t: Translate): string {
  const d = new Date(ts);
  const year = d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric';
  return `${d.toLocaleDateString(t.intl, { day: 'numeric', month: 'short', year })}, ${clock(d, t)}`;
}

/** "until 15:00", "until 15:00 tomorrow", "until 16 Oct, 15:00": the year only when it is not this one. */
export function until(ts: number, now: number, t: Translate): string {
  const d = new Date(ts);
  const time = clock(d, t);
  if (sameDay(d, new Date(now))) return t('until {time}', { time });
  if (sameDay(d, new Date(now + 24 * HOUR))) return t('until {time} tomorrow', { time });
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const date = d.toLocaleDateString(t.intl, { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
  return t('until {date}, {time}', { date, time });
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
  if (now - ts < HOUR) return msg('Last hour');
  const d = new Date(ts);
  if (sameDay(d, new Date(now))) return msg('Earlier today');
  if (sameDay(d, new Date(now - 24 * HOUR))) return msg('Yesterday');
  return msg('Older');
}

/** "ends in 16 h", "ends in 20 min", "ended". */
export function endsIn(expires: number, now: number, t: Translate): string {
  const left = expires - now;
  if (left <= 0) return t('ended');
  if (left < HOUR) return t('ends in {n} min', { n: Math.max(1, Math.round(left / MIN)) });
  const hours = Math.round(left / HOUR);
  if (hours < 48) return t('ends in {n} h', { n: hours });
  return t('{n, plural, one {ends in # day} other {ends in # days}}', { n: Math.round(hours / 24) });
}

export const SEVERITY_LABEL: Record<WarningAlert['severity'], string> = { high: msg('Severe'), medium: msg('Moderate'), low: msg('Advisory') };
export const SEVERITY_GROUP: Record<WarningAlert['severity'], string> = { high: msg('Severe'), medium: msg('Moderate'), low: msg('Advisories') };

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
  if (item.kind === 'quake') return item.magnitude >= 5 ? msg('Strong earthquake') : undefined;
  return item.alertKind === 'rocket' ? msg('Rocket or missile report') : item.alertKind === 'event' ? msg('Incident report') : undefined;
};

export const magnitude = (q: Pick<QuakeAlert, 'magnitude'>) => `M${q.magnitude.toFixed(1)}`;

export const compact = (n: number, t: Translate) => new Intl.NumberFormat(t.intl, { notation: 'compact' }).format(n);
