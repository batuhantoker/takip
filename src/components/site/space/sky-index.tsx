import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ArrowUpRight } from 'lucide-react';
import { LINK_BUTTON, Section, SiteFrame } from '@/components/site/pages/site-frame';
import { getT } from '@/lib/core/i18n/request';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { mapHref } from '@/lib/platform/site/map-link';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { spaceImage } from '@/lib/platform/site/space/sitemap';
import { REALMS, realmPages, SKY_INDEX_PATH, SKY_PAGES, skyIndexDescription, skyIndexTitle } from '@/lib/platform/site/space/sky-pages';
import { groupPages, STRUCTURE_GROUPS } from '@/lib/platform/site/space/structure-pages';
import { DeepSkyCards } from './parts/sky-cards';
import { StructureCards } from './parts/structure-cards';

export async function skyIndexMetadata(): Promise<Metadata> {
  const t = await getT();
  return readingMetadata({ locale: t.locale, path: SKY_INDEX_PATH, title: skyIndexTitle(t), description: skyIndexDescription(t), image: spaceImage('sky', '', t.locale) });
}

/** Every pictured nebula, cluster, galaxy and black hole, by where it is: in the Milky Way, among its neighbours, and far beyond. */
export async function SkyIndex() {
  const t = await getT();
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const open = mapHref({ layers: [], mode: { view: 'space', focus: 'galaxy' } });
  return (
    <SiteFrame t={t} path={SKY_INDEX_PATH}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: t('Deep sky'), path: localePath(t.locale, SKY_INDEX_PATH) }]),
      ]) }} />
      <header className="mt-8 max-w-[46rem]">
        <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Nebulae, galaxies and black holes')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          {t('{n} telescope pictures from Webb, Hubble, ESO and NOIRLab, each hung in TAKIP’s 3D universe where its object really is, as large as it is on the sky. Pick one to see how far it is, or fly there.', { n: SKY_PAGES.length })}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={open} className={LINK_BUTTON.primary}>{t('Open in 3D')}<ArrowUpRight className="size-4" aria-hidden /></a>
        </div>
      </header>
      {REALMS.map(r => (
        <Section key={r.id} title={t(r.label)} className="mt-16">
          <DeepSkyCards t={t} items={realmPages(r.id).map(p => p.object)} columns="sm:grid-cols-3 lg:grid-cols-4" />
        </Section>
      ))}
      <h2 className="mt-24 text-[28px] leading-tight font-semibold tracking-[-0.015em] text-ink-1">{t('The large-scale universe')}</h2>
      <p className="mt-3 max-w-[46rem] text-[15px] leading-relaxed text-ink-2">
        {t('Past the galaxies we have pictures of, the space view draws the structure they are part of from survey data: superclusters and the basins their galaxies flow in, clusters and walls, the voids between them, and the microwave background at the edge.')}
      </p>
      {STRUCTURE_GROUPS.map(g => (
        <Section key={g.id} title={t(g.label)} className="mt-10">
          <StructureCards t={t} items={groupPages(g.id)} />
        </Section>
      ))}
    </SiteFrame>
  );
}
