import { Bus } from 'lucide-react';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { modesText } from '@/lib/feeds/transit/modes';
import { count, listOf, nameOf } from '@/lib/platform/site/places/copy/format';
import type { TransitNow } from '@/lib/platform/site/places/live/transit-now';
import type { TransitData } from '@/lib/platform/site/places/topics/transit';
import type { OperatorHow, TransitOperator } from '@/lib/platform/site/places/topics/transit-data';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const HOW: Record<OperatorHow, string> = {
  live: msg('Live GPS positions'),
  partly: msg('Live GPS, with some vehicles placed from arrival predictions and marked estimated'),
  estimated: msg('Placed between stops from arrival predictions, and marked estimated'),
  timetable: msg('Run from the timetable and marked scheduled: no live data is published'),
};

function OperatorRow({ t, op }: { t: Translate; op: TransitOperator }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6">
      <span className="text-[14px] font-medium text-ink-1 sm:w-64 sm:flex-shrink-0">
        {op.name}
        {op.modes.length > 0 && <span className="block text-[12px] font-normal text-ink-3">{modesText(op.modes, t)}</span>}
      </span>
      <span className="text-[14px] leading-relaxed text-ink-2">
        {t(HOW[op.how])}
        {op.license && <> · <a href={op.license} rel="noopener nofollow" target="_blank" className={TEXT_LINK}>{t('Data terms')}</a></>}
      </span>
    </li>
  );
}

export const TRANSIT_VIEW: TopicView<TransitData, TransitNow> = {
  nearbySummary: true,
  icon: Bus,

  Live({ text: { t }, place, live: now }) {
    return (
      <>
        <p>
          {now.total
            ? t('{n, plural, one {One vehicle} other {# vehicles}} on the map within about {km, radius} of the centre of {city}: {feeds}.', {
              n: now.total, km: now.km, city: nameOf(place, t), feeds: listOf(now.feeds.map(f => `${f.name} ${count(f.count, t)}`), t),
            })
            : t('No vehicles on the map within about {km, radius} of the centre of {city} right now; services may have stopped for the night.', { km: now.km, city: nameOf(place, t) })}
        </p>
        {(now.estimated > 0 || now.scheduled > 0) && (
          <p className="text-[14px] text-ink-2">
            {[
              now.estimated ? t('{n, plural, one {One is} other {# are}} placed from arrival predictions.', { n: now.estimated }) : '',
              now.scheduled ? t('{n, plural, one {One runs} other {# run}} from the timetable.', { n: now.scheduled }) : '',
            ].filter(Boolean).join(' ')}
          </p>
        )}
        {now.busiest.length > 0 && (
          <p className="text-[14px] text-ink-2">
            {t('Most vehicles out now: {routes}.', { routes: listOf(now.busiest.map(r => t('route {route} ({n})', { route: r.route, n: r.count })), t) })}
          </p>
        )}
        {now.down.length > 0 && <p className="text-[14px] text-ink-3">{t('No answer just now from {feeds}.', { feeds: listOf(now.down, t) })}</p>}
      </>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const ops = data.operators;
    const notes = [
      t('Only operators that publish open data appear. Others running in {city} may be missing.', { city: nameOf(place, t) }),
      ...(ops.some(o => o.how === 'partly' || o.how === 'estimated')
        ? [t('Where a system publishes only arrival predictions, its vehicles are placed between stops from them and marked estimated.')] : []),
      ...(ops.some(o => o.how === 'timetable') ? [t('Where nothing live exists, vehicles run from the timetable and are marked scheduled.')] : []),
      t('Vehicles show from zoom 10, refreshing every 20 seconds while you are zoomed in. Click one for its route, status, speed and operator.'),
    ];
    return (
      <>
        <Section title={t('Who runs it')}>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
            {ops.map(op => <OperatorRow key={op.name} t={t} op={op} />)}
          </ul>
        </Section>
        <Notes text={text} notes={notes} layers={['live-transit', 'traffic']} />
      </>
    );
  },
};
