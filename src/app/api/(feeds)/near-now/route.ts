import { NextResponse, type NextRequest } from 'next/server';
import { loadCatalog } from '@/lib/core/i18n/catalog';
import { isLocale, type Locale } from '@/lib/core/i18n/locales';
import { createTranslator } from '@/lib/core/i18n/translator';
import { areaItems, MAX_ITEMS, nearItems, type Alert, type Box, type FireIncident, type Hotspot, type Quake } from '@/lib/feeds/hazards/near-now';
import { lightningNear } from '@/lib/feeds/weather/near/lightning-near';
import { rainNear } from '@/lib/feeds/weather/near/rain-near';
import { ownApi } from '@/lib/platform/site/live/own-api';
import { placeLabel } from '@/lib/platform/site/places/gazetteer';
import { placePath } from '@/lib/platform/site/places/paths';
import { weatherCityNear } from '@/lib/platform/site/places/topics/weather';

/**
 * TAKIP — what is happening near a point right now, `?lat=&lon=` (`&lang=`, `&unit=mi`, `&limit=`): warnings, the strongest
 * quake of the last day, fires, lightning and rain, ranked and worded for the phone apps' widget, which CarPlay also
 * shows (lib/feeds/hazards/near-now.ts). `?bbox=w,s,e,n` instead counts what is inside a country's box. Each feed that
 * can't be read is simply left out.
 */

export const dynamic = 'force-dynamic';

const covered = <T extends { covered: boolean }>(now: T | null) => (now && now.covered ? (now as Extract<T, { covered: true }>) : null);

/** w,s,e,n in degrees; west may exceed east across the antimeridian. */
function parseBox(raw: string | null): Box | null {
  const v = raw?.split(',').map(Number) ?? [];
  if (v.length !== 4 || !v.every(Number.isFinite)) return null;
  const [w, s, e, n] = v;
  return Math.abs(w) <= 180 && Math.abs(e) <= 180 && s >= -90 && n <= 90 && s < n ? [w, s, e, n] : null;
}

const feeds = () => Promise.all([
  ownApi<{ earthquakes: Quake[] }>('/api/earthquakes', 120),
  ownApi<{ fires: Hotspot[]; fire_incidents: FireIncident[] }>('/api/fires', 600),
  ownApi<{ events: Alert[] }>('/api/weather', 300),
]);

const CACHE = { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' };

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lang = q.get('lang');
  const locale: Locale = isLocale(lang) ? lang : 'en';
  const limit = Math.min(8, Math.max(1, Number(q.get('limit')) || MAX_ITEMS));
  if (q.has('bbox')) {
    const box = parseBox(q.get('bbox'));
    if (!box) return NextResponse.json({ error: 'bbox must be w,s,e,n' }, { status: 400 });
    const [[quakes, fires, weather], catalog] = await Promise.all([feeds(), loadCatalog(locale)]);
    const t = createTranslator(locale, catalog);
    const items = areaItems({
      box, now: Date.now(),
      quakes: quakes?.earthquakes ?? [], incidents: fires?.fire_incidents ?? [], hotspots: fires?.fires ?? [], alerts: weather?.events ?? [],
    }, t, limit);
    return NextResponse.json({ title: t('Right now'), place: null, items, empty: t('Nothing in force or recent right now'), at: Date.now() }, { headers: CACHE });
  }
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  if (!q.has('lat') || !q.has('lon') || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }
  // About a kilometre: close enough for a few lines, coarse enough that nearby phones share a cache entry.
  const at: [number, number] = [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100];
  const [[quakes, fires, weather], lightning, rain, catalog] = await Promise.all([
    feeds(),
    lightningNear(at).catch(() => null),
    rainNear(at).catch(() => null),
    loadCatalog(locale),
  ]);
  const t = createTranslator(locale, catalog, q.get('unit') === 'mi' ? 'mi' : 'km');
  const items = nearItems({
    at, now: Date.now(),
    quakes: quakes?.earthquakes ?? [],
    incidents: fires?.fire_incidents ?? [],
    hotspots: fires?.fires ?? [],
    alerts: weather?.events ?? [],
    lightning: covered(lightning),
    rain: covered(rain),
  }, t, limit);
  const city = weatherCityNear(at);
  return NextResponse.json({
    title: t('Near you'),
    place: city && { name: placeLabel(city, locale), path: placePath(city, 'weather') },
    items,
    empty: t('Nothing near you right now'),
    at: Date.now(),
  }, { headers: CACHE });
}
