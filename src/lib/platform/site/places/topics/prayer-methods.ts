import { CalculationMethod, Rounding, type CalculationParameters } from 'adhan';
import { msg } from '@/lib/core/i18n/translator';

/**
 * The prayer-time convention each country's pages use, named for the authority behind it. A country not listed
 * gets the Muslim World League's, the usual default; each row cites where its method and its use there are
 * documented. Names go through t(): a ministry's reads in the page's language, an acronym stays as it is.
 */

/** Which Asr an authority's timetables give as the time: the shadow once its length (Shafi‘i, Maliki, Hanbali) or twice (Hanafi). */
export type AsrSchool = 'standard' | 'hanafi';

export interface PrayerMethod {
  id: string;
  /** In the notes. */
  name: string;
  /** In titles and descriptions. */
  short: string;
  params: () => CalculationParameters;
  asr: AsrSchool;
}

function jakim(): CalculationParameters {
  const p = CalculationMethod.Singapore();
  p.fajrAngle = 18;
  return p;
}

/** A national method adhan doesn't have: the Muslim World League's with the authority's angles and margins. */
const national = (fajr: number, isha: number, adjust: { dhuhr?: number; maghrib?: number } = {}) => (): CalculationParameters => {
  const p = CalculationMethod.MuslimWorldLeague();
  p.fajrAngle = fajr;
  p.ishaAngle = isha;
  p.methodAdjustments = { ...p.methodAdjustments, ...adjust };
  return p;
};

const METHODS = {
  mwl: { name: msg('Muslim World League'), short: msg('Muslim World League'), params: CalculationMethod.MuslimWorldLeague, asr: 'standard' },
  egypt: { name: msg('Egyptian General Authority of Survey'), short: msg('Egyptian General Authority of Survey'), params: CalculationMethod.Egyptian, asr: 'standard' },
  karachi: { name: msg('University of Islamic Sciences, Karachi'), short: msg('Karachi'), params: CalculationMethod.Karachi, asr: 'hanafi' },
  ummAlQura: { name: msg('Umm al-Qura University, Makkah'), short: msg('Umm al-Qura'), params: CalculationMethod.UmmAlQura, asr: 'standard' },
  dubai: { name: msg('Dubai'), short: msg('Dubai'), params: CalculationMethod.Dubai, asr: 'standard' },
  qatar: { name: msg('Qatar'), short: msg('Qatar'), params: CalculationMethod.Qatar, asr: 'standard' },
  kuwait: { name: msg('Kuwait'), short: msg('Kuwait'), params: CalculationMethod.Kuwait, asr: 'standard' },
  moonsighting: { name: msg('Moonsighting Committee Worldwide'), short: msg('Moonsighting Committee'), params: CalculationMethod.MoonsightingCommittee, asr: 'standard' },
  isna: { name: msg('Islamic Society of North America (ISNA)'), short: msg('ISNA'), params: CalculationMethod.NorthAmerica, asr: 'standard' },
  muis: { name: msg('MUIS (Majlis Ugama Islam Singapura)'), short: msg('MUIS'), params: CalculationMethod.Singapore, asr: 'standard' },
  kemenag: { name: msg('Kemenag (Kementerian Agama Republik Indonesia)'), short: msg('Kemenag'), params: CalculationMethod.Singapore, asr: 'standard' },
  jakim: { name: msg('JAKIM (Jabatan Kemajuan Islam Malaysia)'), short: msg('JAKIM'), params: jakim, asr: 'standard' },
  tehran: { name: msg('Institute of Geophysics, University of Tehran'), short: msg('University of Tehran'), params: CalculationMethod.Tehran, asr: 'standard' },
  diyanet: { name: msg('Diyanet İşleri Başkanlığı'), short: msg('Diyanet'), params: CalculationMethod.Turkey, asr: 'standard' },
  morocco: { name: msg('Ministry of Habous and Islamic Affairs, Morocco'), short: msg('Moroccan Ministry of Habous'), params: national(19, 17, { dhuhr: 5, maghrib: 5 }), asr: 'standard' },
  tunisia: { name: msg('Ministry of Religious Affairs, Tunisia'), short: msg('Tunisian Ministry of Religious Affairs'), params: national(18, 18), asr: 'standard' },
  jordan: { name: msg('Ministry of Awqaf, Jordan'), short: msg('Jordanian Ministry of Awqaf'), params: national(18, 18, { maghrib: 5 }), asr: 'standard' },
  russia: { name: msg('Spiritual Administration of Muslims of Russia'), short: msg('Spiritual Administration of Muslims of Russia'), params: national(16, 15), asr: 'standard' },
} satisfies Record<string, Omit<PrayerMethod, 'id'>>;

