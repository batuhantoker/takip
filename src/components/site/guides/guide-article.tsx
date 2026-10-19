import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { MapWindow } from '@/components/site/pages/map-window';
import { PageCard } from '@/components/site/pages/page-card';
import { SECTION_ICON } from '@/components/site/pages/section-icon';
import { LINK_BUTTON, Section } from '@/components/site/pages/site-frame';
import { WorldSketch } from '@/components/site/pages/world-sketch';
import { AD_SLOTS } from '@/lib/platform/ads';
import { guideOpenPath, guidePath, type Guide } from '@/lib/platform/site/guides/guides';
import { layerPage, pagePath } from '@/lib/platform/site/layer-pages';
import { shotUrl } from '@/lib/platform/site/shots';
import type { SiteText } from '@/lib/platform/site/text';

/** A guide: the question it answers, the explanation in sections, places to look, and the layer pages behind it. */
export function GuideArticle({ text, guide, others }: { text: SiteText; guide: Guide; others: Guide[] }) {
  const { t } = text;
  const Icon = SECTION_ICON[guide.section];
  const open = guideOpenPath(guide);
  const layers = guide.layers.map(slug => layerPage(slug)).filter(p => !!p);
  const checked = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(guide.checked));
  return (
    <article>
      <header className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <Link href="/guides" className={cx('inline-flex items-center gap-2 text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            <Icon className="size-4" aria-hidden />{t('Guides')}
          </Link>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{guide.heading}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{guide.lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{t('Open the live map')}<ArrowUpRight className="size-4" aria-hidden /></a>
          </div>
          <p className="mt-6 text-[13px] text-ink-3">{t('Checked against the map on {day}.', { day: checked })}</p>
        </div>
        <MapWindow href={open} image={layers[0] ? shotUrl(layers[0].slug) : null} alt={guide.heading} cta={t('Open the live map')}
          points={guide.open.view ? [guide.open.view] : []} priority />
      </header>

      <div className="mt-20 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div className="max-w-[44rem]">
          {guide.sections.map(s => (
            <Section key={s.heading} title={s.heading}>
              <div className="flex flex-col gap-4">
                {s.paragraphs.map(p => <p key={p}>{p}</p>)}
              </div>
              {s.steps && (
                <ol className="mt-5 flex list-decimal flex-col gap-2 pl-5 marker:text-ink-4">
                  {s.steps.map(step => <li key={step}>{step}</li>)}
                </ol>
              )}
              {s.spots && (
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {s.spots.map(spot => (
                    <li key={spot.label}>
                      <a href={guideOpenPath(guide, spot.view)}
                        className={cx('group flex items-center gap-3 rounded-card border border-line bg-surface-1 p-2 pr-3 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
                        <span className="block h-12 w-20 flex-shrink-0 overflow-hidden rounded-control border border-line"><WorldSketch focus={spot.view} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-ink-1">{spot.label}</span>
                          {spot.note && <span className="block text-[12px] leading-snug text-ink-3">{spot.note}</span>}
                        </span>
                        <ArrowUpRight className="size-4 flex-shrink-0 text-ink-3 group-hover:text-ink-1" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ))}
        </div>
        <aside className="flex flex-col gap-10">
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      {layers.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t('The layers behind this guide')}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {layers.map(p => (
              <PageCard key={p.slug} href={pagePath(p)} image={shotUrl(p.slug)} title={p.heading} description={p.description} points={(p.spots ?? []).map(s => s.view)} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-16">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t('More guides')}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map(g => (
              <li key={g.slug}>
                <Link href={guidePath(g)} className={cx('flex h-full flex-col gap-1 rounded-card border border-line bg-surface-1 p-4 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
                  <span className="text-[15px] font-semibold text-ink-1">{g.heading}</span>
                  <span className="line-clamp-2 text-[13px] leading-relaxed text-ink-3">{g.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
