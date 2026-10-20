import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { MapWindow } from '@/components/site/pages/map-window';
import { LINK_BUTTON, Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { languageName } from '@/lib/core/wikipedia/language';
import { articleUrl } from '@/lib/core/wikipedia/refs';
import { AD_SLOTS } from '@/lib/platform/ads';
import type { EventArticle as Article } from '@/lib/platform/site/events/article';
import { coordinates, eventOpenPath, eventWhen, kindLabel, placeName, recordSummary } from '@/lib/platform/site/events/copy';
import type { EventPage } from '@/lib/platform/site/events/event-page';
import type { SiteText } from '@/lib/platform/site/text';
import { EventFacts } from './parts/event-facts';
import { EventList } from './parts/event-list';
import { EventSources } from './parts/event-sources';

const ZOOM: Record<number, number> = { 0: 5, 1: 5, 2: 4.5, 3: 4, 4: 3.5, 5: 3 };

/**
 * One historical event: what the records say, Wikipedia's summary where the event has an article, every source,
 * and the events around it. Nothing here is written for the page: it is the data, or Wikipedia, attributed.
 */
export function EventArticle({ text, event: e, name, article, kicker }: {
  text: SiteText;
  event: EventPage;
  /** The event's name in the page's language. */
  name: string;
  article: Article | null;
  kicker: { href: string; label: string } | null;
}) {
  const { t } = text;
  const open = eventOpenPath(e);
  const where = placeName(e) ?? coordinates(e);
  const wikiHref = article?.url ?? (e.wiki ? articleUrl(e.wiki) : null);
  const wikipedia = !article || article.lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(article.lang, t.intl) });
  const summary = recordSummary(e);
  const gtd = e.kind === 'attack.terror' && e.sources[0]?.code === 'gtd';
  return (
    <article>
      <header className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          {kicker
            ? <Link href={kicker.href} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>{kicker.label}</Link>
            : <p className="text-[13px] font-medium text-ink-3">{kindLabel(t, e.kind)}</p>}
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-5xl">{name}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{[eventWhen(t, e), where].filter(Boolean).join(' · ')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{t('Open on the map')}<ArrowUpRight className="size-4" aria-hidden /></a>
            {wikiHref && <a href={wikiHref} rel="noopener" className={LINK_BUTTON.secondary}>{wikipedia}</a>}
          </div>
        </div>
        <MapWindow href={open} image={null} alt={name} cta={t('Open on the map')} priority
          focus={e.lat !== null && e.lon !== null ? { lat: e.lat, lon: e.lon, zoom: ZOOM[e.geoPrec] ?? 4 } : undefined} />
      </header>

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          <Section title={t('What the records say')}>
            <EventFacts t={t} event={e} />
          </Section>

          {summary && (
            <Section title={t('Summary')}>
              <p>{summary}</p>
              {gtd && <p className="mt-3 text-[13px] text-ink-3">{t('From the Global Terrorism Database’s own summary of the attack.')}</p>}
            </Section>
          )}

          {article && (
            <Section title={article.title}>
              {article.description && <p className="text-[14px] text-ink-3">{article.description}</p>}
              <p className={article.description ? 'mt-3' : undefined}>{article.extract}</p>
              <p className="mt-3 text-[13px] text-ink-3">
                {t('From {source}, CC BY-SA', { source: wikipedia })}
                {' · '}<a href={article.url} rel="noopener" className={TEXT_LINK}>{t('Read the article')}</a>
              </p>
            </Section>
          )}

          <Section title={t('{n, plural, one {The source} other {# sources record it}}', { n: e.sources.length })}>
            <EventSources t={t} sources={e.sources} title={e.title} />
          </Section>

          {e.partOf.length > 0 && <Section title={t('event|Part of')}><EventList t={t} events={e.partOf} /></Section>}
          {e.parts.total > 0 && (
            <Section title={t('{n, plural, one {Includes # event} other {Includes # events}}', { n: e.parts.total })}>
              <EventList t={t} events={e.parts.shown} more={e.parts.total - e.parts.shown.length} columns />
            </Section>
          )}
          {e.related.total > 0 && (
            <Section title={e.family === 'terror' ? t('Related attacks') : t('Related events')}>
              <EventList t={t} events={e.related.shown} more={e.related.total - e.related.shown.length} columns />
            </Section>
          )}
        </div>
        <aside className="flex flex-col gap-10">
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      {e.nearby.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t('Nearby in time and place')}</h2>
          <div className="mt-5"><EventList t={t} events={e.nearby} columns /></div>
        </section>
      )}
    </article>
  );
}