export type MethodId = keyof typeof METHODS;

// adhan = node_modules/adhan/METHODS.md; praytimes = praytimes.org/docs/methods ("Region used").
const BY_COUNTRY: Partial<Record<string, MethodId>> = {
  // adhan: "An approximation of the Diyanet method used in Turkey"; matches diyanet.gov.tr's Istanbul to 2 min.
  TR: 'diyanet',
  // praytimes: Umm al-Qura for the Arabian Peninsula; the UAE, Qatar and Kuwait have their own below.
  SA: 'ummAlQura', BH: 'ummAlQura', OM: 'ummAlQura', YE: 'ummAlQura',
  // adhan: Dubai "Used in the UAE".
  AE: 'dubai',
  // adhan (Java README): "Modified version of Umm al-Qura used in Qatar".
  QA: 'qatar',
  // adhan (Java README): "Method used by the country of Kuwait".
  KW: 'kuwait',
  // praytimes: Egypt's method for "Africa, Syria, Lebanon"; here Egypt, its neighbours and the Horn of Africa.
  EG: 'egypt', SD: 'egypt', SS: 'egypt', LY: 'egypt', SY: 'egypt', LB: 'egypt', ER: 'egypt', DJ: 'egypt', SO: 'egypt', ET: 'egypt',
  // praytimes: Karachi for "Pakistan, Afghanistan, Bangladesh, India", where the Hanafi Asr is the one published.
  PK: 'karachi', IN: 'karachi', BD: 'karachi', AF: 'karachi',
  // adhan: Singapore "Used in Singapore, Malaysia, and Indonesia". Brunei unverified, kept with its neighbours.
  SG: 'muis', BN: 'muis',
  // aladhan.com method 20: Kemenag uses MUIS's 20° and 18°.
  ID: 'kemenag',
  // JAKIM moved Subuh to 18° in 2019 (Berita Harian, 2019-11); e-solat.gov.my's Kuala Lumpur matches to 2 min.
  MY: 'jakim',
  // praytimes: Tehran for Iran.
  IR: 'tehran',
  // praytimes: ISNA for "North America (US and Canada)".
  US: 'isna', CA: 'isna',
  // adhan: Moonsighting Committee "Recommended for North America and the UK".
  GB: 'moonsighting',
  // aladhan.com/v1/methods: Morocco (21) 19° and 17° with Dhuhr and Maghrib 5 min later, Tunisia (18), Jordan (23) and
  // the Spiritual Administration of Muslims of Russia (14). Algeria's (19) is the Muslim World League's 18° and 17°.
  MA: 'morocco', TN: 'tunisia', JO: 'jordan', RU: 'russia',
};

/** A convention many of a country's mosques follow instead, said on its pages. */
const ALTERNATIVE: Partial<Record<string, string>> = {
  FR: msg('Many mosques in France follow the 12° angles of the UOIF (Musulmans de France) instead, which put Fajr later and Isha earlier.'),
  US: msg('Many mosques in North America follow the Moonsighting Committee’s times instead, with Fajr earlier and Isha later.'),
  CA: msg('Many mosques in North America follow the Moonsighting Committee’s times instead, with Fajr earlier and Isha later.'),
};

export function methodFor(cc: string): PrayerMethod {
  const id = BY_COUNTRY[cc] ?? 'mwl';
  return { id, ...METHODS[id] };
}

export const alternativeFor = (cc: string) => ALTERNATIVE[cc];

/** adhan's Singapore method, and JAKIM's built on it, round every time up to the minute. */
export const roundsUp = (m: PrayerMethod) => m.params().rounding === Rounding.Up;
