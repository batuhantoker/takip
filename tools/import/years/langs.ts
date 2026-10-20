/* What differs between Wikipedias' year pages: titles, the events heading, how a bullet states its date. */

/** A page's place in time: the year it covers, or the first year of the decade or century it covers. */
export type PageTime = { year: number; span: 'year' | 'decade' | 'century'; country?: string; portal?: { month: number; day: number } };

export type Lang = {
  code: string;
  /** Matches the heading of the events section (after `headingKey`). */
  events: RegExp;
  /** Births and deaths headings: a page with no events heading but these (laid out by region) has its events before them. */
  stop: RegExp;
  /** Month names by month (0-based), every inflection the pages use. */
  months: string[][];
  /** Classifies a page title; null for anything that isn't a year, decade or country-year page. */
  page: (title: string) => PageTime | null;
  /** Leading day-and-month expressions: `m` names a month (see `monthRe`), `d` a day number. */
  date: RegExp[];
  /** Words that make a bullet's date approximate. */
  approx: RegExp;
  /** Titles of date articles to drop from a bullet's links ("July 14", "14 Temmuz", "1683 год"). */
  dateLink: RegExp;
  /** A link is where something happened when the text before it ends like this ("… killed in [[X]]")… */
  locBefore: RegExp;
  /** …or the text after it starts like this (Turkish "[[İstanbul]]'da", Japanese "[[江戸]]で"). */
  locAfter?: RegExp;
  /** A bullet opening with a link followed by this is set there (French "[[Dresde]] : …"). */
  locLead?: RegExp;
};

/** Astronomical year from a BCE year number (1 BCE = 0). */
const bce = (n: number) => 1 - n;
/** A year of the common era; there is no year 0 in it. */
const ad = (n: number): PageTime | null => (n >= 1 ? { year: n, span: 'year' } : null);
const num = (s: string) => Number(toAscii(s));

/** Persian and Arabic-Indic digits as ASCII. */
export const toAscii = (s: string) => s.replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));

const ordinalCentury = (s: string) => Number(s.match(/^(\d+)/)?.[1] ?? NaN);

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => [m, m.slice(0, 3) + '.']);

