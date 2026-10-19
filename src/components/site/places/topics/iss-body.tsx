import { Satellite } from 'lucide-react';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { elementsLine, issLines, passRow } from '@/lib/platform/site/places/topics/iss-copy';
import type { IssData, IssLive } from '@/lib/platform/site/places/topics/iss';
import { SKY_RULES } from '@/lib/platform/site/places/topics/sky-rules';
import { zoneName } from '@/lib/platform/site/places/topics/sky-copy';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const ROWS = 6;

export const ISS_VIEW: TopicView<IssData, IssLive> = {
  icon: Satellite,

  Live({ text, place, page: { data }, live: { report } }) {
    const { t } = text;
    const lines = issLines(report, nameOf(place, t), t);
    const rows = report.visible.slice(0, ROWS).map(p => ({ key: p.rise, ...passRow(p, data.tz, t) }));
    const source = elementsLine(report, t);
    return (
      <>
        {lines.map(line => <p key={line}>{line}</p>)}
        {rows.length > 0 && (
          <ul className="mt-1 divide-y divide-line border-y border-line text-[14px]">
            {rows.map(r => (
              <li key={r.key} className="flex flex-col py-2 sm:flex-row sm:gap-4">
                <span className="text-ink-2 sm:w-52 sm:flex-shrink-0">{r.day}</span>
                <span className="font-mono tabular-nums text-ink-1 sm:w-28 sm:flex-shrink-0">{r.time}</span>
                <span className="text-ink-2">{r.path}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[13px] text-ink-3">
          {t('Times are {city} time ({zone}).', { city: nameOf(place, t), zone: zoneName(report.now, data.tz, t) })}
          {source ? ` ${source}` : ''}
        </p>
      </>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const city = nameOf(place, t);
    const notes = data.best < SKY_RULES.issMinElevation ? [
      t('The station’s orbit is tilted 51.6° to the equator, so the point beneath it never goes further north or south than that. From beyond about 64° it stays too low to see well.'),
      t('Passes are counted from 10° above the horizon, where buildings and haze stop hiding them.'),
    ] : [
      t('A pass can be seen when the station is still in sunlight while the sky over {city} is dark, in the hours after sunset or before dawn. It looks like a bright, steady star crossing the sky in a few minutes.', { city }),
      t('The times are predicted from the latest published orbital elements, not observed, and cloud isn’t taken into account.'),
      t('Passes are counted from 10° above the horizon, where buildings and haze stop hiding them.'),
    ];
    return <Notes text={text} notes={notes} layers={['iss-tracker', 'satellite-tracker', 'day-night-map']} />;
  },
};
