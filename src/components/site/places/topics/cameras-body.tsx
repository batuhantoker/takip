import { Video } from 'lucide-react';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { LocalClock } from '@/components/site/pages/local-clock';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { haversine } from '@/lib/core/geodesic';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { mapHref } from '@/lib/platform/site/map-link';
import { crawlRel } from '@/lib/platform/site/meta';
import { count, nameOf, placeName, wordingOf } from '@/lib/platform/site/places/copy/format';
import { placeIndexed } from '@/lib/platform/site/places/pages';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import type { CameraPick, CamerasData } from '@/lib/platform/site/places/topics/cameras';
import { Notes } from '../parts/notes';
import { WithFigures } from '../parts/place-links';
import { CameraFrames, type CameraFrame } from './parts/camera-frames';
import { CameraPlayer } from './parts/camera-player';
import type { TopicView } from './view';

const COUNTED = msg('Counted within {km, radius} of the centre of {city} from the camera list as it was at {time} on {day}. Cameras come and go as their owners add and retire them.');

const NEAREST = [
  msg('Nearest the centre of {city}: {name}, from {source}, {km, distance} away.'),
  msg('{name} ({source}) is the closest camera to the centre of {city}, {km, distance} out.'),
  msg('Of the cameras around {city}, {name} from {source} is nearest the centre, {km, distance} away.'),
];

const CAMERA_ZOOM = 15;

/** A camera on the map, close enough to pick out. */
const cameraPath = (at: [number, number]) => mapHref({ layers: ['cctv', 'cctv_previews'], view: { lat: at[1], lon: at[0], zoom: CAMERA_ZOOM } });

const AWAY = msg('{km, distance} away');

/** Frames, as the client grid takes them: its text already in the reader's language. */
const framesOf = (data: CamerasData, t: Translate): CameraFrame[] => data.frames.map(f => ({
  key: `${f.at.join(',')}-${f.name}`, name: f.name, src: f.frame, href: cameraPath(f.at), meta: `${f.source} · ${t(AWAY, { km: f.km })}`,
}));

/** Four make a square; three would leave a hole, so two. */
const shownOf = (n: number) => (n >= 4 ? 4 : Math.min(n, 2));

function pickMeta(p: CameraPick, t: Translate): string {
  if (p.offline) return `${p.source} · ${t('off air')}`;
  return [p.source, t(AWAY, { km: p.km }), ...(p.look === 'stream' || p.look === 'player' ? [t('video')] : [])].join(' · ');
}

const NONE_SENDING = msg('None of these cameras is sending a picture just now. They may still play on the live map.');

export const CAMERAS_VIEW: TopicView<CamerasData> = {
  icon: Video,
  nearbySummary: true,
  overviewFirst: true,
  mapBeside: true,
  figures: ({ text: { t }, page: { data } }) => (data.onAir ? [{ value: count(data.onAir, t), label: t('public cameras') }] : []),

  // The pictures are what a reader came for; on a phone they sit right under the map button.
  Hero({ text: { t }, page: { data } }) {
    if (!data.frames.length) {
      if (!data.streams.length) return null;
      return (
        <CameraPlayer labels={{ play: t('Play video'), failed: t('This camera isn’t sending video just now. Try another, or the live map.'), onMap: t('On the map') }}
          cameras={data.streams.map(c => ({ key: `${c.at.join(',')}-${c.name}`, name: c.name, meta: `${c.source} · ${t(AWAY, { km: c.km })}`, href: cameraPath(c.at), ...c.stream }))} />
      );
    }
    return (
      <div>
        <CameraFrames frames={framesOf(data, t)} show={shownOf(data.frames.length)} empty={t(NONE_SENDING)} />
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">{t('The latest picture from each camera nearest the centre, fetched again every minute. Open one to see it on the live map.')}</p>
      </div>
    );
  },

  // Picks run nearest first, so the first on air is the one a reader in the centre would look at; the frames say it when they show.
  Lead({ text: { t }, place, page: { data } }) {
    const near = data.onAir && !data.frames.length && !data.streams.length ? data.picks[0] : null;
    if (!near) return null;
    return (
      <p className="text-[15px] leading-relaxed text-ink-1">
        {t(wordingOf(place, 'nearest', NEAREST), { city: placeName(place, t), name: near.name, source: near.source, km: haversine(place.at, near.at) })}
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
      t(wordingOf(place, 'note-still', [msg('Many sources publish a still picture that updates every minute or few, not video. Click a camera on the map to see which it is.'), msg('Many cameras send a still picture every minute or so rather than video; click one on the map to find out which kind it is.')])),
    ];
    return (
      <>
        {data.sources.length > 0 && (
          <Section title={t('Who publishes them')}>
            <ul className="divide-y divide-line border-y border-line">
              {data.sources.map(([name, n]) => (
                <li key={name} className="flex items-baseline justify-between gap-6 py-3 text-[14px]">
                  <span className="font-medium text-ink-1">{name}</span>
                  <span className="font-mono tabular-nums text-ink-2">{count(n, t)}</span>
                </li>
              ))}
              {data.others > 0 && (
                <li className="flex items-baseline justify-between gap-6 py-3 text-[14px]">
                  <span className="text-ink-2">{t('Other sources')}</span>
                  <span className="font-mono tabular-nums text-ink-2">{count(data.others, t)}</span>
                </li>
              )}
            </ul>
          </Section>
        )}

        <Section title={data.onAir ? t('The cameras nearest the centre') : t('The cameras listed, off air')}>
          <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
            {data.picks.map(p => (
              <li key={`${p.name}-${p.at.join(',')}`} data-map={p.at.join(',')} data-map-label={p.name} className="border-b border-line">
                <a href={cameraPath(p.at)} data-map-jump={CAMERA_ZOOM} className={cx('group block py-3', FOCUS_RING, p.offline && 'opacity-70')}>
                  <span className={cx('block truncate text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{p.name}</span>
                  <span className="block truncate text-[13px] leading-5 text-ink-3"><WithFigures text={pickMeta(p, t)} /></span>
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Notes text={text} notes={notes} layers={['live-cameras', 'live-news']} />
      </>
    );
  },

  Overview({ text: { t }, place, page }) {
    return <CameraStrip t={t} place={place} data={page.data} slug={page.slug} />;
  },
};

/** A place's nearest camera pictures, leading to its camera page: on its overview and beside its other topics. */
export function CameraStrip({ t, place, data, slug }: { t: Translate; place: Place; data: CamerasData; slug: string }) {
  if (!data.frames.length) return null;
  return (
    <Section title={t('The latest from cameras in {city}', { city: nameOf(place, t) })}>
      <CameraFrames frames={framesOf(data, t)} show={shownOf(data.frames.length)} empty={t(NONE_SENDING)} eager={false} />
      <p className="mt-4 text-[14px]">
        <Link href={localePath(t.locale, placePath(place, slug))} rel={crawlRel(placeIndexed(place, slug))} className={TEXT_LINK}>
          {t('{n, plural, one {The camera in and around {city}} other {All # cameras in and around {city}}}', { n: data.onAir, city: nameOf(place, t) })}
        </Link>
      </p>
    </Section>
  );
}
