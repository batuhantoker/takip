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

export interface VisitorPoint { lat: number; lng: number }

/** /api/geo's answer, when it is a real place. */
export function ipPoint(geo: { status?: string; lat?: number; lon?: number } | null): VisitorPoint | null {
  const { lat, lon } = geo ?? {};
  if (geo?.status !== 'success' || typeof lat !== 'number' || typeof lon !== 'number' ||
      !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lng: lon };
}

/** The device's own position, only when this site already holds the permission: loading never prompts. */
async function grantedDeviceFix(): Promise<VisitorPoint | null> {
  try {
    if ((await navigator.permissions.query({ name: 'geolocation' })).state !== 'granted') return null;
  } catch {
    return null;
  }
  return new Promise(resolve => navigator.geolocation.getCurrentPosition(
    fix => resolve({ lat: fix.coords.latitude, lng: fix.coords.longitude }),
    () => resolve(null),
    { timeout: 4000, maximumAge: 10 * 60_000 },
  ));
}

/** Where the visitor is: the device when already permitted, else by IP (asked for at once); null when neither knows. */
export async function locateVisitor(signal?: AbortSignal): Promise<VisitorPoint | null> {
  const byIp = fetch(ipLocationUrl(), { signal }).then(r => r.json()).then(ipPoint).catch(() => null);
  return (await grantedDeviceFix().catch(() => null)) ?? byIp;
}
