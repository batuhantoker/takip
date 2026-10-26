import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { openPath, type LayerPage } from '@/lib/platform/site/layer-pages';
import type { LiveLine } from '@/lib/platform/site/live/lines';
import { LIVE_IMAGES, liveImagePath, type LiveImageId } from '@/lib/platform/site/live-images';
import { LocalClock, SpokenText } from '../local-clock';
import { Section } from '../site-parts';

const AS_OF = msg('Right now · as of {time}');

/** The page's latest picture of the Sun or the Earth, and when it was taken. */
export type LiveShot = { id: LiveImageId; taken: number | null };

/** What the layer's feed said as the page was rendered, in words under the heading. */
export function LiveNow({ t, live }: { t: Translate; live: LiveLine }) {
  return (
    <div className="mt-6 max-w-[40rem]">
      <p className="flex items-center gap-2 text-[11px] leading-[14px] text-ink-3">
        <span className="size-1.5 rounded-full bg-green" aria-hidden />
        <span>{t.parts(AS_OF, { time: <LocalClock key="t" at={live.at} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[]}</span>
      </p>
      <p className="mt-2 text-[15px] leading-6 text-ink-1"><SpokenText parts={live.text} intl={t.intl} /></p>
    </div>
  );
}

/**
 * Where to look first, as rows that mark their place on the map beside them; a click flies it there while it is on
 * screen, and opens the full map at that view otherwise.
 */
export function SpotRows({ t, page }: { t: Translate; page: LayerPage }) {
  const spots = page.spots ?? [];
  if (!spots.length) return null;
  return (
    <Section title={t('Places to start')}>
      <ul className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-10">
        {spots.map(s => (
          <li key={s.label} data-map={`${s.view.lon},${s.view.lat}`} data-map-id={s.label} data-map-label={s.label}
            className="border-b border-line">
            <a href={openPath(page, s.view)} data-map-jump={s.view.zoom} className={cx('group block py-3.5', FOCUS_RING)}>
              <span className={cx('block text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{s.label}</span>
              {s.note && <span className="mt-0.5 block text-[13px] leading-5 text-ink-3">{s.note}</span>}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function LiveImage({ t, shot }: { t: Translate; shot: LiveShot }) {
  const spec = LIVE_IMAGES[shot.id];
  return (
    <Section title={t('The latest image')}>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element -- served from TAKIP's own address for image search */}
        <img src={liveImagePath(shot.id)} alt={t(spec.alt)} width={spec.size} height={spec.size} loading="lazy" decoding="async"
          className="aspect-square h-auto w-full max-w-[36rem] rounded-card border border-line bg-black" />
        <figcaption className="mt-3 max-w-[36rem] text-[13px] leading-relaxed text-ink-3">
          {shot.taken !== null
            ? t.parts(spec.taken, { time: <LocalClock key="t" at={shot.taken} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[]
            : t(spec.latest)}
        </figcaption>
      </figure>
    </Section>
  );
}

/** What the layer can't tell you, closing the page; its sources are credited in the footer. */
export function GoodToKnow({ t, page }: { t: Translate; page: LayerPage }) {
  if (!page.limits.length) return null;
  return (
    <Section tier="about" title={t('Good to know')}>
      <ul className="flex max-w-[46rem] flex-col gap-2">
        {page.limits.map(item => <li key={item}>{item}</li>)}
      </ul>
    </Section>
  );
}
