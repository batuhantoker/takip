/** "12 Oct, 08:46" in UTC, for a list that says UTC once. */
export const utcTime = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** "12 Oct, 08:46 UTC" */
export const utcStamp = (ms: number) => `${utcTime(ms)} UTC`;

/** "12 Oct" */
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "today", "yesterday", "12 days ago", counted in whole UTC days. */
export function daysAgo(ms: number, now = Date.now()): string {
  const days = Math.floor(now / 86_400_000) - Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** "in 40 min", "in 5 h", "in 2 d 4 h" */
export function countdown(ms: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((ms - now) / 60_000));
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `in ${h} h`;
  return `in ${Math.floor(h / 24)} d ${h % 24} h`;
}

const KIND = { optical: 'Colour', radar: 'Radar' } as const;

/** "Colour · 10 m" */
export const kindLabel = (imager: { kind: keyof typeof KIND; resolution: string }) => `${KIND[imager.kind]} · ${imager.resolution}`;
