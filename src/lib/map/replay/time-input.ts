/*
 * Typed times for the replay timeline, back to the atlas's 10,000 BCE. JS dates count years
 * astronomically: year 0 is 1 BCE, so 500 BCE is -499.
 */

export const HISTORY_START = utcYear(-9999);

function utcYear(year: number, month = 0, day = 1, h = 0, min = 0) {
  const d = new Date(0);
  d.setUTCFullYear(year, month, day);
  d.setUTCHours(h, min, 0, 0);
  return d.getTime();
}

/**
 * "1916", "2003-03", "2003-03-20", "2003-03-20 14:30", "500 BCE", "-500" (BCE as well) → epoch ms,
 * or undefined when it isn't a time.
 */
export function parseJump(text: string): number | undefined {
  const s = text.trim();
  const bce = /^(?:-\s*(\d{1,5})|(\d{1,5})\s*(?:BCE|BC|B\.C\.)?)$/i.exec(s);
  if (bce && (bce[1] || /b\.?c/i.test(s))) return utcYear(1 - Number(bce[1] ?? bce[2]));
  const m = /^(\d{1,4})(?:-(\d{1,2})(?:-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?)?)?\s*(?:CE|AD)?$/i.exec(s);
  if (!m) return undefined;
  const [, y, mo = '1', d = '1', h = '0', min = '0'] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23 || Number(min) > 59) return undefined;
  return utcYear(Number(y), Number(mo) - 1, Number(d), Number(h), Number(min));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Seconds when the view spans a day or so, the date when it spans years, the year alone before the common era. */
export function formatTime(t: number, spanMs: number) {
  const d = new Date(t);
  const year = d.getUTCFullYear();
  if (year <= 0) return `${1 - year} BCE`;
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${year}`;
  if (spanMs > 400 * 86_400_000) return date;
  return `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}
