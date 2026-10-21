import { cx } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { holidayName } from '@/lib/platform/site/places/topics/holidays-copy';
import type { HolidayRow, HolidayYear } from '@/lib/platform/site/places/topics/holidays-data';
import { addDays, isoDay } from '@/lib/platform/site/places/topics/holidays-rules';

type Mark = 'holiday' | 'half' | 'regional' | 'worked';
const RANK: Record<Mark, number> = { holiday: 4, half: 3, regional: 2, worked: 1 };

const CELL: Record<Mark, string> = {
  holiday: 'bg-accent text-on-accent font-semibold',
  half: 'bg-accent-soft text-ink-1 font-semibold',
  regional: 'text-ink-1 underline decoration-accent decoration-2 underline-offset-2',
  worked: 'text-ink-1 ring-1 ring-amber ring-inset',
};

const SWATCH: Record<Mark, string> = { holiday: 'bg-accent', half: 'bg-accent-soft', regional: 'border-b-2 border-accent bg-surface-2', worked: 'ring-1 ring-amber ring-inset' };

/** The year at a glance: every month, its holidays filled, half days and regional ones lighter, weekends dimmed, today ringed. */
export function HolidayCalendar({ row, year, data, today, t }: { row: HolidayRow; year: number; data: HolidayYear; today: string; t: Translate }) {
  const marks = new Map<string, { mark: Mark; names: string[] }>();
  for (const e of data.days) {
    const mark: Mark | null = e.t === 'w' ? 'worked' : e.t !== 'p' ? null : e.r ? 'regional' : e.from ? 'half' : 'holiday';
    if (!mark) continue;
    for (let i = 0; i < (e.n ?? 1); i++) {
      const d = addDays(e.d, i);
      const held = marks.get(d);
      const name = holidayName(e.name, t);
      if (!held) marks.set(d, { mark, names: [name] });
      else {
        if (!held.names.includes(name)) held.names.push(name);
        if (RANK[mark] > RANK[held.mark]) held.mark = mark;
      }
    }
  }
  const loc = new Intl.Locale(`und-${row.cc}`) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
  const first = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay ?? 1;
  const intl = t.locale === 'en' ? 'en-GB' : t.intl;
  const monthName = new Intl.DateTimeFormat(intl, { month: 'long', timeZone: 'UTC' });
  const dayLetter = new Intl.DateTimeFormat(intl, { weekday: 'narrow', timeZone: 'UTC' });
  // 2024-01-01 was a Monday.
  const heads = [...Array(7).keys()].map(i => ((first - 1 + i) % 7) + 1);
  const weekend = new Set(row.weekend);
  const used = new Set([...marks.values()].map(m => m.mark));
  const legend: [Mark, string][] = [
    ['holiday', t('Holiday')], ['half', t('Half day')], ['regional', t('Some regions only')], ['worked', t('Weekend day worked')],
  ];

  return (
    <figure className="rounded-card border border-line bg-surface-1 p-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
        {[...Array(12).keys()].map(m => {
          const start = `${year}-${String(m + 1).padStart(2, '0')}-01`;
          const lead = (isoDay(start) - first + 7) % 7;
          const days: string[] = [];
          for (let d = start; d.slice(5, 7) === start.slice(5, 7); d = addDays(d, 1)) days.push(d);
          return (
            <div key={m}>
              <p className="text-[12px] font-medium text-ink-2">{monthName.format(Date.parse(`${start}T12:00:00Z`))}</p>
              <div className="mt-1 grid grid-cols-7 text-center text-[10px] leading-[18px] tabular-nums">
                {heads.map(h => <span key={h} className="text-ink-4" aria-hidden>{dayLetter.format(Date.parse(`2024-01-0${h}T12:00:00Z`))}</span>)}
                {[...Array(lead).keys()].map(i => <span key={`x${i}`} aria-hidden />)}
                {days.map(d => {
                  const held = marks.get(d);
                  const now = d === today;
                  return (
                    <span key={d} title={[...(now ? [t('Today')] : []), ...(held?.names ?? [])].join(', ') || undefined} aria-current={now ? 'date' : undefined}
                      className={cx('rounded-[3px]', held ? CELL[held.mark] : now ? 'font-semibold text-ink-1' : weekend.has(isoDay(d)) ? 'text-ink-4' : 'text-ink-3', now && 'ring-2 ring-ink-1 ring-inset')}>
                      {Number(d.slice(8))}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        {today.startsWith(`${year}-`) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-[3px] ring-2 ring-ink-1 ring-inset" aria-hidden />{t('Today')}
          </span>
        )}
        {legend.filter(([m]) => used.has(m)).map(([m, label]) => (
          <span key={m} className="inline-flex items-center gap-1.5">
            <span className={cx('inline-block size-3 rounded-[3px]', SWATCH[m])} aria-hidden />{label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
