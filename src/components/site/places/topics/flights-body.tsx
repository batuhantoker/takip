import { Plane } from 'lucide-react';
import { Section } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import type { StationNow } from '@/lib/platform/site/places/live/metar-now';
import type { FlightsData } from '@/lib/platform/site/places/topics/flights';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

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
