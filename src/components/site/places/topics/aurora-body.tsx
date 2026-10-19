import { Sparkles } from 'lucide-react';
import { SpokenText } from '@/components/site/pages/local-clock';
import { Section } from '@/components/site/pages/site-frame';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import type { AuroraData, AuroraLive } from '@/lib/platform/site/places/topics/aurora';
import { auroraLines, kpToReach, nowcastLine } from '@/lib/platform/site/places/topics/aurora-copy';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

export const AURORA_VIEW: TopicView<AuroraData, AuroraLive> = {
  icon: Sparkles,

  Live({ text, place, live: { report } }) {
    const { t } = text;
    const source = nowcastLine(report, t);
    return (
      <>
        {auroraLines(report, nameOf(place, t), t).map(line => <p key={line}>{line}</p>)}
        {source && <p className="text-[13px] text-ink-3"><SpokenText parts={source} intl={t.intl} /></p>}
      </>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const city = nameOf(place, t);
    const mlat = Math.round(Math.abs(data.mlat) * 10) / 10;
    const kp = kpToReach(data.mlat);
    return (
      <>
        <Section title={t('{city} and the auroral oval', { city })}>
          <ul className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2">
            <li>
              {t('{city} is at {mlat}° magnetic latitude ({field}). The aurora circles the magnetic poles, so this says more about how often it is seen here than the latitude on a map does.', { city, mlat, field: data.field })}
            </li>
            <li>
              {kp == null
                ? t('Only the strongest geomagnetic storms bring the aurora this far from the pole.')
                : kp === 0
                  ? t('Even on the quietest nights the aurora reaches this far, by a rough rule of thumb.')
                  : t('By a rough rule of thumb, the aurora reaches this far when the Kp index is {kp} or more.', { kp })}
            </li>
          </ul>
        </Section>
        <Notes
          text={text}
          notes={[
            t('NOAA’s model ignores cloud and moonlight: a high chance under cloud means nothing to see.'),
            t('It looks about 30 minutes ahead, so it says nothing about later tonight.'),
            t('Dark here means the sun at least 12° below the horizon; in twilight only a bright aurora shows.'),
          ]}
          layers={['aurora-forecast', 'cloud-map', 'day-night-map']}
        />
      </>
    );
  },
};
