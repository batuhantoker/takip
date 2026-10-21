import type { HolidayEntry, HolidayName, HolidayYear } from './holidays-data';

/**
 * China's days off are set each year by the State Council's notice (国务院办公厅关于…年部分节假日安排的通知), late in
 * the year before: each break's days, and the weekend days worked in exchange. A year without its notice entered
 * here, after the last one that is, shows the statutory days alone (the 2024 revision of 全国年节及纪念日放假办法);
 * an earlier one has no page. Add each notice when it is published.
 */
const NOTICES: Record<number, { off: [string, string, string][]; work: [string, string][] }> = {
  // Published 4 November 2025.
  2026: {
    off: [
      ['元旦', '2026-01-01', '2026-01-03'], ['春节', '2026-02-15', '2026-02-23'], ['清明节', '2026-04-04', '2026-04-06'], ['劳动节', '2026-05-01', '2026-05-05'],
      ['端午节', '2026-06-19', '2026-06-21'], ['中秋节', '2026-09-25', '2026-09-27'], ['国庆节', '2026-10-01', '2026-10-07'],
    ],
    work: [['元旦', '2026-01-04'], ['春节', '2026-02-14'], ['春节', '2026-02-28'], ['劳动节', '2026-05-09'], ['国庆节', '2026-09-20'], ['国庆节', '2026-10-10']],
  },
};

const LAST_NOTICE = Math.max(...Object.keys(NOTICES).map(Number));

const EN: Record<string, string> = {
  元旦: "New Year's Day", 春节: 'Spring Festival', 清明节: 'Qingming Festival', 劳动节: 'Labour Day', 端午节: 'Dragon Boat Festival', 中秋节: 'Mid-Autumn Festival', 国庆节: 'National Day',
};
const name = (zh: string): HolidayName => ({ local: zh, zh, en: EN[zh] });
const span = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

/** Whether China has a page for the year, and whether it waits for its notice; no rules needed. */
export const chinaYear = (year: number): 'notice' | 'pending' | null => (NOTICES[year] ? 'notice' : year > LAST_NOTICE ? 'pending' : null);

/** The year's days, given the lunar festivals' first days from the rules (除夕 for 春节). */
export function chinaDays(year: number, lunar: () => { 春节?: string; 清明?: string; 端午?: string; 中秋?: string }): HolidayYear | null {
  const notice = NOTICES[year];
  const sort = (days: HolidayEntry[]) => days.sort((a, b) => a.d.localeCompare(b.d));
  if (notice) {
    return {
      days: sort([
        ...notice.off.map(([zh, a, b]): HolidayEntry => ({ d: a, n: span(a, b), t: 'p', name: name(zh) })),
        ...notice.work.map(([zh, d]): HolidayEntry => ({ d, t: 'w', name: name(zh) })),
      ]),
    };
  }
  if (year <= LAST_NOTICE) return null;
  const l = lunar();
  if (!l.春节 || !l.清明 || !l.端午 || !l.中秋) return null;
  return {
    pending: 1,
    days: sort([
      { d: `${year}-01-01`, t: 'p', name: name('元旦') }, { d: l.春节, n: 4, t: 'p', name: name('春节') }, { d: l.清明, t: 'p', name: name('清明节') },
      { d: `${year}-05-01`, n: 2, t: 'p', name: name('劳动节') }, { d: l.端午, t: 'p', name: name('端午节') }, { d: l.中秋, t: 'p', name: name('中秋节') },
      { d: `${year}-10-01`, n: 3, t: 'p', name: name('国庆节') },
    ]),
  };
}
