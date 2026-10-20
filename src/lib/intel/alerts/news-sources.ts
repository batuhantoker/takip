import type { Bloc } from './digest';

/** Who the Live Alerts feed (/api/news) reads: Telegram channels and wire services. */

// Public Telegram OSINT channels, picked for what they report rather than what
// they argue. Measured over 72 hours of live posts, each one carries more
// events — strikes, impacts, intercepts, damage, movements — than commentary,
// and the roster spans the spectrum so no single narrative owns the feed.
// `lean` and `bloc` travel with every item to the UI: a partisan field report
// is still a partisan source, and is labelled as one.
//
// Dropped 2026-09-18 for talking more than they report (event share over
// quote share, same window): Middle East Spectator 12/41, NEXTA Live 15/45
// (and 1% English), Bellum Acta 25/44 (also runs advertising in its footer).
// Earlier: OSINTtechnical (silent since June 2022), Clash Report and Liveuamap.
export interface Feed { handle: string; name: string; lean: string; bloc: Bloc }

export const TELEGRAM_CHANNELS: Feed[] = [
  // Incident feeds: what happened, where, with footage. Least commentary of any source measured.
  { handle: 'Osintdefender',         name: 'OSINTdefender',         lean: 'Global incident OSINT',         bloc: 'independent' },
  { handle: 'WarMonitors',           name: 'War Monitor',           lean: 'Global conflict monitor',       bloc: 'independent' },
  // Russia–Ukraine, reported from both sides of the line.
  { handle: 'rybar_in_english',      name: 'Rybar',                 lean: 'Russian military OSINT',        bloc: 'russian' },
  { handle: 'DDGeopolitics',         name: 'DD Geopolitics',        lean: 'Multipolar / Russian',          bloc: 'russian' },
  { handle: 'KyivIndependent_official', name: 'Kyiv Independent',   lean: 'Ukrainian newsroom',            bloc: 'western' },
  // Gaza, the West Bank and south Lebanon, from newsrooms on the ground.
  { handle: 'QudsNen',               name: 'Quds News Network',     lean: 'Palestinian / Gaza & West Bank', bloc: 'regional' },
  { handle: 'AlMayadeenEnglish',     name: 'Al Mayadeen English',   lean: 'Lebanese / Resistance Axis',    bloc: 'regional' },
  // Added 2026-09-20 after measuring the same 72-hour window: both report
  // events in English more often than they comment on them.
  { handle: 'intelslava',            name: 'Intel Slava Z',         lean: 'Russian military OSINT',        bloc: 'russian' },
  { handle: 'PressTV',               name: 'Press TV',              lean: 'Iranian state broadcaster',     bloc: 'regional' },
];

/*
 * Wire services and national newsrooms. The channels above are fast and carry
 * footage, but they follow a handful of wars: nothing in the roster reports
 * Africa, South and East Asia, or Latin America unless a war reaches them, and
 * if Telegram blocks the host the feed goes dark. These cover that ground,
 * publish on a schedule, and are labelled for who runs them — a state
 * broadcaster is a state broadcaster whatever it is reporting.
 *
 * Checked 2026-09-20: each answers, carries at least ten items, and its newest
 * item was under an hour old. Left out because they do not: Reuters (feed
 * retired), AP and Al Arabiya (403 to any reader), Xinhua and NHK (404),
 * France 24 (empty), Kyiv Independent (404 — its Telegram channel is above),
 * Jerusalem Post (items dated 2025).
 *
 * Added 2026-10-12 on the same test: The Independent and Times of India. Left
 * out: Euronews (newest item two hours old), and Jerusalem Post's
 * rssfeedsinternational, which stamps Israeli local time as GMT.
 *
 * Added 2026-10-20, from 139 outlets checked, with the bar at three hours since
 * the slow hours of each region fail one: the 21 below `timesofindia`. Left
 * out: Xinhua, People's Daily, Global Times and China Daily (stale or 404),
 * NHK (404), Japan Times and Korea Herald (hours old), VOA (stale since 2025),
 * UN News (stamps every item 12:00 UTC), ReliefWeb and OCHA (406 to readers),
 * Daily Maverick, News24 and The EastAfrican (future dates or 403).
 */
