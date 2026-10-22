import { Plane } from 'lucide-react';
import { FlightFinder } from '@/components/site/pages/flight-finder';
import { Section } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { listOf, placeName, wordingOf } from '@/lib/platform/site/places/copy/format';
import type { StationNow } from '@/lib/platform/site/places/live/metar-now';
import type { FlightsData } from '@/lib/platform/site/places/topics/flights';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const MAJOR = [
  msg('From {city}, the nearest major airport is {name} ({iata}), {km} km away.'),
  msg('{name} ({iata}) is the nearest major airport to {city}, {km} km from the centre.'),
];

/** "Antwerp International Airport (Deurne)" before its own "(ANR)" reads as two brackets. */
const bare = (name: string) => name.replace(/\s*\([^)]*\)$/, '');

/** Each station's latest report, one per line. */
export function StationsNow({ t, stations }: { t: Translate; stations: StationNow[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {stations.map(s => (
        <li key={s.icao}>
          <span className="font-mono text-[13px] text-ink-3">{s.icao}</span>{' '}
          <span className="text-ink-2">{t('{name}, {km} km', { name: s.name, km: s.km })}:</span>{' '}
          {s.text}{s.cat ? ` · ${s.cat}` : ''}
          <span className="text-[13px] text-ink-3"> · {t('{n, plural, one {# minute ago} other {# minutes ago}}', { n: s.minutesAgo })}</span>
        </li>
      ))}
    </ul>
  );
}

export const FLIGHTS_VIEW: TopicView<FlightsData, StationNow[]> = {
  icon: Plane,

  // OurAirports calls a few small fields scheduled (Teterboro), so the sentence leads with a large airport when one is near.
  Lead({ text: { t }, place, page: { data } }) {
    const near = [...data.airports].sort((a, b) => a.km - b.km);
    const first = near.find(a => a.large) ?? near[0];
    if (!first) return null;
    const vars = { city: placeName(place, t), name: bare(first.name), iata: first.iata, km: first.km };
    const others = near.filter(a => a !== first).map(a => t('{name} ({iata}, {km} km)', { name: bare(a.name), iata: a.iata, km: a.km }));
    return (
      <p className="text-[15px] leading-relaxed text-ink-1">
        {first.large ? t(wordingOf(place, 'airport', MAJOR), vars) : t('From {city}, the nearest airport with scheduled flights is {name} ({iata}), {km} km away.', vars)}
        {others.length > 0 && ` ${t('Also within reach: {airports}.', { airports: listOf(others, t) })}`}
      </p>
    );
  },

  Live: ({ text, live }) => (live.length ? <StationsNow t={text.t} stations={live} /> : null),

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const codes = data.airports.map(a => a.iata).join(', ');
    const notes = [
      ...(place.cc === 'US' ? [t('FAA ground stops and delay programmes at {airports} show on the map while they are in force.', { airports: codes })] : []),
      t('Only aircraft that broadcast ADS-B appear, and only where a receiver hears them.'),
      t('Zoomed in, aircraft within about 250 nautical miles refresh every 15 seconds.'),
    ];
    return (
      <>
        <Section title={t('Find a flight')}>
          <FlightFinder near={{ lat: place.at[1], lng: place.at[0] }} />
        </Section>
        <Section title={t('Airports')}>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
            {data.airports.map(a => (
              <li key={a.icao} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="text-[14px] font-medium text-ink-1 sm:w-72 sm:flex-shrink-0">{a.name}</span>
                <span className="text-[14px] text-ink-2">
                  <span className="font-mono">{a.iata} · {a.icao}</span>
                  {' · '}{t('{km} km from the centre', { km: a.km })}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Notes text={text} notes={notes} layers={['flight-tracker', 'airport-weather', ...(place.cc === 'US' ? ['airport-delays'] : []), 'private-jets']} />
      </>
    );
  },
};
