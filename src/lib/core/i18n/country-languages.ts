/**
 * The languages read in each country (ISO 3166-1 alpha-2 → ISO 639-1), most used first. The first is the
 * country's default; the rest are only chosen when the visitor's browser asks for them (pick-locale.ts).
 * Unsupported languages are listed on purpose: a first language TAKIP doesn't ship must not hand the
 * country a minority language its readers don't use. 'zh-hant' marks Traditional Chinese, which isn't shipped.
 * Countries left out fall through to the browser's language.
 */
export const COUNTRY_LANGUAGES: Record<string, readonly string[]> = {
  // English
  US: ['en', 'es'], GB: ['en'], IE: ['en'], AU: ['en'], NZ: ['en'], CA: ['en', 'fr'], ZA: ['en', 'af', 'zu'],
  NG: ['en'], GH: ['en'], KE: ['en', 'sw'], UG: ['en', 'sw'], ZW: ['en'], ZM: ['en'], MW: ['en'], BW: ['en', 'tn'],
  NA: ['en', 'af', 'de'], LR: ['en'], SL: ['en'], GM: ['en'], SS: ['en', 'ar'], SZ: ['en'], LS: ['en'], MU: ['en', 'fr'],
  SC: ['en', 'fr'], SG: ['en', 'zh', 'ms', 'ta'], PH: ['en', 'tl'], JM: ['en'], TT: ['en'], BS: ['en'], BB: ['en'],
  BZ: ['en', 'es'], GY: ['en'], AG: ['en'], DM: ['en'], GD: ['en'], KN: ['en'], LC: ['en'], VC: ['en'], BM: ['en'],
  KY: ['en'], VG: ['en'], VI: ['en'], TC: ['en'], AI: ['en'], MS: ['en'], GU: ['en'], AS: ['en'], MP: ['en'],
  FK: ['en'], GI: ['en', 'es'], IM: ['en'], JE: ['en'], GG: ['en'], MT: ['mt', 'en'], FJ: ['en'], PG: ['en'],
  SB: ['en'], VU: ['bi', 'en', 'fr'], WS: ['sm', 'en'], TO: ['to', 'en'], KI: ['en'], FM: ['en'], MH: ['mh', 'en'],
  PW: ['en'], NR: ['en'], TV: ['en'], IN: ['hi', 'en'], PK: ['ur', 'en'], BD: ['bn'], LK: ['si', 'ta', 'en'],
  NP: ['ne'], BT: ['dz'], MV: ['dv'], MM: ['my'], TZ: ['sw', 'en'], RW: ['rw', 'en', 'fr'], ET: ['am'], ER: ['ti', 'ar', 'en'],
  // Spanish
  ES: ['es', 'ca', 'gl', 'eu'], MX: ['es'], AR: ['es'], CO: ['es'], PE: ['es', 'qu'], VE: ['es'], CL: ['es'],
  EC: ['es'], GT: ['es'], CU: ['es'], BO: ['es', 'qu'], DO: ['es'], HN: ['es'], PY: ['es', 'gn'], SV: ['es'],
  NI: ['es'], CR: ['es'], PA: ['es'], UY: ['es'], PR: ['es', 'en'], GQ: ['es', 'fr', 'pt'], AD: ['ca', 'es', 'fr'],
  // Portuguese
  BR: ['pt'], PT: ['pt'], AO: ['pt'], MZ: ['pt'], GW: ['pt'], CV: ['pt'], ST: ['pt'], TL: ['pt', 'tet'],
  // French
  FR: ['fr'], BE: ['nl', 'fr', 'de'], CH: ['de', 'fr', 'it'], LU: ['lb', 'fr', 'de'], MC: ['fr'], CI: ['fr'],
  SN: ['fr'], ML: ['fr'], BF: ['fr'], NE: ['fr'], GN: ['fr'], BJ: ['fr'], TG: ['fr'], CM: ['fr', 'en'], CD: ['fr'],
  CG: ['fr'], GA: ['fr'], CF: ['fr'], TD: ['fr', 'ar'], MG: ['fr', 'mg'], HT: ['fr', 'ht'], BI: ['rn', 'fr'],
  DJ: ['fr', 'ar'], KM: ['fr', 'ar'], NC: ['fr'], PF: ['fr'], RE: ['fr'], GP: ['fr'], MQ: ['fr'], GF: ['fr'],
  YT: ['fr'], PM: ['fr'], WF: ['fr'], BL: ['fr'], MF: ['fr'],
  // German
  DE: ['de'], AT: ['de'], LI: ['de'], IT: ['it', 'de'],
  // Russian, and where it is read beside the state language
  RU: ['ru'], BY: ['ru', 'be'], KZ: ['kk', 'ru'], KG: ['ky', 'ru'], TJ: ['tg', 'ru'], UZ: ['uz', 'ru'],
  TM: ['tk', 'ru'], AM: ['hy', 'ru'], AZ: ['az', 'ru'], GE: ['ka'], MD: ['ro', 'ru'], LV: ['lv', 'ru'],
  EE: ['et', 'ru'], LT: ['lt', 'ru'], UA: ['uk'], MN: ['mn'],
  // Turkish
  TR: ['tr'], CY: ['el', 'tr'],
  // Arabic
  SA: ['ar'], AE: ['ar', 'en'], EG: ['ar'], IQ: ['ar', 'ku'], JO: ['ar'], KW: ['ar'], QA: ['ar', 'en'], BH: ['ar'],
  OM: ['ar'], YE: ['ar'], SY: ['ar'], LY: ['ar'], SD: ['ar', 'en'], PS: ['ar'], LB: ['ar', 'fr'], DZ: ['ar', 'fr'],
  MA: ['ar', 'fr'], TN: ['ar', 'fr'], MR: ['ar', 'fr'], SO: ['so', 'ar'], IL: ['he', 'ar'], IR: ['fa'], AF: ['ps', 'fa'],
  // Chinese and Japanese
  CN: ['zh'], TW: ['zh-hant'], HK: ['zh-hant', 'en'], MO: ['zh-hant', 'pt'], JP: ['ja'], KR: ['ko'], KP: ['ko'],
  MY: ['ms', 'en', 'zh'],
  // The rest of Europe and Asia, so a neighbour's language never stands in for theirs
  NL: ['nl'], PL: ['pl'], CZ: ['cs'], SK: ['sk'], HU: ['hu'], RO: ['ro'], BG: ['bg'], GR: ['el'], RS: ['sr'],
  HR: ['hr'], SI: ['sl'], BA: ['bs', 'hr', 'sr'], ME: ['sr'], MK: ['mk'], AL: ['sq'], XK: ['sq', 'sr'], DK: ['da'],
  SE: ['sv'], NO: ['no', 'nb'], FI: ['fi', 'sv'], IS: ['is'], SM: ['it'], VA: ['it'], ID: ['id'], VN: ['vi'],
  TH: ['th'], KH: ['km'], LA: ['lo'], BN: ['ms', 'en'],
};
