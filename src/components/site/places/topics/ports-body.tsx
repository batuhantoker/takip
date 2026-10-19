import { Ship } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { SHIP_CLASSES } from '@/lib/feeds/maritime/ship-filter';
import { localePath } from '@/lib/platform/site/locale-path';
import { count, dayOf, listOf, nameOf } from '@/lib/platform/site/places/copy/format';
import { placeById, type Place } from '@/lib/platform/site/places/gazetteer';
import { placePath } from '@/lib/platform/site/places/paths';
import { portLabel, type PortsData } from '@/lib/platform/site/places/topics/ports';
import { PORT_KM, type HarbourSize, type NearPort } from '@/lib/platform/site/places/topics/ports-data';
import { renderSentence, type PortSentence } from '@/lib/platform/site/places/topics/ports-facts';
import type { ShipsNow } from '@/lib/platform/site/places/topics/ports-live';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const SIZE: Record<HarbourSize, string> = {
  large: msg('Large harbour'), medium: msg('Medium-sized harbour'), small: msg('Small harbour'), 'very-small': msg('Very small harbour'),
};

const ABOUT: PortSentence['id'][] = ['rating', 'facilities', 'limits', 'ice', 'vts', 'major-nearby', 'chokepoint-near'];
const SEEING: PortSentence['id'][] = ['ais-dark', 'coverage'];

const shipClass = (type: string, t: Translate) => t(SHIP_CLASSES.find(c => c.type === type)?.label ?? SHIP_CLASSES[SHIP_CLASSES.length - 1].label);

function HarbourRow({ t, place, port }: { t: Translate; place: Place; port: NearPort }) {
  const home = port.home !== place.id ? placeById(port.home) : undefined;
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6">
      <span className="text-[14px] font-medium text-ink-1 sm:w-64 sm:flex-shrink-0">
        {portLabel(port.name, place, t)}
        <span className="block text-[12px] font-normal text-ink-3">{t('{km} km from the centre', { km: Math.max(1, Math.round(port.km)) })}</span>
      </span>
      <span className="text-[14px] leading-relaxed text-ink-2">
        {port.size ? t(SIZE[port.size]) : t('Not rated by the Index')}
        {home && (
          <> · <Link href={localePath(t.locale, placePath(home, 'port'))} className={TEXT_LINK}>{t('counted on the page for {place}', { place: nameOf(home, t) })}</Link></>
        )}
      </span>
    </li>
  );
}

export const PORTS_VIEW: TopicView<PortsData, ShipsNow> = {
  icon: Ship,

  Live({ text: { t }, place, live: now }) {
    return (
      <>
        <p>
          {t('{n, plural, one {One ship} other {# ships}} on the map within {km} km of {port}, {underway, plural, =0 {none of them under way} one {one under way} other {# under way}}.', {
            n: now.total, km: now.km, port: portLabel(now.port, place, t), underway: now.underway,
          })}
        </p>
        <p className="text-[14px] text-ink-2">{listOf(now.types.slice(0, 5).map(([type, n]) => `${shipClass(type, t)} ${count(n, t)}`), t)}</p>
      </>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const { story } = data;
    const city = nameOf(place, t);
    const say = (ids: PortSentence['id'][]) => story.sentences.slice(1).filter(s => ids.includes(s.id)).map(s => renderSentence(s, city, t));
    const about = say(ABOUT), seeing = say(SEEING);
    const harbours = data.ports.filter(p => p.km <= PORT_KM);
    const notes = [
      t('NGA’s World Port Index rates a harbour by its area, facilities and wharf space when it was last surveyed, not by its traffic, so a busy terminal can be rated small. Where it doesn’t know about a facility it says so, and only what it marks as there is listed here.'),
      t('AIS is heard by receivers on shore, so coverage follows where they are: ships far out at sea, or off coasts without one, don’t show. Warships and some others switch it off, and a ship’s type and destination are typed in by its crew.'),
      t('Harbours from NGA’s World Port Index (Pub. 150), downloaded on {day}. The major ports and chokepoints are the map’s own reference list.', { day: dayOf(data.wpi, t) }),
    ];
    return (
      <>
        {about.length > 0 && <Section title={t('The harbour')}><p>{about.join(' ')}</p></Section>}
        {harbours.length > 0 && (
          <Section title={t('Harbours within {km} km', { km: PORT_KM })}>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
              {harbours.map(p => <HarbourRow key={p.wpi} t={t} place={place} port={p} />)}
            </ul>
          </Section>
        )}
        {seeing.length > 0 && <Section title={t('What the live map can see')}><p>{seeing.join(' ')}</p></Section>}
        <Notes text={text} notes={notes} layers={['ship-tracker', 'chokepoints']} />
      </>
    );
  },
};
