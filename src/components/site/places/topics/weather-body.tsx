import { CloudRain } from 'lucide-react';
import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { layerPage, openPath, pagePath } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { listOf, nameOf, placeName, wordingOf } from '@/lib/platform/site/places/copy/format';
import type { Place } from '@/lib/platform/site/places/place';
import type { WeatherData, WeatherLive } from '@/lib/platform/site/places/topics/weather';
import type { CityForecast } from '@/lib/platform/site/places/topics/weather-forecast';
import { pageIn, type SiteText } from '@/lib/platform/site/text';
import { WeatherForecast } from './parts/weather-forecast';
import type { TopicView } from './view';

type Kind = 'measured' | 'model' | 'warnings';
/** How far the weather table looks for an airport station (tools/site/topics/air-weather.ts). */
const STATION_KM = 30;
const KIND: Record<Kind, string> = { measured: msg('Measured'), model: msg('Forecast model'), warnings: msg('Official warnings') };

interface Row { slug: string; kind: Kind; covered: boolean; note: string }

function rows(t: Translate, place: Place, d: WeatherData): Row[] {
  const city = nameOf(place, t);
  return [
    {
      slug: 'rain-radar', kind: 'measured', covered: d.radar !== false,
      note: d.radar === false ? t('No ground radar in RainViewer’s mosaic reaches {city}.', { city })
        : d.radar ? t('{city} is inside RainViewer’s radar coverage. Frames every 10 minutes for the last 2 hours.', { city })
          : t('Frames every 10 minutes for the last 2 hours, where ground radars reach.'),
    },
    {
      slug: 'lightning-map', kind: 'measured', covered: !!d.lightning,
      note: d.lightning === 'nowcoast' ? t('{city} is inside the area NOAA’s lightning networks cover. Strike density every 15 minutes.', { city })
        : d.lightning === 'mtg' ? t('{city} is inside the area Meteosat’s Lightning Imager sees from orbit. Flashes every 5 minutes.', { city })
          : t('Not covered: no lightning network on the map reaches {city}.', { city }),
    },
    { slug: 'temperature-map', kind: 'model', covered: true, note: t('NOAA’s GFS model on a 0.25° grid, points about {spacing, radius} apart: the forecast for now, not a thermometer reading.', { spacing: 25 }) },
    { slug: 'wind-map', kind: 'model', covered: true, note: t('Wind 10 metres up from the same model, so it smooths over streets and hills.') },
    {
      slug: 'severe-weather', kind: 'warnings', covered: true,
      note: d.alerts === 'nws' ? t('Active alerts from the US National Weather Service, each pinned as one point.')
        : d.alerts === 'canada' ? t('Weather warnings from Environment Canada and the provinces.')
          : t('Severe and extreme warnings that the national weather service shares with the WMO.'),
    },
    {
      slug: 'airport-weather', kind: 'measured', covered: d.stations.length > 0,
      note: d.stations.length
        ? t('The latest reports from {stations}, usually every hour.', { stations: listOf(d.stations.map(s => t('{name} ({icao}), {km, distance} away', { name: s.name, icao: s.icao, km: s.km })), t) })
        : t('No airport weather station reports within {reach, radius} of {city}.', { city, reach: STATION_KM }),
    },
  ];
}

function LayerRows({ text, place, data }: { text: SiteText; place: Place; data: WeatherData }) {
  const { t } = text;
  const view = { lat: place.at[1], lon: place.at[0], zoom: 8 };
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
      {rows(t, place, data).map(r => {
        const found = layerPage(r.slug);
        if (!found) return null;
        const page = pageIn(text, found);
        return (
          <li key={r.slug} className={cx('flex flex-col gap-2 px-4 py-4 sm:flex-row sm:gap-6', !r.covered && 'opacity-70')}>
            <span className="sm:w-56 sm:flex-shrink-0">
              <span className="block text-[14px] font-medium text-ink-1">{page.heading}</span>
              <span className="mt-1 inline-block rounded-control border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-3">{t(KIND[r.kind])}</span>
            </span>
            <span className="flex-1 text-[14px] leading-relaxed text-ink-2">
              {r.note}
              <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                {r.covered && <a href={openPath(page, view)} className={TEXT_LINK}>{t('Open on the map')}</a>}
                <Link href={localePath(t.locale, pagePath(page))} className={cx('text-ink-3 hover:text-ink-1', FOCUS_RING)}>{t('About this layer')}</Link>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Lightning and rain around the city, and the airport reports in everyday words, without the flight category the flights page gives. */
function WeatherNow({ t, items }: { t: Translate; items: WeatherLive[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map(s => ('lines' in s
        ? <li key="now">{s.lines.join(' ')}</li>
        : (
          <li key={s.icao}>
            <span className="text-ink-2">{t('{name}, {km, distance}', { name: s.name, km: s.km })}:</span>{' '}
            {s.text}
            <span className="text-[13px] text-ink-3"> · {t('{n, plural, one {# minute ago} other {# minutes ago}}', { n: s.minutesAgo })}</span>
          </li>
        )))}
    </ul>
  );
}

export const WEATHER_VIEW: TopicView<WeatherData, WeatherLive[], CityForecast> = {
  icon: CloudRain,

  Live: ({ text, live }) => (live.length ? <WeatherNow t={text.t} items={live} /> : null),

  Wide: ({ text, place, detail }) => (detail
    ? <WeatherForecast t={text.t} city={nameOf(place, text.t)} place={placeName(place, text.t)} seed={String(place.id)} cc={place.cc} forecast={detail} />
    : null),

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const city = nameOf(place, t);
    return (
      <>
        <Section title={t('What the map shows over {city}', { city })}>
          <LayerRows text={text} place={place} data={data} />
        </Section>
        <Section title={t('Good to know')}>
          <ul className="flex flex-col gap-3 border-l-2 border-amber/50 pl-4 text-[14px] leading-relaxed">
            <li>{t(wordingOf(place, 'note-measured', [msg('Radar, lightning and airport reports are measurements. Temperature and wind are a forecast model’s values for the nearest hour, which can differ from what a thermometer in {city} reads.'), msg('Radar, lightning and the airport reports are measured; temperature and wind come from a forecast model for the nearest hour, so a thermometer in {city} can read differently.')]), { city })}</li>
            <li>{t(wordingOf(place, 'note-zoom', [msg('Radar detail stops at about zoom 7 and lightning at zoom 8, so the weather of a single street isn’t resolved.'), msg('Past about zoom 7 for radar and zoom 8 for lightning the map shows no finer detail: it can’t resolve the weather of one street.')]))}</li>
            <li>{t(wordingOf(place, 'note-safety', [msg('For a picture of conditions, not for safety decisions: follow the warnings of your local weather service.'), msg('Use it to see conditions, not to make safety decisions; for those, follow your local weather service’s warnings.')]))}</li>
          </ul>
        </Section>
      </>
    );
  },
};
