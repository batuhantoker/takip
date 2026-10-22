import { ArrowUpRight, Video } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { LocalClock } from '@/components/site/pages/local-clock';
import { Section } from '@/components/site/pages/site-frame';
import { haversine } from '@/lib/core/geodesic';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { mapHref } from '@/lib/platform/site/map-link';
import { count, nameOf, placeName, wordingOf } from '@/lib/platform/site/places/copy/format';
import type { CamerasData } from '@/lib/platform/site/places/topics/cameras';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const COUNTED = msg('Counted within {km} km of the centre of {city} from the camera list as it was at {time} on {day}. Cameras come and go as their owners add and retire them.');

const NEAREST = [
  msg('Nearest the centre of {city}: {name}, from {source}, {km} km away.'),
  msg('{name} ({source}) is the closest camera to the centre of {city}, {km} km out.'),
  msg('Of the cameras around {city}, {name} from {source} is nearest the centre, {km} km away.'),
];

const kmText = (km: number, t: Translate) => new Intl.NumberFormat(t.intl, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km);

/** A camera on the map, close enough to pick out. */
const cameraPath = (at: [number, number]) => mapHref({ layers: ['cctv', 'cctv_previews'], view: { lat: at[1], lon: at[0], zoom: 15 } });

export const CAMERAS_VIEW: TopicView<CamerasData> = {
  icon: Video,

  // Picks run nearest first, so the first on air is the one a reader in the centre would look at.
  Lead({ text: { t }, place, page: { data } }) {
    const near = data.onAir ? data.picks[0] : null;
    if (!near) return null;
    return (
      <p className="text-[15px] leading-relaxed text-ink-1">
        {t(wordingOf(place, 'nearest', NEAREST), { city: placeName(place, t), name: near.name, source: near.source, km: kmText(haversine(place.at, near.at), t) })}
      </p>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const notes = [
      <Fragment key="counted">{t.parts(COUNTED, {
        km: data.km, city: nameOf(place, t),
        time: <LocalClock key="time" at={data.counted} intl={t.intl} />, day: <LocalClock key="day" at={data.counted} show="date" intl={t.intl} />,
      }) as ReactNode[]}</Fragment>,
      ...(data.onAir && data.offAir ? [t('{n, plural, one {One more camera is} other {# more cameras are}} listed but off air.', { n: data.offAir })] : []),
      t('Many sources publish a still picture that updates every minute or few, not video. Click a camera on the map to see which it is.'),
    ];
    return (
      <>
        {data.sources.length > 0 && (
          <Section title={t('Who publishes them')}>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
              {data.sources.map(([name, n]) => (
                <li key={name} className="flex items-baseline justify-between gap-6 px-4 py-3 text-[14px]">
                  <span className="font-medium text-ink-1">{name}</span>
                  <span className="font-mono tabular-nums text-ink-2">{count(n, t)}</span>
                </li>
              ))}
              {data.others > 0 && (
                <li className="flex items-baseline justify-between gap-6 px-4 py-3 text-[14px]">
                  <span className="text-ink-2">{t('Other sources')}</span>
                  <span className="font-mono tabular-nums text-ink-2">{count(data.others, t)}</span>
                </li>
              )}
            </ul>
          </Section>
        )}

        <Section title={data.onAir ? t('The cameras nearest the centre') : t('The cameras listed, off air')}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.picks.map(p => (
              <li key={`${p.name}-${p.at.join(',')}`}>
                <a href={cameraPath(p.at)}
                  className={cx('group flex items-center gap-3 rounded-card border border-line bg-surface-1 px-3 py-2.5 hover:border-line-strong', FOCUS_RING, TRANSITION, p.offline && 'opacity-70')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink-1">{p.name}</span>
                    <span className="block text-[12px] text-ink-3">{p.offline ? `${p.source} · ${t('off air')}` : p.source}</span>
                  </span>
                  <ArrowUpRight className="size-4 flex-shrink-0 text-ink-3 group-hover:text-ink-1" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Notes text={text} notes={notes} layers={['live-cameras', 'live-news']} />
      </>
    );
  },
};
