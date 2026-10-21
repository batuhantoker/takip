import { NextResponse, type NextRequest } from 'next/server';
import { loadCatalog } from '@/lib/core/i18n/catalog';
import { isLocale, type Locale } from '@/lib/core/i18n/locales';
import { createTranslator } from '@/lib/core/i18n/translator';
import { forecastPoint, type Forecast } from '@/lib/feeds/weather/forecast';
import { lightningNear } from '@/lib/feeds/weather/near/lightning-near';
import { rainNear } from '@/lib/feeds/weather/near/rain-near';
import { ownApi } from '@/lib/platform/site/live/own-api';
import { placeLabel } from '@/lib/platform/site/places/gazetteer';
import { metarNow } from '@/lib/platform/site/places/live/metar-now';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import { topicTable } from '@/lib/platform/site/places/tables';
import { WEATHER, weatherCityNear } from '@/lib/platform/site/places/topics/weather';
import { summarise } from '@/lib/platform/site/places/topics/weather-forecast';
import type { IssRow } from '@/lib/platform/site/places/topics/sky-data';

/**
 * TAKIP — lightning and rain near a point right now, `?lat=&lon=` (and `&lang=` for the words): the nearest strike or
 * flash in the last 15 minutes from NOAA and EUMETSAT, the nearest rain on RainViewer's newest radar frame, and the
 * city whose weather page covers the point. `&detail=1` adds that city's latest airport report and MET Norway's
 * forecast for the point, in `&tz=` (else the city's zone). Each part is null when its upstream can't be read.
 */

export const dynamic = 'force-dynamic';

const validZone = (tz: string | null) => {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
};

async function details(at: [number, number], city: Place | null, locale: Locale, tz: string) {
  const stations = city ? WEATHER.pages(city)[0]?.data.stations ?? [] : [];
  const p = forecastPoint(at[1], at[0]);
  const [reports, forecast] = await Promise.all([
    city && stations.length
      ? loadCatalog(locale).then(c => metarNow(stations.slice(0, 3), city.cc, createTranslator(locale, c), 'everyday'))
      : Promise.resolve([]),
    ownApi<Forecast>(`/api/forecast?lat=${p.lat}&lon=${p.lon}`, 900),
  ]);
  return { station: reports[0] ?? null, forecast: forecast?.steps?.length ? summarise(forecast, tz, Date.now()) : null };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  if (!q.has('lat') || !q.has('lon') || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }
  const at: [number, number] = [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100];
  const lang = q.get('lang');
  const locale: Locale = isLocale(lang) ? lang : 'en';
  const city = weatherCityNear(at);
  const tz = validZone(q.get('tz')) ?? (city && topicTable<IssRow>('iss').rows[city.id]?.tz) ?? 'UTC';
  const [lightning, rain, more] = await Promise.all([
    lightningNear(at).catch(() => null),
    rainNear(at).catch(() => null),
    q.get('detail') === '1' ? details(at, city, locale, tz).catch(() => ({ station: null, forecast: null })) : null,
  ]);
  const place = city && { name: placeLabel(city, locale), path: placePath(city, 'weather'), cc: city.cc };
  return NextResponse.json({ lightning, rain, place, ...more }, {
    headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
  });
}
