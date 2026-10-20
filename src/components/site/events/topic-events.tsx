import type { Translate } from '@/lib/core/i18n/translator';
import type { TopicEvents as Events } from '@/lib/platform/site/events/topic-events';
import { EventList } from './parts/event-list';

/** What the measure means for the "largest" list, by History family. */
function largestTitle(t: Translate, family: string): string | null {
  if (family === 'conflict' || family === 'terror' || family === 'politics' || family === 'crime') return t('The deadliest recorded here');
  if (family === 'hazard') return t('The strongest recorded here');
  if (family === 'nuclear') return t('The largest yields');
  if (family === 'disaster') return t('The most places hit');
  if (family === 'slavery') return t('The voyages with the most people embarked');
  return null;
}

/** A History topic page's own events, leading to their pages. */
export function TopicEvents({ t, events }: { t: Translate; events: Events }) {
  const largest = events.largest.length >= 3 ? largestTitle(t, events.largest[0].family) : null;
  return (
    <section className="mt-20 grid gap-12 lg:grid-cols-2 lg:gap-16">
      {largest && (
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{largest}</h2>
          <div className="mt-5"><EventList t={t} events={events.largest} /></div>
        </div>
      )}
      {events.periods.length > 0 && (
        <div className={largest ? undefined : 'lg:col-span-2'}>
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">
            {events.step === 'century' ? t('The first recorded here in each century') : t('The first recorded here in each decade')}
          </h2>
          <div className="mt-5"><EventList t={t} events={events.periods} columns={!largest} /></div>
        </div>
      )}
    </section>
  );
}
