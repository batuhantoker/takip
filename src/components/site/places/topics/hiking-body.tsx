import { Footprints } from 'lucide-react';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, dayOf, nameOf } from '@/lib/platform/site/places/copy/format';
import type { HikingData } from '@/lib/platform/site/places/topics/hiking';
import { HIKING_SOURCE, routeLink } from '@/lib/platform/site/places/topics/hiking-data';
import { kmText, renderHikingSentence, routeName, type ListedRoute } from '@/lib/platform/site/places/topics/hiking-facts';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

// The same English as the map's route popup (feeds/hiking/api.ts), so they share translations.
const NETWORK: Record<string, string> = {
  INT: msg('International'), NAT: msg('National'), REG: msg('Regional'), LOC: msg('Local'),
  AL1: msg('Hiking trail'), AL2: msg('Mountain trail'), AL3: msg('Demanding mountain trail'), AL4: msg('Alpine trail'),
};

function RouteRow({ t, route, r }: { t: Translate; route: ListedRoute; r: number }) {
  const network = NETWORK[route.net] ? t(NETWORK[route.net]) : route.net;
  const whole = !!route.km && route.km > route.kmIn * 1.1;
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
      <span className="text-[14px] font-medium text-ink-1 sm:w-72 sm:flex-shrink-0">
        <a href={routeLink(route.id)} rel="noopener nofollow" target="_blank" className={TEXT_LINK}>{routeName(route, route.id)}</a>
        <span className="block text-[12px] font-normal text-ink-3">
          {route.ref && route.name ? `${network} · ${route.ref}` : network}
          {route.stages ? ` · ${t('{n} sections', { n: route.stages })}` : ''}
        </span>
      </span>
      <span className="text-[14px] leading-relaxed text-ink-2">
        {t('{km, distance} within {r, radius}', { km: route.kmIn, r })}
        {whole && <> · {t('{km} in all', { km: kmText(route, t) })}</>}
        {route.from && route.to && <> · {t('{from} to {to}', { from: route.from, to: route.to })}</>}
        {route.operator && <span className="block text-[12px] text-ink-3">{route.operator}</span>}
      </span>
    </li>
  );
}

export const HIKING_VIEW: TopicView<HikingData> = {
  icon: Footprints,
  figures: ({ text: { t }, page: { data } }) => (data.story.facts.total ? [{ value: count(data.story.facts.total, t), label: t('waymarked hiking routes') }] : []),

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const { story, counted } = data;
    const f = story.facts;
    const city = nameOf(place, t);
    const more = story.sentences.slice(1).map(s => renderHikingSentence(s, city, t));
    const notes = [
      t('Routes from {source}, which draws the hiking routes mapped on OpenStreetMap (data © {data}, {license}); counted on {day}.', {
        source: HIKING_SOURCE.name, data: HIKING_SOURCE.data, license: HIKING_SOURCE.license, day: dayOf(counted, t),
      }),
      t('Only routes someone has mapped as a route on OpenStreetMap are counted. Signposted paths no one has mapped, and walks without waymarks, are not.'),
      ...(f.capped ? [t('Waymarked Trails lists at most 100 routes for an area at once, and parts of this one hold more, so local routes late in the alphabet are missing from the counts and the list.')] : []),
      t('Lengths within {r, radius} are measured on Waymarked Trails’ simplified lines and take in a route’s branches and variants; a path two routes share counts for each. A route’s length in all follows its main line along the mapped ways, and those marked “about” come from the simplified lines.', { r: f.r }),
    ];
    return (
      <>
        {more.length > 0 && <Section title={t('Around {city}', { city })}><p>{more.join(' ')}</p></Section>}
        {f.routes.length > 0 && (
          <Section title={t('The routes with most of their length within {r, radius}', { r: f.r })}>
            <ul className="divide-y divide-line border-y border-line">
              {f.routes.map(route => <RouteRow key={route.id} t={t} route={route} r={f.r} />)}
            </ul>
            <p className="mt-3 text-[13px] text-ink-3">
              {t('Each name opens the route on {source}.', { source: HIKING_SOURCE.name })}
            </p>
          </Section>
        )}
        <Notes text={text} notes={notes} layers={['hiking-trails']} />
      </>
    );
  },
};