/** "{m}" and "{d}" placeholders in date patterns; `{s}` is the separator after the date. */
const re = (src: string, months: string[][], flags = 'iu') =>
  new RegExp(
    `^${src
      .replace(/\{m\}/g, `(?<m>${months.flat().sort((a, b) => b.length - a.length).map(esc).join('|')})`)
      .replace(/\{m2\}/g, `(?<m2>${months.flat().sort((a, b) => b.length - a.length).map(esc).join('|')})`)
      .replace(/\{d\}/g, '(?<d>[0-9۰-۹٠-٩]{1,2})')
      .replace(/\{d2\}/g, '(?<d2>[0-9۰-۹٠-٩]{1,2})')
      .replace(/\{s\}/g, String.raw`(?:\s*(?:[–—―-]+|:|,|：|－|−)\s*|\.\s+|\s*$)`)
      .replace(/\{r\}/g, String.raw`\s*(?:[–—―-]|/|to|until|bis|au|al|à|a|y|до|по|و|تا|至|～|〜|から)\s*`)}`,
    flags,
  );
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** English: "January 5 –", "January 5–7 –", "January 5 – February 2:", and day-first on country pages. */
const en: Lang = {
  code: 'en',
  events: /^(?:events|events and trends|global events|events by place)$/i,
  stop: /^(?:births|deaths|births and deaths)$/i,
  months: EN_MONTHS,
  page: title => {
    // "1453 events" is the dated list where "1453" is written as an article.
    const t = title.replace(/^((?:AD )?\d{1,4}(?: BC)?) events$/, '$1');
    let m = t.match(/^Portal:Current events\/(\d{4}) ([A-Z][a-z]+) (\d{1,2})$/);
    if (m) {
      const month = EN_MONTHS.findIndex(x => x[0] === m![2]);
      return month < 0 ? null : { year: Number(m[1]), span: 'year', portal: { month, day: Number(m[3]) } };
    }
    if ((m = t.match(/^(?:AD )?([1-9]\d{0,3})(?: \(year\))?$/))) return ad(Number(m[1]));
    if ((m = t.match(/^(\d{1,5}) BC$/))) return { year: bce(Number(m[1])), span: 'year' };
    if ((m = t.match(/^(?:AD )?(\d{1,4})0s(?: \(decade\))?$/))) return { year: Number(m[1]) * 10, span: 'decade' };
    // "750s BC" runs 759–750 BC: its first year is the larger number.
    if ((m = t.match(/^(\d{1,4})0s BC(?: \(decade\))?$/))) return { year: bce(Number(m[1]) * 10 + 9), span: 'decade' };
    if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th) century( BC)?$/))) {
      const c = ordinalCentury(m[1]);
      return { year: m[2] ? bce(c * 100) : (c - 1) * 100 + 1, span: 'century' };
    }
    if ((m = t.match(/^(\d{3,4}) in (.+)$/))) return { year: Number(m[1]), span: 'year', country: m[2] };
    return null;
  },
  date: [
    re(String.raw`{m}\s+{d}(?:{r}(?:{m2}\s+)?{d2})?(?:,?\s*\d{3,4})?{s}`, EN_MONTHS),
    re(String.raw`{d}(?:st|nd|rd|th)?(?:\s+{m})?(?:{r}{d2}(?:st|nd|rd|th)?)?\s+(?:of\s+)?{m2}(?:,?\s*\d{3,4})?{s}`, EN_MONTHS),
    re(String.raw`(?:(?:early|mid|late|end of|beginning of)[\s-]+)?{m}(?:{r}{m2})?{s}`, EN_MONTHS),
    // Century pages: "(November 12): Antiochus issues a decree", "(June) Flamininus defeats Philip V".
    re(String.raw`\({m}\s+{d}\)\s*:?\s*`, EN_MONTHS),
    re(String.raw`\({m}\)\s*:?\s*`, EN_MONTHS),
  ],
  approx: /^(?:c\.|ca\.|circa)\s|\((?:approximate|approx\.|traditional|possible|probable|uncertain|estimated|c\.)(?: date)?\)/i,
  locBefore: /(?:^|[\s(])(?:in|at|near|outside|off|on|around|nearby|inside)\s+(?:the\s+)?$/i,
  dateLink: /^(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)(?: \d{1,2})?|\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December)|(?:AD )?\d{1,4}(?: BC| \(year\))?|\d{1,4}0s(?: BC)?(?: \(decade\))?|\d{1,2}(?:st|nd|rd|th) (?:century|millennium)(?: BC)?)$/,
};

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'].map(m => [m]);
const tr: Lang = {
  code: 'tr',
  events: /^olaylar$/i,
  stop: /^(?:doğumlar|ölümler)$/i,
  months: TR_MONTHS,
  page: t => {
    let m = t.match(/^([1-9]\d{0,3})$/);
    if (m) return ad(Number(m[1]));
    if ((m = t.match(/^MÖ (\d{1,4})$/))) return { year: bce(Number(m[1])), span: 'year' };
    return null;
  },
  date: [
    re(String.raw`{d}(?:\s+{m})?(?:{r}{d2})?\s+{m2}{s}`, TR_MONTHS),
    re(String.raw`{m}(?:{r}{m2})?{s}`, TR_MONTHS),
  ],
  approx: /^(?:ca\.|c\.)\s|\((?:yaklaşık|tahmini|olası)(?: tarih)?\)/iu,
  locBefore: /(?:^|\s)(?:yakınlarındaki|yakınında)\s+$/iu,
  locAfter: /^(?:['’]?n?[dt][ae](?:ki)?(?![\p{L}])|\s+(?:yakınlarında|yakınında|civarında|açıklarında|önlerinde|kentinde|şehrinde|köyünde|ilinde|ilçesinde|bölgesinde|adasında|limanında)(?![\p{L}]))/u,
  dateLink: /^(?:\d{1,2} (?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)|(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)|(?:MÖ )?\d{1,4}|(?:MÖ )?\d{1,4}'?(?:ler|lar)|\d{1,2}\. yüzyıl)$/u,
};

const DE_MONTHS = [['Januar', 'Jänner'], ['Februar', 'Feber'], ['März'], ['April'], ['Mai'], ['Juni'], ['Juli'], ['August'], ['September'], ['Oktober'], ['November'], ['Dezember']];
/** German: "3. Mai:", "3./4. Mai:", "3. bis 5. Mai:", "30. April bis 2. Mai:", "Mai:". */
const de: Lang = {
  code: 'de',
  events: /^ereignisse$/i,
  stop: /^(?:geboren|gestorben)$/i,
  months: DE_MONTHS,
  page: t => {
    let m = t.match(/^([1-9]\d{0,3})$/);
    if (m) return ad(Number(m[1]));
    if ((m = t.match(/^(\d{1,4}) v\. Chr\.$/))) return { year: bce(Number(m[1])), span: 'year' };
    if ((m = t.match(/^(\d{1,3})0er( v\. Chr\.)?$/))) return { year: m[2] ? bce(Number(m[1]) * 10 + 9) : Number(m[1]) * 10, span: 'decade' };
    return null;
  },
  date: [
    re(String.raw`(?:um\s+(?:den\s+)?)?{d}\.(?:\s+{m})?(?:\s*(?:/|–|-|bis|und)\s*{d2}\.)?\s+{m2}{s}`, DE_MONTHS),
    re(String.raw`(?:(?:Anfang|Mitte|Ende)\s+)?{m}(?:\s*(?:/|–|-|bis)\s*{m2})?{s}`, DE_MONTHS),
  ],
  approx: /^(?:um|ca\.)\s|\((?:ungefähres Datum|ungefähr|vermutlich|ca\.)\)/iu,
  locBefore: /(?:^|\s)(?:in|im|bei|beim|nahe|vor|am|an der|auf|nahe bei|nördlich von|südlich von|östlich von|westlich von)\s+(?:der\s+|dem\s+|den\s+)?$/iu,
  dateLink: /^(?:\d{1,2}\. (?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)|(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)|\d{1,4}(?: v\. Chr\.)?|\d{1,3}0er(?: v\. Chr\.)?|\d{1,2}\. Jahrhundert(?: v\. Chr\.)?)$/u,
};

const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].map(m => [m]);
/** French: "1er janvier :", "7 mai :", "7-9 mai :", "nuit du 3 au 4 mai :", with an optional ", Place :" before the colon. */
const fr: Lang = {
  code: 'fr',
  events: /^(?:événements|évènements)$/i,
  stop: /^(?:naissances|décès)$/i,
  months: FR_MONTHS,
  page: t => {
    let m = t.match(/^([1-9]\d{0,3})$/);
    if (m) return ad(Number(m[1]));
    if ((m = t.match(/^(\d{1,4}) av\. J\.-C\.$/))) return { year: bce(Number(m[1])), span: 'year' };
    if ((m = t.match(/^(\d{3,4}) en (.+)$/))) return { year: Number(m[1]), span: 'year', country: m[2] };
    return null;
  },
  date: [
    re(String.raw`(?:(?:le|la nuit du|nuit du|du|vers le)\s+)?{d}(?:er)?(?:\s+{m})?(?:{r}{d2}(?:er)?)?\s+{m2}(?:\s+\d{3,4})?{s}`, FR_MONTHS),
    re(String.raw`(?:(?:début|mi|fin|en)[\s-]+)?{m}(?:{r}{m2})?{s}`, FR_MONTHS),
  ],
  approx: /^(?:vers|v\.|c\.|circa)\s|\((?:date approximative|date incertaine|vers|environ)\)/iu,
  locBefore: /(?:^|\s)(?:à|en|au|aux|dans|près de|près d['’]|devant)\s*(?:la\s+|le\s+|les\s+|l['’])?$/iu,
  locLead: /^\s*:/u,
  dateLink: /^(?:\d{1,2}(?:er)? (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)|(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) \d{1,4}|-?\d{1,4}(?: av\. J\.-C\.)?|\d{1,4} en .+|[IVXL]+e siècle(?: av\. J\.-C\.)?)$/iu,
};

const RU_MONTHS = [
  ['января', 'январь'], ['февраля', 'февраль'], ['марта', 'март'], ['апреля', 'апрель'], ['мая', 'май'], ['июня', 'июнь'],
  ['июля', 'июль'], ['августа', 'август'], ['сентября', 'сентябрь'], ['октября', 'октябрь'], ['ноября', 'ноябрь'], ['декабря', 'декабрь'],
];
const ru: Lang = {
  code: 'ru',
  events: /^события$/i,
  stop: /^(?:родились|скончались|умерли)$/i,
  months: RU_MONTHS,
  page: t => {
    let m = t.match(/^([1-9]\d{0,3}) год$/);
    if (m) return ad(Number(m[1]));
    if ((m = t.match(/^(\d{1,4}) год до н\. ?э\.$/))) return { year: bce(Number(m[1])), span: 'year' };
    return null;
  },
  date: [
    re(String.raw`{d}(?:\s+{m})?(?:{r}{d2})?\s+{m2}{s}`, RU_MONTHS),
    re(String.raw`(?:(?:в|начало|середина|конец)\s+)?{m}(?:{r}{m2})?{s}`, RU_MONTHS),
  ],
  approx: /^(?:около|ок\.)\s|\((?:приблизительная дата|приблизительно|предположительно|ок\.)\)/iu,
  locBefore: /(?:^|\s)(?:в|во|на|под|у|близ|около|возле|недалеко от)\s+$/iu,
  dateLink: /^(?:\d{1,2} (?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|(?:январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)(?: \d{1,4} года)?|\d{1,4} год(?: до н\. ?э\.)?|\d{1,4}-е(?: годы)?(?: до н\. ?э\.)?|[IVXL]+ век(?: до н\. ?э\.)?)$/iu,
};

const ES_MONTHS = [['enero'], ['febrero'], ['marzo'], ['abril'], ['mayo'], ['junio'], ['julio'], ['agosto'], ['septiembre', 'setiembre'], ['octubre'], ['noviembre'], ['diciembre']];
const es: Lang = {
  code: 'es',
  events: /^acontecimientos$/i,
  stop: /^(?:nacimientos|fallecimientos)$/i,
  months: ES_MONTHS,
  page: t => {
    let m = t.match(/^([1-9]\d{0,3})$/);
    if (m) return ad(Number(m[1]));
    if ((m = t.match(/^(\d{1,4}) a\. ?C\.$/))) return { year: bce(Number(m[1])), span: 'year' };
    return null;
  },
  date: [
    re(String.raw`{d}(?:\s+de\s+{m})?(?:{r}{d2})?\s+de\s+{m2}(?:\s+de\s+\d{3,4})?{s}`, ES_MONTHS),
    re(String.raw`(?:(?:a\s+)?(?:principios|mediados|finales)\s+de\s+)?{m}(?:{r}{m2})?{s}`, ES_MONTHS),
  ],
  approx: /^(?:hacia|circa|c\.|ca\.)\s|\((?:fecha aproximada|aproximadamente|fecha incierta)\)/iu,
  locBefore: /(?:^|\s)(?:en|cerca de|junto a|frente a)\s+(?:la\s+|el\s+|los\s+|las\s+)?$/iu,
  dateLink: /^(?:\d{1,2} de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)|(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?: de \d{1,4})?|\d{1,4}(?: a\. ?C\.)?|años \d{1,4}|siglo [IVXL]+(?: a\. ?C\.)?)$/iu,
};

const AR_MONTHS = [
  ['يناير', 'كانون الثاني'], ['فبراير', 'شباط'], ['مارس', 'آذار'], ['أبريل', 'إبريل', 'نيسان'], ['مايو', 'أيار'], ['يونيو', 'حزيران'],
  ['يوليو', 'تموز'], ['أغسطس', 'آب'], ['سبتمبر', 'أيلول'], ['أكتوبر', 'تشرين الأول'], ['نوفمبر', 'تشرين الثاني'], ['ديسمبر', 'كانون الأول'],
];
const ar: Lang = {
  code: 'ar',
  events: /^(?:أحداث|الأحداث)$/u,
  stop: /^(?:مواليد|وفيات)$/u,
  months: AR_MONTHS,
  page: t => {
    let m = t.match(/^([0-9٠-٩]{1,4})$/);
    if (m) return ad(num(m[1]));
    if ((m = t.match(/^([0-9٠-٩]{1,4}) ق\.? ?م$/))) return { year: bce(num(m[1])), span: 'year' };
    return null;
  },
  date: [
    re(String.raw`{d}(?:\s+{m})?(?:\s*(?:[–—-]|و|إلى)\s*{d2})?\s+{m2}{s}`, AR_MONTHS),
    re(String.raw`{m}{s}`, AR_MONTHS),
  ],
  approx: /^(?:حوالي|حوالى)\s(?=[0-9٠-٩]{3,4}\b)|\((?:تاريخ تقريبي|تقريبا|تقريباً)\)/u,
  locBefore: /(?:^|\s)(?:في|قرب|بالقرب من|عند|داخل)\s*$/u,
  dateLink: /^(?:[0-9٠-٩]{1,2} (?:يناير|فبراير|مارس|أبريل|إبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)|(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)|[0-9٠-٩]{1,4}(?: ق\.? ?م)?|عقد [0-9٠-٩]+.*|القرن .+)$/u,
};

const FA_MONTHS = [
  ['ژانویه', 'ژانویهٔ'], ['فوریه', 'فوریهٔ'], ['مارس'], ['آوریل'], ['مه', 'می', 'مهٔ'], ['ژوئن'], ['ژوئیه', 'ژوئیهٔ', 'جولای'], ['اوت', 'آگوست'],
  ['سپتامبر'], ['اکتبر'], ['نوامبر'], ['دسامبر'],
];
const fa: Lang = {
  code: 'fa',
  events: /^رویدادها$/u,
  stop: /^(?:زادروزها|مرگ‌ها|مرگها|درگذشتگان|زادگان)$/u,
  months: FA_MONTHS,
  page: t => {
    // Gregorian years up to 1500 collide with Solar Hijri ones and carry "(میلادی)"; later ones are bare.
    let m = t.match(/^([۰-۹0-9]{1,4}) \(میلادی\)$/);
    if (m) return ad(num(m[1]));
    if ((m = t.match(/^([۰-۹0-9]{4})$/)) && num(m[1]) > 1500) return { year: num(m[1]), span: 'year' };
    if ((m = t.match(/^([۰-۹0-9]{1,4}) (?:\(پیش از میلاد\)|پیش از میلاد)$/))) return { year: bce(num(m[1])), span: 'year' };
    return null;
  },
  date: [
    re(String.raw`{d}(?:\s+{m})?(?:{r}{d2})?\s+{m2}{s}`, FA_MONTHS),
    re(String.raw`{m}{s}`, FA_MONTHS),
  ],
  approx: /^(?:حدود)\s(?=[۰-۹0-9]{3,4})|\((?:تاریخ تقریبی|تقریبی|تقریباً)\)/u,
  locBefore: /(?:^|\s)(?:در|نزدیک|نزدیکی)\s*$/u,
  dateLink: /^(?:[۰-۹0-9]{1,2} (?:ژانویه|فوریه|مارس|آوریل|مه|می|ژوئن|ژوئیه|اوت|سپتامبر|اکتبر|نوامبر|دسامبر)|[۰-۹0-9]{1,4}(?: \(میلادی\)| پیش از میلاد)?|سده .+|دهه .+)$/u,
};

const CJK_MONTHS = Array.from({ length: 12 }, (_, i) => [`${i + 1}月`]);
const cjkDate = [
  re(String.raw`(?<m>1[0-2]|[1-9])月(?<d>[1-3]?[0-9])日(?:\s*(?:[–—-]|至|～|〜|から)\s*(?:(?<m2>1[0-2]|[1-9])月)?(?<d2>[1-3]?[0-9])日)?(?:\s*[（(][^）)]*[）)])?{s}`, CJK_MONTHS),
  re(String.raw`(?<m>1[0-2]|[1-9])月(?:\s*(?:[–—-]|至|～|〜)\s*(?<m2>1[0-2]|[1-9])月)?(?:\s*[（(][^）)]*[）)])?{s}`, CJK_MONTHS),
];
const zh: Lang = {
  code: 'zh',
  events: /^(?:大事记|大事紀|大事記|大事纪|事件)$/u,
  stop: /^(?:出生|逝世)$/u,
  months: CJK_MONTHS,
  page: t => {
    let m = t.match(/^([1-9]\d{0,3})年$/);
    if (m) return ad(Number(m[1]));
    if ((m = t.match(/^前(\d{1,4})年$/))) return { year: bce(Number(m[1])), span: 'year' };
    return null;
  },
  date: cjkDate,
  approx: /^(?:约|約|大约|大約)(?=前?\d{1,4}年)|[（(](?:约|約|大约|大約|推测|推測)[）)]/u,
  locBefore: /(?:在|于|於)$/u,
  dateLink: /^(?:(?:1[0-2]|[1-9])月(?:[1-3]?[0-9]日)?|前?\d{1,4}年(?:代)?|前?\d{1,2}世[纪紀])$/u,
};

const ja: Lang = {
  code: 'ja',
  events: /^(?:できごと|出来事)$/u,
  stop: /^(?:誕生|死去)$/u,
  months: CJK_MONTHS,
  page: t => {
    let m = t.match(/^([1-9]\d{0,3})年$/);
    if (m) return ad(Number(m[1]));
    if ((m = t.match(/^紀元前(\d{1,4})年$/))) return { year: bce(Number(m[1])), span: 'year' };
    return null;
  },
  date: cjkDate,
  approx: /^(?:この頃)|[（(](?:推定|頃|ごろ)[）)]/u,
  locBefore: /(?!)/u,
  locAfter: /^(?:で|にて|において|付近で|近郊で)/u,
  dateLink: /^(?:(?:1[0-2]|[1-9])月(?:[1-3]?[0-9]日)?(?: \(旧暦\))?|(?:紀元前)?\d{1,4}年(?:代)?|(?:紀元前)?\d{1,2}世紀)$/u,
};

export const LANGS: Record<string, Lang> = { en, tr, de, fr, ru, es, ar, fa, zh, ja };
export const LANG_CODES = Object.keys(LANGS);

/** The month a name stands for (0-based), or -1. CJK months are numbers. */
export function monthIndex(lang: Lang, name: string | undefined): number {
  if (!name) return -1;
  if (/^\d+$/.test(name)) return Number(name) - 1;
  const n = name.toLowerCase();
  return lang.months.findIndex(alts => alts.some(a => a.toLowerCase() === n));
}

export const dayNum = (s: string | undefined) => (s ? num(s) : null);
