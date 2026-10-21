/**
 * Live TV news: YouTube channels that were broadcasting live, and allowed an
 * embedded player, when checked on 2026-10-20 (83 of 104 tried) and 2026-10-21
 * (41 more of 104), from a Mac; what plays can differ by country. What each is showing now comes
 * from live-tv-status.ts: about a third of them start a new video every day,
 * and some put an event on their live slot in place of the 24/7 stream (Sky
 * News, BFMTV, N+).
 *
 * Left out because they were not live then: C-SPAN (events only), UKRINFORM,
 * Al Mayadeen, LBCI, SABC, Kurdistan24, CCTV, ABS-CBN, Global News, CTV.
 * RT and Press TV have no YouTube channel. Channel ids in the lists this
 * replaced were wrong for Bloomberg, CBC, Euronews, TRT World, Africanews,
 * Arirang and ABC Australia.
 */

export type TvRegion = 'americas' | 'europe' | 'middleeast' | 'africa' | 'asia';

export interface LiveChannel {
  id: string;
  name: string;
  /** YouTube channel id. */
  channel: string;
  /** Where the newsroom is, which is where its pin goes. */
  city: string;
  country: string;
  lat: number;
  lng: number;
  region: TvRegion;
  category: 'mainstream' | 'finance' | 'state' | 'conflict';
  /** ISO 639-1. */
  language: string;
}

