/** Whole numbers in English words, for a line whose only number changed since a model last spelled it out. */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function underThousand(n: number) {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ''}`;
  return h ? `${ONES[h]} hundred${r ? ` ${rest}` : ''}` : rest;
}

/** 0 to 999,999, as a narrator reads a count: "three hundred twenty", "two thousand three hundred fifty". */
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1_000_000) throw new Error(`no words for ${n}`);
  if (n < 1000) return underThousand(n);
  const r = n % 1000;
  return `${underThousand(Math.floor(n / 1000))} thousand${r ? ` ${underThousand(r)}` : ''}`;
}

/** A count as a line says it: "1,250" or "1250". */
const NUMBER = (n: number) => new RegExp(`(?<![\\d.,])(${n.toLocaleString('en-US')}|${n})(?![\\d]|[.,]\\d)`);

/**
 * The line with count `from` said as `to`, or null when it doesn't say `from`; `spoken` is its narrator's form when that
 * count is the only thing in it needing words, else undefined (the script step spells it out).
 */
export function retold(line: string, from: number, to: number): { say: string; spoken?: string } | null {
  const m = NUMBER(from).exec(line);
  if (!m) return null;
  const said = m[1].includes(',') ? to.toLocaleString('en-US') : String(to);
  const say = line.slice(0, m.index) + said + line.slice(m.index + m[1].length);
  const rest = line.slice(0, m.index) + line.slice(m.index + m[1].length);
  // anything else a narrator would spell out (another number, an abbreviation) needs the model
  const plain = !/\d|\b(?!TAKIP\b)\p{Lu}{2,}\b/u.test(rest);
  return { say, ...(plain ? { spoken: line.slice(0, m.index) + numberWords(to) + line.slice(m.index + m[1].length) } : {}) };
}