export const WIRE_FEEDS: (Feed & { url: string })[] = [
  { handle: 'bbc',        url: 'https://feeds.bbci.co.uk/news/world/rss.xml',        name: 'BBC World',        lean: 'British public broadcaster',   bloc: 'western' },
  { handle: 'guardian',   url: 'https://www.theguardian.com/world/rss',              name: 'The Guardian',     lean: 'British newsroom',             bloc: 'western' },
  { handle: 'aljazeera',  url: 'https://www.aljazeera.com/xml/rss/all.xml',          name: 'Al Jazeera',       lean: 'Qatari broadcaster',           bloc: 'regional' },
  { handle: 'timesofisrael', url: 'https://www.timesofisrael.com/feed/',             name: 'Times of Israel',  lean: 'Israeli newsroom',             bloc: 'regional' },
  { handle: 'tass',       url: 'https://tass.com/rss/v2.xml',                        name: 'TASS',             lean: 'Russian state agency',         bloc: 'russian' },
  { handle: 'anadolu',    url: 'https://www.aa.com.tr/en/rss/default?cat=world',     name: 'Anadolu Agency',   lean: 'Turkish state agency',         bloc: 'regional' },
  { handle: 'scmp',       url: 'https://www.scmp.com/rss/91/feed',                   name: 'SCMP',             lean: 'Hong Kong newsroom',           bloc: 'regional' },
  { handle: 'cna',        url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', name: 'CNA', lean: 'Singaporean broadcaster', bloc: 'regional' },
  { handle: 'africanews', url: 'https://www.africanews.com/feed/rss',                name: 'Africanews',       lean: 'Pan-African newsroom',         bloc: 'regional' },
  { handle: 'independent', url: 'https://www.independent.co.uk/news/world/rss',      name: 'The Independent',  lean: 'British newsroom',             bloc: 'western' },
  { handle: 'timesofindia', url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', name: 'Times of India', lean: 'Indian newsroom', bloc: 'regional' },
  // Europe, and Russia and Ukraine from outside the Kremlin's line.
  { handle: 'dw',         url: 'https://rss.dw.com/xml/rss-en-world',                name: 'DW',               lean: 'German public broadcaster',    bloc: 'western' },
  { handle: 'france24',   url: 'https://www.france24.com/en/rss',                    name: 'France 24',        lean: 'French public broadcaster',    bloc: 'western' },
  { handle: 'euronews',   url: 'https://www.euronews.com/rss?level=theme&name=news', name: 'Euronews',         lean: 'Pan-European broadcaster',     bloc: 'western' },
  { handle: 'meduza',     url: 'https://meduza.io/rss/en/all',                       name: 'Meduza',           lean: 'Russian newsroom in exile',    bloc: 'western' },
  { handle: 'upravda',    url: 'https://www.pravda.com.ua/eng/rss/',                 name: 'Ukrainska Pravda', lean: 'Ukrainian newsroom',           bloc: 'western' },
  { handle: 'rferl',      url: 'https://www.rferl.org/api/',                         name: 'RFE/RL',           lean: 'US-funded broadcaster',        bloc: 'western' },
  // The Americas and Oceania.
  { handle: 'nyt',        url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'New York Times', lean: 'American newsroom',          bloc: 'western' },
  { handle: 'elpais',     url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada', name: 'El País', lean: 'Spanish newsroom', bloc: 'western' },
  { handle: 'telesur',    url: 'https://www.telesurenglish.net/feed/',               name: 'teleSUR',          lean: 'Venezuelan state-funded broadcaster', bloc: 'regional' },
  { handle: 'abcau',      url: 'https://www.abc.net.au/news/feed/51120/rss.xml',     name: 'ABC Australia',    lean: 'Australian public broadcaster', bloc: 'western' },
  // Asia.
  { handle: 'kyodo',      url: 'https://english.kyodonews.net/list/feed/rss4kyodonews-fzone', name: 'Kyodo News', lean: 'Japanese news agency',      bloc: 'regional' },
  { handle: 'yonhap',     url: 'https://en.yna.co.kr/RSS/national.xml',              name: 'Yonhap',           lean: 'South Korean news agency',     bloc: 'regional' },
  // FeedBurner-hosted: focustaiwan.tw serves no feed of its own.
  { handle: 'focustaiwan', url: 'https://feeds.feedburner.com/rsscna/engnews',       name: 'Focus Taiwan',     lean: 'Taiwanese state news agency',  bloc: 'regional' },
  { handle: 'antara',     url: 'https://en.antaranews.com/rss/news.xml',             name: 'Antara',           lean: 'Indonesian state news agency', bloc: 'regional' },
  { handle: 'dawn',       url: 'https://www.dawn.com/feeds/home',                    name: 'Dawn',             lean: 'Pakistani newsroom',           bloc: 'regional' },
  // The Middle East and Africa.
  { handle: 'mee',        url: 'https://www.middleeasteye.net/rss',                  name: 'Middle East Eye',  lean: 'Middle East newsroom (London)', bloc: 'regional' },
  { handle: 'thenational', url: 'https://www.thenationalnews.com/arc/outboundfeeds/rss/category/news/?outputType=xml', name: 'The National', lean: 'Emirati newsroom', bloc: 'regional' },
  { handle: 'premiumtimes', url: 'https://www.premiumtimesng.com/feed',              name: 'Premium Times',    lean: 'Nigerian newsroom',            bloc: 'regional' },
  { handle: 'dabanga',    url: 'https://www.dabangasudan.org/en/feed',               name: 'Radio Dabanga',    lean: 'Sudanese newsroom in exile',   bloc: 'regional' },
  { handle: 'allafrica',  url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', name: 'AllAfrica', lean: 'Pan-African aggregator',   bloc: 'independent' },
  { handle: 'newhumanitarian', url: 'https://www.thenewhumanitarian.org/rss/all.xml', name: 'The New Humanitarian', lean: 'Humanitarian newsroom',  bloc: 'independent' },
];
