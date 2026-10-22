import { Activity } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { articleUrl } from '@/lib/core/wikipedia/refs';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placePages } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import { HAZARD_LABEL, type HazardData } from '@/lib/platform/site/places/topics/hazards';
import type { HazardKind } from '@/lib/platform/site/places/topics/hazards-data';
import { hazardDate, hazardLinks, hazardSentences, type HazardEventFact, type HazardFacts } from '@/lib/platform/site/places/topics/hazards-facts';
import type { HazardsNow } from '@/lib/platform/site/places/topics/hazards-now';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const KIND: Record<HazardKind, string> = { q: msg('Earthquake'), t: msg('Tsunami'), v: msg('Eruption') };

/** "M 7.8", "VEI 4", "30 m": each kind by its own measure; "est." where NOAA's magnitude is from accounts, not instruments. */
function measure(e: HazardEventFact, t: Translate): string | null {
  if (e.k === 'q' && e.m !== undefined) {
    const m = new Intl.NumberFormat(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(e.m);
    return e.id.includes(':') && Number(/^-?\d+/.exec(e.d)?.[0]) < 1900 ? t('M {m} (est.)', { m }) : t('M {m}', { m });
  }
  if (e.k === 'v' && e.m !== undefined) return t('VEI {vei}', { vei: e.m });
  if (e.k === 't' && e.here?.h !== undefined) return t('{h} m here', { h: e.here.h });
  if (e.k === 't' && e.h !== undefined) return t('{h} m high', { h: e.h });
  return null;
}

function EventRow({ e, t }: { e: HazardEventFact; t: Translate }) {
  const links = hazardLinks(e);
  const m = measure(e, t);
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6">
      <span className="text-[14px] font-medium text-ink-1 sm:w-44 sm:flex-shrink-0">
        {hazardDate(e.d, t)}
        <span className="block text-[12px] font-normal text-ink-3">{t(KIND[e.k])}{m && <> · <span className="font-mono tabular-nums">{m}</span></>}</span>
      </span>
      <span className="text-[14px] leading-relaxed text-ink-2">
        {[
          e.where,
          e.deaths ? t('{n, plural, one {one death} other {# deaths}} (NOAA)', { n: e.deaths }) : null,
          e.here?.deaths ? t('{n, plural, one {one death} other {# deaths}} here (NOAA)', { n: e.here.deaths }) : null,
        ].filter(Boolean).join(' · ')}
        <span className="block text-[12px] text-ink-3">
          {[
            links.usgs && <a key="u" href={links.usgs} rel="noopener nofollow" target="_blank" className={TEXT_LINK}>USGS</a>,
            links.noaa && <a key="n" href={links.noaa} rel="noopener nofollow" target="_blank" className={TEXT_LINK}>NOAA NCEI</a>,
            e.wiki && <a key="w" href={articleUrl(e.wiki)} rel="noopener" target="_blank" className={TEXT_LINK}>Wikipedia</a>,
          ].filter(Boolean).flatMap((a, i) => (i ? [' · ', a] : [a]))}
        </span>
      </span>
    </li>
  );
}

