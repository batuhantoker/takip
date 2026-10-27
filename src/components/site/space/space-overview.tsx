import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { DEEP_JOURNEY, DEEP_SKY_TEASER, deepSkyRest, SOLAR_JOURNEY } from '@/lib/platform/site/space/journey';
import { placeStops, planetCards, spaceNow } from '@/lib/platform/site/space/overview';
import { deepSkyObject, type DeepSkyObject } from '@/lib/space/deep/deep-sky';
import { JourneyLadder } from './parts/journey-ladder';
import { DeepSkyCards, PlanetCards } from './parts/sky-cards';
import { SpaceFigures } from './parts/space-figures';

const REALM_TITLE: Record<DeepSkyObject['realm'], string> = {
  'milky-way': msg('In the Milky Way'),
  'local-group': msg('Our neighbour galaxies'),
  beyond: msg('Far beyond'),
};

/** The solar system page's own part: today's numbers, the planets now, the way out to the nearest stars, and what lies past them. */
export async function SolarOverview({ t }: { t: Translate }) {
  const cards = await planetCards();
  const [now, stops] = await Promise.all([spaceNow(cards), placeStops(SOLAR_JOURNEY)]);
  const teaser = DEEP_SKY_TEASER.flatMap(id => deepSkyObject(id) ?? []);
  const deep = localePath(t.locale, '/map/stars-and-galaxies');
  return (
    <div className="mt-6">
      {now && <SpaceFigures t={t} now={now} />}
      <Section title={t('The planets today')} meta={t('Distances from Earth, from NASA JPL Horizons')}>
        <PlanetCards t={t} cards={cards} />
        <p className="mt-6 text-[14px]"><Link href={localePath(t.locale, '/spacecraft')} className={TEXT_LINK}>{t('Every spacecraft, where it is now')}</Link></p>
      </Section>
      <Section title={t('The way out')} meta={t('Measured now where it moves')}>
        <p className="mb-6 max-w-[46rem]">{t('Keep zooming out from the map and the view never stops. These are the first stops, each one where it really is this minute.')}</p>
        <JourneyLadder t={t} stops={stops} />
      </Section>
      <Section title={t('And past the nearest stars')}>
        <p className="mb-6 max-w-[46rem]">{t('The same zoom carries on through the Milky Way to other galaxies. Telescope pictures hang where their objects are, at their true size on the sky: fly to one and it fills the view.')}</p>
        <DeepSkyCards t={t} items={teaser} />
        <p className="mt-6 text-[14px]"><Link href={deep} className={TEXT_LINK}>{t('From the stars to the edge of the universe')}</Link></p>
      </Section>
    </div>
  );
}

/** The stars-and-galaxies page's own part: the way out from the nearest stars, then every other picture by where it is. */
export async function DeepOverview({ t }: { t: Translate }) {
  const stops = await placeStops(DEEP_JOURNEY);
  return (
    <div className="mt-6">
      <Section title={t('The way out')} meta={t('Distances from the Sun')}>
        <p className="mb-6 max-w-[46rem]">{t('From the nearest stars to the oldest light there is. Each picture is the telescope’s own, hung in the 3D view where its object is.')}</p>
        <JourneyLadder t={t} stops={stops} />
      </Section>
      {deepSkyRest().filter(g => g.items.length).map(g => (
        <Section key={g.realm} title={t(REALM_TITLE[g.realm])}>
          <DeepSkyCards t={t} items={g.items} columns="sm:grid-cols-3 lg:grid-cols-4" />
        </Section>
      ))}
    </div>
  );
}
