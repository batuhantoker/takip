import AdSlot from '@/components/shell/ads/ad-slot';
import { AD_SLOTS } from '@/lib/platform/ads';
import { pagePath, SECTION_GROUPS, type LayerPage, type SectionId } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { shotUrl } from '@/lib/platform/site/shots';
import type { SiteText } from '@/lib/platform/site/text';
import { LayerRows } from './layer-rows';
import { PageCard } from './page-card';

export interface CatalogSection { id: SectionId; label: string; blurb: string; pages: LayerPage[] }

/** What CatalogFilter matches a page by: its name, what it says it is, and who the data comes from. */
const findBy = (p: LayerPage) => [p.heading, p.description, ...p.sources.map(s => s.name)].join(' ');

/**
 * Every layer page by section: the section's first page as its picture, kept in view beside the rest as rows, which
 * a long section splits under headings. Marked for CatalogFilter.
 */
export function LayerCatalog({ text, sections }: { text: SiteText; sections: CatalogSection[] }) {
  const { t } = text;
  return (
    <div data-catalog>
      {sections.map(({ id, label, blurb, pages: [lead, ...rest] }, i) => {
        const named = SECTION_GROUPS[id] ?? [];
        // A page in none of its section's groups still gets a row, under no heading.
        const groups = [
          ...named.map(g => ({ label: t(g.label), pages: rest.filter(p => g.slugs.has(p.slug)) })),
          { label: '', pages: rest.filter(p => !named.some(g => g.slugs.has(p.slug))) },
        ].filter(g => g.pages.length);
        return (
          // Clear of the sticky tabs when one of them jumps here.
          <section key={id} id={id} data-catalog-section className="mt-16 scroll-mt-16">
            <h2 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-ink-1">{label}</h2>
            <p className="mt-1 text-[15px] leading-6 text-ink-3">{blurb}</p>
            {/* With its picture filtered out, the rows take the width. */}
            <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10 lg:has-[>[hidden]]:grid-cols-1">
              <div data-catalog-item={findBy(lead)} className="lg:sticky lg:top-16">
                <PageCard href={localePath(text.locale, pagePath(lead))} image={shotUrl(lead.slug)} title={lead.heading} description={lead.description}
                  points={(lead.spots ?? []).map(s => s.view)} />
              </div>
              {groups.length > 0 && (
                <div className="flex flex-col gap-8">
                  {groups.map(g => (
                    <div key={g.label || id} data-catalog-group>
                      {g.label && <h3 className="mb-2 text-[15px] leading-6 font-medium text-ink-2">{g.label}</h3>}
                      <LayerRows t={t} pages={g.pages} className="sm:grid-cols-2" findBy={findBy} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {i === 2 && <AdSlot slot={AD_SLOTS.page} variant="page" className="mt-12" />}
          </section>
        );
      })}
    </div>
  );
}
