import Link from 'next/link';
import { LINK_BUTTON, TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { bigKm } from '@/lib/platform/site/space/copy';
import { stopHref } from '@/lib/platform/site/space/journey';
import { lightYearsText } from '@/lib/platform/site/space/sky-pages';
import type { PlacedStop } from '@/lib/platform/site/space/overview';
import { LY_KM } from '@/lib/space/astro';
import { lightTime } from '@/lib/space/format';
import { PictureCredit, SpaceImage } from './space-image';

/** "5,700 light-years", "2.54 million light-years". */
export const lightYears = lightYearsText;

/** Within the solar system, light time leads; past it, light-years. */
function distance(t: Translate, s: PlacedStop): { value: string; note: string | null } | null {
  if (s.km === null || s.lightSec === null) return null;
  const ly = s.km / LY_KM;
  if (ly < 0.5) return { value: lightTime(s.lightSec, t), note: t('of light · {km}', { km: bigKm(t, s.km) }) };
  return { value: lightYears(t, ly), note: null };
}

/**
 * The way out as a numbered column of stops, each a picture and its distance, with a way into the 3D view there.
 * The stops are a sequence, so the list is ordered and each row says how far.
 */
export function JourneyLadder({ t, stops, start = 1 }: { t: Translate; stops: PlacedStop[]; start?: number }) {
  return (
    <ol className="border-b border-line">
      {stops.map((s, i) => {
        const d = distance(t, s);
        const open = stopHref(s.stop);
        return (
          <li key={s.stop.id} className="grid grid-cols-1 gap-5 border-t border-line py-7 sm:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] sm:gap-10">
            <div>
              <a href={open} aria-label={t('Fly to {name} in 3D', { name: t(s.stop.name) })} className={cx('group block', FOCUS_RING)}>
                <SpaceImage t={t} picture={s.picture} alt={t(s.stop.name)} ratio="aspect-[16/10]" />
              </a>
              {s.picture && <PictureCredit t={t} picture={s.picture} />}
            </div>
            <div className="sm:pt-1">
              <p className="font-mono text-[12px] leading-4 text-ink-3 tabular-nums">{String(start + i).padStart(2, '0')}</p>
              <h3 className="mt-2 text-[22px] leading-7 font-semibold tracking-[-0.01em] text-ink-1">{t(s.stop.name)}</h3>
              {d ? (
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5">
                  <span className="font-mono text-[26px] leading-8 font-medium tracking-[-0.01em] text-accent tabular-nums">{d.value}</span>
                  {d.note && <span className="text-[13px] text-ink-3">{d.note}</span>}
                  {s.at !== null && <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3"><span className="size-1.5 rounded-full bg-green" aria-hidden />{t('now')}</span>}
                </p>
              ) : (
                <p className="mt-3 text-[22px] leading-8 font-medium text-accent">{t('You are here')}</p>
              )}
              <p className="mt-3 max-w-[34rem] text-[15px] leading-6 text-ink-2">{t(s.stop.line)}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <a href={open} className={LINK_BUTTON.secondary}>{t('Fly there in 3D')}</a>
                {s.stop.page && <Link href={localePath(t.locale, s.stop.page.path)} className={cx(TEXT_LINK, 'text-[14px]')}>{t(s.stop.page.label)}</Link>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