function notes(f: HazardFacts, place: Place, t: Translate): string[] {
  const name = nameOf(place, t);
  return [
    f.scope === 'city'
      ? t('An event counts for {place} when it began within {km, radius} of its centre, or {bigKm, radius} for an earthquake of magnitude {bigMag} or more. Damage can reach further.', { place: name, km: f.km, bigKm: f.bigKm, bigMag: f.bigMag })
      : f.scope === 'inland' ? t('An event counts for {place} when it began inside its borders. Damage can reach across them.', { place: name }) : t('An event counts for {place} when it began inside its borders, or at sea within {coast, radius} of its coast (so one can count for two neighbours), or further out, up to {far, radius}, where {place} is the nearest country.', { place: name, coast: 100, far: 300 }),
    f.floor >= 6
      ? t('USGS counts here start at magnitude {floor}: the catalogue’s smaller quakes thin out going back, where few instruments listened.', { floor: f.floor })
      : t('USGS counts are its ComCat catalogue’s earthquakes of magnitude {floor} or more, aftershocks included.', { floor: f.floor }),
    t('NOAA lists significant events only: earthquakes that killed, did about $1 million of damage, reached magnitude 7.5 or intensity X, or raised a tsunami, and eruptions and tsunamis by like measures. Magnitudes before 1900 are its estimates from written accounts.'),
    t('Deaths are NOAA’s total for each event, wherever people died, its tsunami and fires included. A tsunami counts the dead its runup records give for this place: NOAA’s total for a tsunami includes its source quake’s.'),
    t('A tsunami from elsewhere counts where one of its runups killed or rose a metre or more.'),
    ...(f.scope === 'city' ? [] : [t('The map frames the box around {place}, its neighbours’ quakes included, so its count runs higher than this page’s.', { place: name })]),
    t('Counted to {date}, as is the map. The last 30 days ask USGS again.', { date: hazardDate(f.asOf, t) }),
  ];
}

export const HAZARDS_VIEW: TopicView<HazardData, HazardsNow> = {
  icon: Activity,

  Live({ text: { t }, place, live: now }) {
    const where = now.km !== undefined
      ? t('within {km, radius} of {place}', { km: now.km, place: nameOf(place, t) })
      : t('in the area the map frames');
    const quake = (q: NonNullable<HazardsNow['latest']>) => t('magnitude {m} on {date} ({where})', {
      m: q.m, where: q.place, date: new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(q.time),
    });
    return (
      <>
        <p>
          {now.n
            ? t('USGS recorded {n, plural, one {one earthquake} other {# earthquakes}} of magnitude {floor} or more {where} in the last {days} days.', { n: now.n, floor: now.floor, where, days: now.days })
            : t('USGS recorded no earthquake of magnitude {floor} or more {where} in the last {days} days.', { floor: now.floor, where, days: now.days })}
        </p>
        {now.latest && (
          <p className="text-[14px] text-ink-2">
            {now.strongest && now.strongest.time !== now.latest.time
              ? t('The latest: {latest}. The strongest: {strongest}.', { latest: quake(now.latest), strongest: quake(now.strongest) })
              : t('The latest: {latest}.', { latest: quake(now.latest) })}
          </p>
        )}
      </>
    );
  },

  Body({ text, place, page: { slug, data: { facts: f } } }) {
    const { t } = text;
    const sentences = hazardSentences(f, nameOf(place, t), t).slice(2);
    // The nav lists one range; the others are a click away here.
    const ranges = placePages(place).filter(p => p.topic.id === 'hazards');
    return (
      <>
        {ranges.length > 1 && (
          <nav aria-label={t('Earthquakes')} className="flex flex-wrap gap-2">
            {ranges.map(r => (
              <Link key={r.page.slug} href={localePath(t.locale, placePath(place, r.page.slug))} aria-current={r.page.slug === slug ? 'page' : undefined}
                className={cx('inline-flex h-8 items-center rounded-control border px-2.5 text-[13px]', FOCUS_RING, TRANSITION,
                  r.page.slug === slug ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line bg-surface-1 text-ink-2 hover:text-ink-1')}>
                {t(HAZARD_LABEL[(r.page.data as HazardData).facts.range])}
              </Link>
            ))}
          </nav>
        )}
        {sentences.length > 0 && (
          <Section title={t('What the record holds')}>
            <p className="text-[15px] leading-relaxed text-ink-2">{sentences.join(' ')}</p>
          </Section>
        )}
        {f.list.length > 0 && (
          <Section title={t('The events')}>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
              {f.list.map(e => <EventRow key={e.id} e={e} t={t} />)}
            </ul>
          </Section>
        )}
        <Notes text={text} notes={notes(f, place, t)} layers={['earthquakes', 'history-map']} />
      </>
    );
  },
};
