import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowUpRight } from 'lucide-react';
import { LINK_BUTTON, Section, SiteFrame } from '@/components/site/pages/site-frame';
import { getT } from '@/lib/core/i18n/request';
import type { Translate } from '@/lib/core/i18n/translator';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { mapHref } from '@/lib/platform/site/map-link';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { bodyName, distanceText } from '@/lib/platform/site/space/copy';
import { fleetNow, type FleetNow } from '@/lib/platform/site/space/live';
import { planetPath, PLANETS } from '@/lib/platform/site/space/planets';
import { ROSTER, ROSTER_GROUPS, type RosterCraft } from '@/lib/platform/site/space/roster';
import { spaceImage } from '@/lib/platform/site/space/sitemap';
import { LANDING_SITES } from '@/lib/space/craft/landing-sites';
import { CraftCards } from './parts/craft-cards';
import { NowBox } from './parts/now-box';

const PATH = '/spacecraft';

export async function spacecraftIndexMetadata(): Promise<Metadata> {
  const t = await getT();
  return readingMetadata({
    locale: t.locale, path: PATH,
    title: t('Every spacecraft, rover and lander: where they are now'),
    description: t('Voyager, the James Webb telescope, the Mars rovers and every Moon landing: {n} spacecraft, each with where it is now from NASA JPL and its flight.', { n: ROSTER.length }),
    image: spaceImage('index', '', t.locale),
  });
}

function detail(t: Translate, c: RosterCraft, fleet: FleetNow | null): string | null {
  const site = c.site && LANDING_SITES[c.site.world].find(s => s.id === c.site!.id);
  if (site) return c.site!.world === 'mars' ? t('landed on Mars in {year}', { year: String(site.year) }) : t('landed on the Moon in {year}', { year: String(site.year) });
  const now = fleet?.craft.find(x => x.id === c.horizons);
  return now ? t('{distance} from Earth', { distance: distanceText(t, now.earthKm) }) : null;
}

/** Every spacecraft with a page, by where it works, with the planets above and the rest of JPL's fleet below. */
export async function SpacecraftIndex() {
  const t = await getT();
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const fleet = await fleetNow();
  const paged = new Set(ROSTER.map(c => c.horizons).filter(id => id !== undefined));
  const others = fleet?.craft.filter(c => !paged.has(c.id)) ?? [];
  const open = mapHref({ layers: [], mode: { view: 'space', focus: 'solar' }, panel: 'space' });
  return (
    <SiteFrame t={t} path={PATH}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: t('Spacecraft'), path: localePath(t.locale, PATH) }]),
      ]) }} />
      <header className="mt-8 max-w-[44rem]">
        <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Spacecraft')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          {t('The probes, telescopes, rovers and landers TAKIP places in its live solar system: where each one is now, how far its signal travels, and the flight that took it there.')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={open} className={LINK_BUTTON.primary}>{t('Open in 3D')}<ArrowUpRight className="size-4" aria-hidden /></a>
        </div>
      </header>

      <Section title={t('The planets')} className="mt-16">
        <ul className="flex flex-wrap gap-2">
          {PLANETS.map(p => (
            <li key={p.key}><Link href={localePath(t.locale, planetPath(p))} className={LINK_BUTTON.secondary}>{bodyName(t, p.key)}</Link></li>
          ))}
        </ul>
      </Section>

      {ROSTER_GROUPS.map(g => (
        <section key={g.id} id={g.id} className="mt-16 scroll-mt-8">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t(g.label)}</h2>
          <div className="mt-5"><CraftCards t={t} items={g.craft.map(craft => ({ craft, detail: detail(t, craft, fleet) }))} /></div>
        </section>
      ))}

      {fleet && others.length > 0 && (
        <NowBox t={t} at={fleet.at} className="mt-16" title={t('Also placed live in the 3D view')}>
          <p className="text-[14px] text-ink-2">{others.map(c => c.name).join(', ')}</p>
        </NowBox>
      )}
    </SiteFrame>
  );
}
