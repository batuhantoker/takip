import type { Translate } from '@/lib/core/i18n/translator';
import { coordinates, eventWhen, factRows, kindLabel, magnitudeRow, placeName, placement } from '@/lib/platform/site/events/copy';
import type { EventPage } from '@/lib/platform/site/events/event-page';

/** The record as a table: when, what, the count, where, then the facts the source carries; how it was placed under it. */
export function EventFacts({ t, event: e }: { t: Translate; event: EventPage }) {
  const mag = magnitudeRow(t, e, e.attrs.magnitude_range);
  const all = [
    { label: t('When'), value: eventWhen(t, e) },
    { label: t('Kind'), value: kindLabel(t, e.kind) },
    ...(typeof e.attrs.also === 'string' ? [{ label: t('Also recorded as'), value: kindLabel(t, e.attrs.also) }] : []),
    ...(mag ? [mag] : []),
    ...(placeName(e) ? [{ label: t('Where'), value: placeName(e)! }] : []),
    ...(coordinates(e) ? [{ label: t('Coordinates'), value: coordinates(e)! }] : []),
    ...factRows(t, e),
  ];
  // GTD's rows carry their own Where, and a launch's Site repeats it.
  const rows = all.filter((r, i) => all.findIndex(o => o.label === r.label || (o.label === t('Where') && o.value === r.value)) === i);
  const note = placement(t, e);
  return (
    <>
      <dl className="divide-y divide-line rounded-card border border-line bg-surface-1">
        {rows.map(r => (
          <div key={r.label} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:gap-6">
            <dt className="text-[13px] text-ink-3 sm:w-40 sm:flex-shrink-0">{r.label}</dt>
            <dd className="text-[14px] leading-relaxed text-ink-1 [overflow-wrap:anywhere]">{r.value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-[13px] text-ink-3">{note}</p>}
    </>
  );
}
