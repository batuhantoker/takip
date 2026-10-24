import type { Translate } from '@/lib/core/i18n/translator';
import { flightDate, stepText } from '@/lib/platform/site/space/copy';
import type { FlightSummary } from '@/lib/platform/site/space/flights';

/** The flight from JPL's trajectory, oldest first; steps after the trajectory was fetched are JPL's prediction. */
export function FlightTimeline({ t, flight }: { t: Translate; flight: FlightSummary }) {
  return (
    <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
      {flight.steps.map((s, i) => {
        const expected = s.jd > flight.fetchedJd;
        return (
          <li key={`${s.kind}-${s.jd}-${i}`} className="relative">
            <span aria-hidden className={`absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-surface-0 ${expected ? 'bg-ink-4' : 'bg-accent'}`} />
            <p className="text-[13px] text-ink-3">
              {flightDate(t, s.jd)}{expected && ` · ${t('expected')}`}
            </p>
            <p className="text-[15px] leading-relaxed text-ink-1">{stepText(t, s)}</p>
          </li>
        );
      })}
    </ol>
  );
}
