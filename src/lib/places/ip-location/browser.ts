/** The browser's IANA zone, when it names a place rather than UTC or an Etc/ offset. */
export function browserTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.includes('/') && !tz.startsWith('Etc/') ? tz : null;
  } catch {
    return null;
  }
}

/** /api/geo with the browser's zone, so the server can drop answers that put the visitor in another one. */
export function ipLocationUrl(): string {
  const tz = browserTimeZone();
  return tz ? `/api/geo?tz=${encodeURIComponent(tz)}` : '/api/geo';
}