export const LIVE_CHANNELS: LiveChannel[] = [
  // ── The Americas ──
  { id: 'nbcnews',        name: 'NBC News NOW',             channel: 'UCeY0bbntWzzVIaj2z3QigXg', city: 'New York', country: 'US', lat: 40.759, lng: -73.98, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'cbsnews',        name: 'CBS News 24/7',            channel: 'UC8p1vwvWtl6T73JiExfWs1g', city: 'New York', country: 'US', lat: 40.764, lng: -73.973, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'abcnews',        name: 'ABC News Live',            channel: 'UCBi2mrWuNuyYy4gbM6fU18Q', city: 'New York', country: 'US', lat: 40.763, lng: -73.979, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'livenow',        name: 'LiveNOW from FOX',         channel: 'UCJg9wBPyKMNA5sRDnvzmkdg', city: 'Phoenix', country: 'US', lat: 33.448, lng: -112.074, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'bloomberg',      name: 'Bloomberg Television',     channel: 'UCIALMKvObZNtJ6AmdCLP7Lg', city: 'New York', country: 'US', lat: 40.762, lng: -73.968, region: 'americas', category: 'finance', language: 'en' },
  { id: 'yahoofinance',   name: 'Yahoo Finance',            channel: 'UCEAZeUIeJs0IjQiqTCdVSIg', city: 'New York', country: 'US', lat: 40.741, lng: -74.004, region: 'americas', category: 'finance', language: 'en' },
  { id: 'foxweather',     name: 'FOX Weather',              channel: 'UC1FbPiXx59_ltnFVx7IxWow', city: 'New York', country: 'US', lat: 40.759, lng: -73.985, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'cbc',            name: 'CBC News',                 channel: 'UCuFFtHWoLl5fauMMD5Ww2jA', city: 'Toronto', country: 'CA', lat: 43.644, lng: -79.387, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'telesuren',      name: 'teleSUR English',          channel: 'UCmuTmpLY35O3csvhyA6vrkg', city: 'Caracas', country: 'VE', lat: 10.491, lng: -66.902, region: 'americas', category: 'state', language: 'en' },
  { id: 'telesur',        name: 'teleSUR',                  channel: 'UCZSdNK_ZmMQcLTz-obKr-Dw', city: 'Caracas', country: 'VE', lat: 10.491, lng: -66.902, region: 'americas', category: 'state', language: 'es' },
  { id: 'milenio',        name: 'Milenio',                  channel: 'UCFxHplbcoJK9m70c4VyTIxg', city: 'Mexico City', country: 'MX', lat: 19.432, lng: -99.133, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'nmas',           name: 'N+',                       channel: 'UCUsm-fannqOY02PNN67C0KA', city: 'Mexico City', country: 'MX', lat: 19.421, lng: -99.166, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'cnnbrasil',      name: 'CNN Brasil',               channel: 'UCvdwhh_fDyWccR42-rReZLw', city: 'São Paulo', country: 'BR', lat: -23.561, lng: -46.656, region: 'americas', category: 'mainstream', language: 'pt' },
  { id: 'jovempan',       name: 'Jovem Pan News',           channel: 'UCP391YRAjSOdM_bwievgaZA', city: 'São Paulo', country: 'BR', lat: -23.567, lng: -46.649, region: 'americas', category: 'mainstream', language: 'pt' },
  { id: 'tn',             name: 'TN Todo Noticias',         channel: 'UCj6PcyLvpnIRT_2W_mwa9Aw', city: 'Buenos Aires', country: 'AR', lat: -34.627, lng: -58.384, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'c5n',            name: 'C5N',                      channel: 'UCFgk2Q2mVO1BklRQhSv6p0w', city: 'Buenos Aires', country: 'AR', lat: -34.603, lng: -58.381, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'noticiascaracol',name: 'Noticias Caracol',         channel: 'UC2Xq2PK-got3Rtz9ZJ32hLQ', city: 'Bogotá', country: 'CO', lat: 4.687, lng: -74.05, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'globalnews',     name: 'Global News',              channel: 'UChLtXXpo4Ge1ReTEboVvTDg', city: 'Toronto', country: 'CA', lat: 43.651, lng: -79.383, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'cp24',           name: 'CP24',                     channel: 'UCs3o4RhBiP2wcwqkZR2QVLw', city: 'Toronto', country: 'CA', lat: 43.651, lng: -79.383, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'scrippsnews',    name: 'Scripps News',             channel: 'UCTln5ss6h6L_xNfMeujfPbg', city: 'Washington', country: 'US', lat: 38.907, lng: -77.037, region: 'americas', category: 'mainstream', language: 'en' },
  { id: 'cnnee',          name: 'CNN en Español',           channel: 'UC_lEiu6917IJz03TnntWUaQ', city: 'Atlanta', country: 'US', lat: 33.749, lng: -84.388, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'noticiasrcn',    name: 'Noticias RCN',             channel: 'UCnr6pbeXJmkNQJ9PSYle7QQ', city: 'Bogotá', country: 'CO', lat: 4.711, lng: -74.072, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'rpp',            name: 'RPP Noticias',             channel: 'UC5j8-2FT0ZMMBkmK72R4aeA', city: 'Lima', country: 'PE', lat: -12.046, lng: -77.043, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'a24',            name: 'A24',                      channel: 'UCR9120YBAqMfntqgRTKmkjQ', city: 'Buenos Aires', country: 'AR', lat: -34.604, lng: -58.382, region: 'americas', category: 'mainstream', language: 'es' },
  { id: 'recordnews',     name: 'Record News',              channel: 'UCuiLR4p6wQ3xLEm15pEn1Xw', city: 'São Paulo', country: 'BR', lat: -23.551, lng: -46.633, region: 'americas', category: 'mainstream', language: 'pt' },
  // ── Europe, Turkey, Russia and Ukraine ──
  { id: 'skynews',        name: 'Sky News',                 channel: 'UCoMdktPbSTixAyNGwb-UYkQ', city: 'London', country: 'GB', lat: 51.488, lng: -0.33, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'bbcnews',        name: 'BBC News',                 channel: 'UC16niRr50-MSBwiO3YDb3RA', city: 'London', country: 'GB', lat: 51.519, lng: -0.144, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'gbnews',         name: 'GB News',                  channel: 'UC0vn8ISa4LKMunLbzaXLnOQ', city: 'London', country: 'GB', lat: 51.519, lng: -0.176, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'timesradio',     name: 'Times Radio',              channel: 'UCF-VP3b3oH0XASqsLI5rnLw', city: 'London', country: 'GB', lat: 51.505, lng: -0.087, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'france24en',     name: 'France 24 English',        channel: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', city: 'Paris', country: 'FR', lat: 48.83, lng: 2.263, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'france24fr',     name: 'France 24',                channel: 'UCCCPCZNChQdGa9EkATeye4g', city: 'Paris', country: 'FR', lat: 48.83, lng: 2.263, region: 'europe', category: 'mainstream', language: 'fr' },
  { id: 'france24es',     name: 'France 24 Español',        channel: 'UCUdOoVWuWmgo1wByzcsyKDQ', city: 'Paris', country: 'FR', lat: 48.83, lng: 2.263, region: 'europe', category: 'mainstream', language: 'es' },
  { id: 'france24ar',     name: 'France 24 Arabic',         channel: 'UCdTyuXgmJkG_O8_75eqej-w', city: 'Paris', country: 'FR', lat: 48.83, lng: 2.263, region: 'europe', category: 'mainstream', language: 'ar' },
  { id: 'dwnews',         name: 'DW News',                  channel: 'UCknLrEdhRCp1aegoMqRaCZg', city: 'Berlin', country: 'DE', lat: 52.508, lng: 13.376, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'dwespanol',      name: 'DW Español',               channel: 'UCT4Jg8h03dD0iN3Pb5L0PMA', city: 'Berlin', country: 'DE', lat: 52.508, lng: 13.376, region: 'europe', category: 'mainstream', language: 'es' },
  { id: 'dwarabic',       name: 'DW Arabic',                channel: 'UC30ditU5JI16o5NbFsHde_Q', city: 'Berlin', country: 'DE', lat: 52.508, lng: 13.376, region: 'europe', category: 'mainstream', language: 'ar' },
  { id: 'euronews',       name: 'Euronews',                 channel: 'UCSrZ3UV4jOidv8ppoVuvW9Q', city: 'Lyon', country: 'FR', lat: 45.764, lng: 4.836, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'euronewses',     name: 'Euronews Español',         channel: 'UCyoGb3SMlTlB8CLGVH4c8Rw', city: 'Lyon', country: 'FR', lat: 45.764, lng: 4.836, region: 'europe', category: 'mainstream', language: 'es' },
  { id: 'euronewsfr',     name: 'Euronews Français',        channel: 'UCW2QcKZiU8aUGg4yxCIditg', city: 'Lyon', country: 'FR', lat: 45.764, lng: 4.836, region: 'europe', category: 'mainstream', language: 'fr' },
  { id: 'euronewsde',     name: 'Euronews Deutsch',         channel: 'UCACdxU3VrJIJc7ujxtHWs1w', city: 'Lyon', country: 'FR', lat: 45.764, lng: 4.836, region: 'europe', category: 'mainstream', language: 'de' },
  { id: 'euronewsit',     name: 'Euronews Italiano',        channel: 'UC1mX9vuLOYf8fhaXS_KcDRg', city: 'Lyon', country: 'FR', lat: 45.764, lng: 4.836, region: 'europe', category: 'mainstream', language: 'it' },
  { id: 'welt',           name: 'WELT Nachrichtensender',   channel: 'UCZMsvbAhhRblVGXmEXW8TSA', city: 'Berlin', country: 'DE', lat: 52.507, lng: 13.391, region: 'europe', category: 'mainstream', language: 'de' },
  { id: 'bfmtv',          name: 'BFMTV',                    channel: 'UCXwDLMDV86ldKoFVc_g8P0g', city: 'Paris', country: 'FR', lat: 48.84, lng: 2.27, region: 'europe', category: 'mainstream', language: 'fr' },
  { id: 'franceinfo',     name: 'franceinfo',               channel: 'UCO6K_kkdP-lnSCiO3tPx7WA', city: 'Paris', country: 'FR', lat: 48.853, lng: 2.278, region: 'europe', category: 'mainstream', language: 'fr' },
  { id: 'rtve',           name: 'RTVE Noticias (24h)',      channel: 'UC7QZIf0dta-XPXsp9Hv4dTw', city: 'Madrid', country: 'ES', lat: 40.423, lng: -3.664, region: 'europe', category: 'mainstream', language: 'es' },
  { id: 'tvpinfo',        name: 'TVP Info',                 channel: 'UCzQZbOb86WvhOPoR7jgAfsA', city: 'Warsaw', country: 'PL', lat: 52.229, lng: 21.012, region: 'europe', category: 'state', language: 'pl' },
  { id: 'trtworld',       name: 'TRT World',                channel: 'UC7fWeaHhqgM4Ry-RMpM2YYw', city: 'Istanbul', country: 'TR', lat: 41.071, lng: 29.03, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'haberglobal',    name: 'Haber Global',             channel: 'UCtc-a9ZUIg0_5HpsPxEO7Qg', city: 'Istanbul', country: 'TR', lat: 41.05, lng: 28.99, region: 'europe', category: 'mainstream', language: 'tr' },
  { id: 'cnnturk',        name: 'CNN Türk',                 channel: 'UCV6zcRug6Hqp1UX_FdyUeBg', city: 'Istanbul', country: 'TR', lat: 41.05, lng: 28.833, region: 'europe', category: 'mainstream', language: 'tr' },
  { id: 'ntvtr',          name: 'NTV',                      channel: 'UC9TDTjbOjFB9jADmPhSAPsw', city: 'Istanbul', country: 'TR', lat: 41.081, lng: 29.011, region: 'europe', category: 'mainstream', language: 'tr' },
  { id: 'trthaber',       name: 'TRT Haber',                channel: 'UCBgTP2LOFVPmq15W-RH-WXA', city: 'Ankara', country: 'TR', lat: 39.893, lng: 32.854, region: 'europe', category: 'state', language: 'tr' },
  { id: 'freedom',        name: 'FREEДOM',                  channel: 'UCt3igz3aIXfS108KV_jZsMA', city: 'Kyiv', country: 'UA', lat: 50.45, lng: 30.523, region: 'europe', category: 'conflict', language: 'ru' },
  { id: 'espreso',        name: 'Espreso TV',               channel: 'UCMEiyV8N2J93GdPNltPYM6w', city: 'Kyiv', country: 'UA', lat: 50.45, lng: 30.523, region: 'europe', category: 'conflict', language: 'uk' },
  { id: 'tagesschau',     name: 'tagesschau',               channel: 'UC5NOEUbkLheQcaaRldYW5GA', city: 'Hamburg', country: 'DE', lat: 53.551, lng: 9.994, region: 'europe', category: 'mainstream', language: 'de' },
  { id: 'talktv',         name: 'TalkTV',                   channel: 'UCm0yTweyAa0PwEIp0l3N_gA', city: 'London', country: 'GB', lat: 51.507, lng: -0.128, region: 'europe', category: 'mainstream', language: 'en' },
  { id: 'currenttime',    name: 'Current Time',             channel: 'UCBG57608Hukev3d0d-gvLhQ', city: 'Prague', country: 'CZ', lat: 50.076, lng: 14.438, region: 'europe', category: 'state', language: 'ru' },
  { id: 'sozcutv',        name: 'Sözcü TV',                 channel: 'UCOulx_rep5O4i9y6AyDqVvw', city: 'Istanbul', country: 'TR', lat: 41.008, lng: 28.978, region: 'europe', category: 'mainstream', language: 'tr' },
  { id: 'ahaber',         name: 'A Haber',                  channel: 'UCKQhfw-lzz0uKnE1fY1PsAA', city: 'Istanbul', country: 'TR', lat: 41.008, lng: 28.978, region: 'europe', category: 'mainstream', language: 'tr' },
  { id: 'tgrthaber',      name: 'TGRT Haber',               channel: 'UCzgrZ-CndOoylh2_e72nSBQ', city: 'Istanbul', country: 'TR', lat: 41.008, lng: 28.978, region: 'europe', category: 'mainstream', language: 'tr' },
  // ── The Middle East ──
  { id: 'aljazeera',      name: 'Al Jazeera English',       channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg', city: 'Doha', country: 'QA', lat: 25.286, lng: 51.534, region: 'middleeast', category: 'mainstream', language: 'en' },
  { id: 'aljazeeraar',    name: 'Al Jazeera Arabic',        channel: 'UCfiwzLy-8yKzIbsmZTzxDgw', city: 'Doha', country: 'QA', lat: 25.286, lng: 51.534, region: 'middleeast', category: 'mainstream', language: 'ar' },
  { id: 'ajmubasher',     name: 'Al Jazeera Mubasher',      channel: 'UCCv1Pd24oPErw5S7zJWltnQ', city: 'Doha', country: 'QA', lat: 25.286, lng: 51.534, region: 'middleeast', category: 'mainstream', language: 'ar' },
  { id: 'alarabiya',      name: 'Al Arabiya',               channel: 'UCahpxixMCwoANAftn6IxkTg', city: 'Dubai', country: 'AE', lat: 25.094, lng: 55.157, region: 'middleeast', category: 'mainstream', language: 'ar' },
  { id: 'alhadath',       name: 'Al Hadath',                channel: 'UCrj5BGAhtWxDfqbza9T9hqA', city: 'Dubai', country: 'AE', lat: 25.094, lng: 55.157, region: 'middleeast', category: 'mainstream', language: 'ar' },
  { id: 'skynewsarabia',  name: 'Sky News Arabia',          channel: 'UCIJXOvggjKtCagMfxvcCzAA', city: 'Abu Dhabi', country: 'AE', lat: 24.454, lng: 54.384, region: 'middleeast', category: 'mainstream', language: 'ar' },
  { id: 'asharq',         name: 'Asharq News',              channel: 'UCRJUVYt9gjg8MnlGacySUdg', city: 'Riyadh', country: 'SA', lat: 24.713, lng: 46.675, region: 'middleeast', category: 'mainstream', language: 'ar' },
  { id: 'i24en',          name: 'i24NEWS English',          channel: 'UCvHDpsWKADrDia0c99X37vg', city: 'Tel Aviv', country: 'IL', lat: 32.054, lng: 34.751, region: 'middleeast', category: 'mainstream', language: 'en' },
  { id: 'rudaw',          name: 'Rudaw',                    channel: 'UCAUHoE2Ykw0sguyi5AjhrjQ', city: 'Erbil', country: 'IQ', lat: 36.191, lng: 44.009, region: 'middleeast', category: 'mainstream', language: 'ku' },
  { id: 'iranintl',       name: 'Iran International',       channel: 'UCat6bC0Wrqq9Bcq7EkH_yQw', city: 'London', country: 'GB', lat: 51.5, lng: -0.02, region: 'middleeast', category: 'mainstream', language: 'fa' },
  { id: 'alghad',         name: 'Alghad',                   channel: 'UCH4UNKBHSNwstan99YDoCVg', city: 'Cairo', country: 'EG', lat: 30.044, lng: 31.236, region: 'middleeast', category: 'mainstream', language: 'ar' },
  { id: 'trtarabi',       name: 'TRT Arabi',                channel: 'UC5GvVahlgulCyo4cshSmbcg', city: 'Istanbul', country: 'TR', lat: 41.008, lng: 28.978, region: 'middleeast', category: 'state', language: 'ar' },
  { id: 'roya',           name: 'Roya News',                channel: 'UCsDQbVxQjBuFOa98vxRlbVQ', city: 'Amman', country: 'JO', lat: 31.954, lng: 35.911, region: 'middleeast', category: 'mainstream', language: 'ar' },
  { id: 'almamlaka',      name: 'Al Mamlaka',               channel: 'UC0jiFAzTgl17k7awGbuoYew', city: 'Amman', country: 'JO', lat: 31.954, lng: 35.911, region: 'middleeast', category: 'state', language: 'ar' },
  // ── Africa ──
  { id: 'africanews',     name: 'Africanews',               channel: 'UC1_E8NeF5QHY2dtdLRBCCLA', city: 'Pointe-Noire', country: 'CG', lat: -4.778, lng: 11.865, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'enca',           name: 'eNCA',                     channel: 'UCI3RT5PGmdi1KVp9FG_CneA', city: 'Johannesburg', country: 'ZA', lat: -26.123, lng: 28.034, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'channelstv',     name: 'Channels TV',              channel: 'UCEXGDNclvmg6RW0vipJYsTQ', city: 'Lagos', country: 'NG', lat: 6.524, lng: 3.379, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'arisenews',      name: 'Arise News',               channel: 'UCyEJX-kSj0kOOCS7Qlq2G7g', city: 'Lagos', country: 'NG', lat: 6.524, lng: 3.379, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'tvcnews',        name: 'TVC News',                 channel: 'UCgp4A6I8LCWrhUzn-5SbKvA', city: 'Lagos', country: 'NG', lat: 6.524, lng: 3.379, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'citizentv',      name: 'Citizen TV Kenya',         channel: 'UChBQgieUidXV1CmDxSdRm3g', city: 'Nairobi', country: 'KE', lat: -1.292, lng: 36.822, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'ntvkenya',       name: 'NTV Kenya',                channel: 'UCqBJ47FjJcl61fmSbcadAVg', city: 'Nairobi', country: 'KE', lat: -1.284, lng: 36.823, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'ktnnews',        name: 'KTN News Kenya',           channel: 'UCKVsdeoHExltrWMuK0hOWmg', city: 'Nairobi', country: 'KE', lat: -1.292, lng: 36.822, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'joynews',        name: 'JoyNews',                  channel: 'UChd1DEecCRlxaa0-hvPACCw', city: 'Accra', country: 'GH', lat: 5.603, lng: -0.187, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'ntvuganda',      name: 'NTV Uganda',               channel: 'UCwga1dPCqBddbtq5KYRii2g', city: 'Kampala', country: 'UG', lat: 0.347, lng: 32.582, region: 'africa', category: 'mainstream', language: 'en' },
  { id: 'tv47',           name: 'TV47',                     channel: 'UC_zA9UIWE1fB-jfFk_DBSYw', city: 'Nairobi', country: 'KE', lat: -1.292, lng: 36.822, region: 'africa', category: 'mainstream', language: 'sw' },
  { id: 'k24',            name: 'K24',                      channel: 'UCt3SE-Mvs3WwP7UW-PiFdqQ', city: 'Nairobi', country: 'KE', lat: -1.292, lng: 36.822, region: 'africa', category: 'mainstream', language: 'en' },
  // ── Asia and Oceania ──
  { id: 'nhkworld',       name: 'NHK World-Japan',          channel: 'UCSPEjw8F2nQDtmUKPFNF7_A', city: 'Tokyo', country: 'JP', lat: 35.665, lng: 139.696, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'annnews',        name: 'ANN News (TV Asahi)',      channel: 'UCGCZAYq5Xxojl_tSXcVJhiQ', city: 'Tokyo', country: 'JP', lat: 35.659, lng: 139.729, region: 'asia', category: 'mainstream', language: 'ja' },
  { id: 'tbsnews',        name: 'TBS NEWS DIG',             channel: 'UC6AG81pAkf6Lbi_1VC5NmPA', city: 'Tokyo', country: 'JP', lat: 35.673, lng: 139.736, region: 'asia', category: 'mainstream', language: 'ja' },
  { id: 'cna',            name: 'CNA',                      channel: 'UC83jt4dlz1Gjl58fzQrrKZg', city: 'Singapore', country: 'SG', lat: 1.299, lng: 103.787, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'wion',           name: 'WION',                     channel: 'UC_gUM8rL-Lrg6O3adPW9K1g', city: 'New Delhi', country: 'IN', lat: 28.614, lng: 77.209, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'ndtv',           name: 'NDTV 24x7',                channel: 'UCZFMm1mMw0F81Z37aaEzTUA', city: 'New Delhi', country: 'IN', lat: 28.549, lng: 77.238, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'indiatoday',     name: 'India Today',              channel: 'UCYPvAwZP8pZhSMW8qs7cVCw', city: 'Noida', country: 'IN', lat: 28.571, lng: 77.323, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'aajtak',         name: 'Aaj Tak',                  channel: 'UCt4t-jeY85JegMlZ-E5UWtA', city: 'Noida', country: 'IN', lat: 28.571, lng: 77.323, region: 'asia', category: 'mainstream', language: 'hi' },
  { id: 'geonews',        name: 'Geo News',                 channel: 'UC_vt34wimdCzdkrzVejwX9g', city: 'Karachi', country: 'PK', lat: 24.86, lng: 67.01, region: 'asia', category: 'mainstream', language: 'ur' },
  { id: 'arynews',        name: 'ARY News',                 channel: 'UCMmpLL2ucRHAXbNHiCPyIyg', city: 'Karachi', country: 'PK', lat: 24.86, lng: 67.01, region: 'asia', category: 'mainstream', language: 'ur' },
  { id: 'somoytv',        name: 'Somoy TV',                 channel: 'UCxHoBXkY88Tb8z1Ssj6CWsQ', city: 'Dhaka', country: 'BD', lat: 23.81, lng: 90.412, region: 'asia', category: 'mainstream', language: 'bn' },
  { id: 'arirangtv',      name: 'Arirang TV',               channel: 'UC-PHIZjV-oX8H7zD1cCN2NQ', city: 'Seoul', country: 'KR', lat: 37.566, lng: 126.978, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'kbsnews',        name: 'KBS News',                 channel: 'UCcQTRi69dsVYHN3exePtZ1A', city: 'Seoul', country: 'KR', lat: 37.525, lng: 126.917, region: 'asia', category: 'mainstream', language: 'ko' },
  { id: 'ytn',            name: 'YTN',                      channel: 'UChlgI3UHCOnwUGzWzbJ3H5w', city: 'Seoul', country: 'KR', lat: 37.58, lng: 126.889, region: 'asia', category: 'mainstream', language: 'ko' },
  { id: 'tvbs',           name: 'TVBS News',                channel: 'UC5nwNW4KdC0SzrhF9BXEYOQ', city: 'Taipei', country: 'TW', lat: 25.079, lng: 121.575, region: 'asia', category: 'mainstream', language: 'zh' },
  { id: 'cgtn',           name: 'CGTN',                     channel: 'UCgrNz-aDmcr2uuto8_DL2jg', city: 'Beijing', country: 'CN', lat: 39.915, lng: 116.464, region: 'asia', category: 'state', language: 'en' },
  { id: 'abcau',          name: 'ABC News Australia',       channel: 'UCVgO39Bk5sMo66-6o6Spn6Q', city: 'Sydney', country: 'AU', lat: -33.88, lng: 151.198, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'gma',            name: 'GMA News',                 channel: 'UCqYw-CTd1dU2yGI71sEyqNw', city: 'Quezon City', country: 'PH', lat: 14.635, lng: 121.043, region: 'asia', category: 'mainstream', language: 'tl' },
  { id: 'kompastv',       name: 'Kompas TV',                channel: 'UC5BMIWZe9isJXLZZWPWvBlg', city: 'Jakarta', country: 'ID', lat: -6.205, lng: 106.797, region: 'asia', category: 'mainstream', language: 'id' },
  { id: 'cnnnews18',      name: 'CNN-News18',               channel: 'UCef1-8eOpJgud7szVPlZQAQ', city: 'Noida', country: 'IN', lat: 28.535, lng: 77.391, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'republicworld',  name: 'Republic World',           channel: 'UCwqusr8YDwM-3mEYTDeJHzw', city: 'Mumbai', country: 'IN', lat: 19.076, lng: 72.878, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'timesnow',       name: 'Times Now',                channel: 'UC6RJ7-PaXg6TIH2BzZfTV7w', city: 'Mumbai', country: 'IN', lat: 19.076, lng: 72.878, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'mirrornow',      name: 'Mirror Now',               channel: 'UCWCEYVwSqr7Epo6sSCfUgiw', city: 'Mumbai', country: 'IN', lat: 19.076, lng: 72.878, region: 'asia', category: 'mainstream', language: 'en' },
  { id: 'abpnews',        name: 'ABP News',                 channel: 'UCRWFSbif-RFENbBrSiez1DA', city: 'Noida', country: 'IN', lat: 28.535, lng: 77.391, region: 'asia', category: 'mainstream', language: 'hi' },
  { id: 'zeenews',        name: 'Zee News',                 channel: 'UCIvaYmXn910QMdemBG3v1pQ', city: 'Noida', country: 'IN', lat: 28.535, lng: 77.391, region: 'asia', category: 'mainstream', language: 'hi' },
  { id: 'ndtvindia',      name: 'NDTV India',               channel: 'UC9CYT9gSNLevX5ey2_6CK0Q', city: 'New Delhi', country: 'IN', lat: 28.614, lng: 77.209, region: 'asia', category: 'mainstream', language: 'hi' },
  { id: 'samaa',          name: 'Samaa TV',                 channel: 'UCJekW1Vj5fCVEGdye_mBN6Q', city: 'Karachi', country: 'PK', lat: 24.861, lng: 67.01, region: 'asia', category: 'mainstream', language: 'ur' },
  { id: 'dawnnews',       name: 'Dawn News',                channel: 'UCaxR-D8FjZ-2otbU0_Y2grg', city: 'Karachi', country: 'PK', lat: 24.861, lng: 67.01, region: 'asia', category: 'mainstream', language: 'ur' },
  { id: 'jamunatv',       name: 'Jamuna TV',                channel: 'UCN6sm8iHiPd0cnoUardDAnw', city: 'Dhaka', country: 'BD', lat: 23.81, lng: 90.412, region: 'asia', category: 'mainstream', language: 'bn' },
  { id: 'metrotv',        name: 'Metro TV',                 channel: 'UCzl0OrB3-ehunyotIQvK77A', city: 'Jakarta', country: 'ID', lat: -6.209, lng: 106.846, region: 'asia', category: 'mainstream', language: 'id' },
  { id: 'tvone',          name: 'tvOne',                    channel: 'UCER4rvDnRBPr_ncYW4UCZjg', city: 'Jakarta', country: 'ID', lat: -6.209, lng: 106.846, region: 'asia', category: 'mainstream', language: 'id' },
  { id: 'fnn',            name: 'FNN',                      channel: 'UCoQBJMzcwmXrRSHBFAlTsIw', city: 'Tokyo', country: 'JP', lat: 35.676, lng: 139.65, region: 'asia', category: 'mainstream', language: 'ja' },
  { id: 'ntvnews',        name: 'Nippon TV News 24',        channel: 'UCuTAXTexrhetbOe3zgskJBQ', city: 'Tokyo', country: 'JP', lat: 35.676, lng: 139.65, region: 'asia', category: 'mainstream', language: 'ja' },
  { id: 'weathernews',    name: 'Weathernews',              channel: 'UCNsidkYpIAQ4QaufptQBPHQ', city: 'Chiba', country: 'JP', lat: 35.607, lng: 140.106, region: 'asia', category: 'mainstream', language: 'ja' },
  { id: 'mbcnews',        name: 'MBC News',                 channel: 'UCF4Wxdo3inmxP-Y59wXDsFw', city: 'Seoul', country: 'KR', lat: 37.566, lng: 126.978, region: 'asia', category: 'mainstream', language: 'ko' },
  { id: 'jtbc',           name: 'JTBC News',                channel: 'UCsU-I-vHLiaMfV_ceaYz5rQ', city: 'Seoul', country: 'KR', lat: 37.566, lng: 126.978, region: 'asia', category: 'mainstream', language: 'ko' },
  { id: 'yonhapnewstv',   name: 'Yonhap News TV',           channel: 'UCTHCOPwqNfZ0uiKOvFyhGwg', city: 'Seoul', country: 'KR', lat: 37.566, lng: 126.978, region: 'asia', category: 'mainstream', language: 'ko' },
  { id: 'ebcnews',        name: 'EBC News',                 channel: 'UCR3asjvr_WAaxwJYEDV_Bfw', city: 'Taipei', country: 'TW', lat: 25.033, lng: 121.565, region: 'asia', category: 'mainstream', language: 'zh' },
  { id: 'ftvnews',        name: 'FTV News',                 channel: 'UC2VmWn8dAqkzlQqvy02E1PA', city: 'Taipei', country: 'TW', lat: 25.033, lng: 121.565, region: 'asia', category: 'mainstream', language: 'zh' },
];

/** A muted, autoplaying player for whatever the channel is live with now; most channels refuse it, so it is the fallback. */
// www.youtube.com, not -nocookie: the map's tiles only hear player errors from that origin.
export const liveEmbedUrl = (c: Pick<LiveChannel, 'channel'>) =>
  `https://www.youtube.com/embed/live_stream?channel=${c.channel}&autoplay=1&mute=1`;

/** A muted, autoplaying player for one broadcast. */
export const videoEmbedUrl = (video: string) => `https://www.youtube.com/embed/${video}?autoplay=1&mute=1`;
