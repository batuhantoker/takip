# World Monitor — News & OSINT feeds (slice C)

Source: World Monitor clone @968eac6 (AGPL-3.0) — facts only, no code copied. Inputs: `server/worldmonitor/news/v1/_feeds.ts` (server digest, source of truth), `src/config/feeds.ts` + `src/config/variants/{tech,finance}.ts` (client catalogue), `shared/source-tiers.json`, `shared/source-provenance.ts`, `shared/source-geography.json`, `shared/telegram-channel-trust.ts`, `shared/x-account-source-tiers.json`, `data/telegram-channels.json`, `data/x-accounts.json`, `src/config/live-video-sources.ts`, `docs/data-sources.mdx`, `docs/methodology/news-credibility.mdx`, `docs/operations/telegram-tier-audit-2026-09-15.md`, `.env.example`.

## 1. Summary

- **Counts.** Keyless: **687 named news feeds**. 364 have the publisher's own RSS/Atom URL, 321 are Google News RSS queries only, and 2 are World Monitor-internal scraper routes. That is **768 distinct public feed URLs** (385 native, 383 Google News). **71 public Telegram channels** (63 `full` set + 8 `tech` set; TAKIP's keyless `t.me/s/` reader can likely read them, but no handle was tested), **91 live-news slots** (47 broadcaster HLS manifests, 31 pinned YouTube videos, 28 YouTube channel embeds; 7 slots empty) and **24 webcam slots** (YouTube videos). Free key: **1** (Telegram MTProto: `TELEGRAM_API_ID` + `TELEGRAM_API_HASH` + a logged-in `TELEGRAM_SESSION`; this is how World Monitor reads Telegram). Paid: **1** (X API v2 user timelines, 64 accounts). The pre-pass chunk lists 396 hosts and every one has no credential env var near it.
- **Licence.** The manifest has 398 host rows under 396 provider headings. 344 are `terms-review` ("verify before redistribution"). 37 are `reviewed` as headline + summary + timestamp + credit + link-out only. 16 are covered by World Monitor's own licence agreement (Business Insider, Business Wire, GlobeNewswire, PR Newswire, Chainwire, Coinbase, Binance, Fox Business, Handelsblatt, Welt, Telegraph, Interfax ×2, Jin10, Times of India, Wired), and TAKIP cannot inherit that agreement. 1 is US-government (ustr.gov). TAKIP should follow the same rule: store headline, summary, time and link; never full text.
- **Overlap with TAKIP.** 21 feeds are already in TAKIP (`news`, `conflicts`, `lib/oi/newsroom`, `lib/bulgaria-sources`). 30 come from a host TAKIP already reads but a different feed. 2 are sites TAKIP reads directly while World Monitor uses a Google News query. **634 are new.** Telegram: 4 of 71 handles overlap (OSINTdefender, DDGeopolitics, QudsNen, PressTV). Live video: 5 YouTube channel IDs are shared with `api/live-news`, and 9 more outlets are there under a different URL. `docs/data-sources.md` lists none of these feeds individually. Its "WHO disease outbreak news" row sits next to World Monitor's WHO news RSS.
- **Credibility tiers.** 388 of the 687 feeds have a declared tier (T1 40 · T2 216 · T3 123 · T4 9). 299 are deliberately undeclared and must not be read as tier 4. 33 feeds carry a state-affiliation flag; 13 of them are rated **high** propaganda risk.

### Top 10 picks for TAKIP
1. **Official alert channels on Telegram**: `PikudHaOref_all` (Israel Home Front Command), `InaTEWS_BMKG` (Indonesia quake/tsunami), `dsns_telegram` (Ukraine State Emergency Service), `kpszsu` (Ukraine Air Force air-raid/missile posts), `SaudiDCD`, `govsg`. They are geo-anchored and primary, and they plug into the existing `t.me/s/` reader in `api/news` with no new code path.
2. **The tiering and propaganda-risk model** (section 5): tier 1–4 plus a separate risk/state-affiliation axis plus a credibility formula with a cap on state media. It fits TAKIP's existing `lean`/`bloc` labels and gives them a numeric backbone.
3. **Google News RSS `site:` queries** as a keyless fallback for outlets without a usable feed (Reuters, AP, Kyiv Independent, ISW, Janes, USNI, Haaretz). The probe returned 200 with 116 kB of XML. The `when:Nd` window is tuned to each outlet's publishing rate.
4. **IAEA top news, WHO news, ICG CrisisWatch** (`iaea.org/feeds/topnews`, `who.int/rss-feeds/news-english.xml`, `crisisgroup.org/rss`): Tier 1/1/3 official and crisis feeds. All probed 200.
5. **ISW daily assessments** (GN `site:understandingwar.org`, T2, rated low risk) **plus the Oryx loss blog** (`oryxspioenkop.com/feeds/posts/default?alt=rss`, T2; probed 200, 876 kB). Both feed `frontlines`/`conflicts`.
6. **Investigative and illicit-finance desks**: OCCRP (probed 200), GITOC, The Sentry, DFRLab, Lighthouse Reports, VSquare, Correctiv, Bellingcat. All have native RSS except Bellingcat (GN). Good inputs for `entity` and `region-dossier`.
7. **Defense and maritime trade press TAKIP lacks**: gCaptain (probed 200), USNI News, Janes, Defense One, Military Times, Task & Purpose, and the UK MOD Atom feed (probed 200). This complements the TWZ, Defense News and Breaking Defense feeds TAKIP already has.
8. **Official US releases**: Federal Reserve `press_all.xml` (probed 200), SEC press releases, CISA advisories `all.xml`, White House and State Dept (GN). These feed `markets`, `cyber-threats` and `country-risk`.
9. **Regional crisis desks for under-covered places.** The national outlets are mapped to ISO2 in World Monitor's `source-geography.json`; the regional ones (Eurasianet, Times of Central Asia) are not. Sahel/Central Africa: Studio Tamani, leFaso.net, ActuNiger, Aïr Info, Radio Ndeke Luka, Radio Okapi. Sudan/Horn: Radio Tamazuj, Dabanga, Hiiraan, Ethiopia Insight. Levant/Yemen: Syria Direct, Sana'a Center, Naharnet, L'Orient Today. Caucasus/Central Asia: Civil.ge, OC Media, Eurasianet, Times of Central Asia. These give `region-dossier` local sources.
10. **Broadcaster-owned HLS masters** for `api/live-news`: DW, BBC News, NHK World, Al Jazeera (`getaj.net`), TRT World, tagesschau24, France 24. The BBC stream is likely limited to the UK. They are sturdier than YouTube embeds, which rot. The DW manifest probed 200 (`application/x-mpegURL`). For display only.

## Provider classes (brief format)

| Provider | Data (what one record is) | Endpoint pattern | Auth | Method | Licence posture | Geo + time | Cadence | TAKIP overlap | Feeds feature | Probe |
|---|---|---|---|---|---|---|---|---|---|---|
| Publisher RSS/Atom (364 feeds with a native URL; table below) | one headline item: title, link, pubDate, summary | publisher feed URL (RSS 2.0 or Atom) | none | poll | mostly terms-review; headline + link-out only | country+ts (by outlet's home country) | WM: per-feed cache 1 h healthy / 5 min if empty; digest 15 min | 21 already in, 30 same host, rest new | news, live-news, region-dossier, country-risk, oi | 8/8 native feeds 200 (10 probes in all, see below) |
| Google News RSS search (321 GN-only feeds; 383 GN URLs in all) | one aggregated headline; source name in `<source>` | `https://news.google.com/rss/search?q=<query>&hl=en-US&gl=US&ceid=US:en` (locale triplet varies) | none | poll | Google News terms; headline + link-out | country+ts | same as above; query carries `when:1d…30d` | new (TAKIP uses GDELT, not GN) | news fallback for outlets without RSS | 200 xml 116kB |
| Telegram public preview | one channel post (text, time, post id, media flag) | `https://t.me/s/<handle>` HTML | none | scrape | Telegram ToS; post text is third-party | none (geo-anchored only via the channel's remit) +ts | TAKIP already polls it | already in (`api/news`, 9 handles; 4 shared with WM) | news, frontlines, conflicts | not probed (TAKIP already uses it) |
| Telegram MTProto (WM's method) | same post, via API | GramJS user client, `getMessages` per channel | free key (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`) | poll | Telegram API ToS | as above | 60 s sequential cycle | new method | same | not probed |
| X API v2 | one post from a curated account | `GET /2/users/:id/tweets?since_id=` | paid | poll | X developer terms; WM treats post text as restricted (R4) and forbids scraping | none+ts | 5–15 min | new | — | not probed |
| Broadcaster HLS manifests (47) | a live TV stream | `.m3u8` master playlist | none | stream (display only) | broadcaster terms; presentation only | point (studio city) | live | 14 outlets in `api/live-news` (YouTube there) | live-news | DW 200 x-mpegURL 3kB |
| YouTube live (59 channel/video refs + 26 webcam videos) | an embeddable live player | `youtube.com/channel/UC…` embed, or `watch?v=<id>` | none | stream (display only); WM resolves the current live id by scraping `/channel/<id>/live` | YouTube embed terms | point+ts | WM re-resolves channel live ids by cron and audits daily | 5 channel ids shared | live-news, cctv-adjacent webcams | not probed |
| WM credibility registries (data, not an API) | tier per source name, risk + state flag + biases, ISO2 locality | `shared/source-tiers.json`, `shared/source-provenance.ts`, `shared/source-geography.json`, `shared/telegram-channel-trust.ts` | n/a | n/a | AGPL repo: re-derive the facts, don't copy files | n/a | n/a | new | news ranking, credibility labels | n/a |

### Probes (sequential, one GET each, brief's curl line)

| URL | Result |
|---|---|
| https://www.iaea.org/feeds/topnews | 200 rss 11kB |
| https://www.who.int/rss-feeds/news-english.xml | 200 rss 141kB |
| https://www.federalreserve.gov/feeds/press_all.xml | 200 xml 15kB |
| https://www.gov.uk/government/organisations/ministry-of-defence.atom | 200 atom 12kB |
| https://www.oryxspioenkop.com/feeds/posts/default?alt=rss | 200 rss 876kB (full Blogger history; use `max-results`) |
| https://www.occrp.org/en/feed | 200 rss 329kB |
| https://gcaptain.com/feed/ | 200 rss 12kB |
| https://www.crisisgroup.org/rss | 200 rss 8kB |
| GN `site:kyivindependent.com when:3d` | 200 xml 116kB |
| https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8 | 200 x-mpegURL 3kB |

### How World Monitor aggregates (method facts)
- A server-side digest per variant and language. It fetches at most 20 feeds at once, with an 8 s timeout per feed and a 25 s overall deadline. A healthy feed result is cached 1 h; an empty or failed one is retried after 5 min. The assembled digest is cached 15 min. It keeps at most 5 items per feed and 20 per category. XML is parsed with regexes (RSS `item` and Atom `entry`), and each item is keyword-classified at aggregation time. A small in-memory last-good cache covers Redis outages.
- A feed with a `lang` tag is only fetched for UI requests in that language, unless the feed is flagged a strategic default. A `deadlinePriority` hint only orders fetches in a cold build; it does not affect ranking.
- Publisher identity is the newsroom, not the transport. A GN `site:` query keeps the named publisher (and so its tier). A keyword GN query (for example "Oil & Gas" or "Sahel Crisis") names no publisher, so it gets no tier.
- Default-on balance rules. The English default set must always include at least 1 Ukrainian primary outlet and at least 1 independent Russian outlet. Russian/Chinese/Iranian state media (TASS, RT, Xinhua, IRNA, Mehr, Fars, Azertag, Armenpress) stay catalogued but opt-in only, and never appear in one-click "theater" presets.
- `source-geography.json` maps each feed name to the ISO2 countries it is *local* to: domestic outlets and exile outlets focused on that country. Global wires, regional desks, think tanks and keyword queries map to an empty list. World Monitor uses this for a coverage audit per key country. TAKIP could reuse the idea for `region-dossier` source selection.

## 2. Feed catalogue by region/topic

**How to read the columns**
- **Feed URL**: `GN \`q\`` means `https://news.google.com/rss/search?q=<url-encoded q>&hl=en-US&gl=US&ceid=US:en`. A `[hl/gl]` suffix replaces the locale triplet: `hl=<hl>&gl=<gl>&ceid=<gl>:<lang>`, for example `[uk/UA]` gives `hl=uk&gl=UA&ceid=UA:uk`. When an outlet has several feeds (one per language), each URL carries its language in parentheses. Server and client copies of a feed that differ only in the `when:` window are merged, and the server copy is shown.
- **Outlet · XX**: XX comes from World Monitor's `source-geography.json`. `~XX` is my inference from the ccTLD or GN locale (not World Monitor data). No suffix means global, regional or topical.
- **Tier**: World Monitor's declared tier (1 = wires and official bodies … 4 = aggregators and blogs). **—** means World Monitor declares no tier for that exact name: its tier lookup returns none, and its docs say an undeclared feed must not be treated as tier 4.
- **Flag**: `low`/`medium`/`**high**` is World Monitor's propaganda risk. `state: <country>` is its state-affiliation flag. Text after a second `·` is its declared known bias. `unreviewed` means the name is not in World Monitor's risk registry (it is fail-closed to "unknown"). The match is on the exact name, so for example RSS "Fars News" is unreviewed while Telegram "Fars News EN" is high and state: Iran.
- **Language**: the declared `lang` (World Monitor only fetches that feed for that UI language) or the GN `hl`. **—** means not language-scoped; almost all of these are English.
- **TAKIP overlap**: `already in (<file>)` means the exact feed URL is in TAKIP's non-test source. `same host in TAKIP (other feed)` means TAKIP reads a different feed on that host. `TAKIP reads this site's own feed` means World Monitor uses a GN `site:` query for a site whose own RSS TAKIP already reads. These are checked against `takip-hosts.txt`, filtered to hosts that appear in non-test files under `src/`, because the raw list includes test fixtures.
- Recorded as-is: "Ukrainska Pravda EN" is a GN `site:euromaidanpress.com` query in both of World Monitor's files, a different publisher from the outlet named. "Federal Reserve" is declared tier 3 and "U.S. Trade Representative" tier 1 with **high** risk: World Monitor rates official government publishers high-risk because their statements are primary government claims.

### World desks & wires (10)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| AP News | GN `site:apnews.com when:1d` | 1 | low | — | new |
| IAEA | https://www.iaea.org/feeds/topnews | 1 | unreviewed | — | new |
| Reuters World | GN `site:reuters.com world when:1d` | 1 | unreviewed | — | new |
| UNHCR | GN `site:unhcr.org OR UNHCR refugees when:3d` | 1 | unreviewed | — | new |
| WHO | https://www.who.int/rss-feeds/news-english.xml | 1 | unreviewed | — | new |
| BBC World · ~GB | https://feeds.bbci.co.uk/news/world/rss.xml | 2 | low | — | already in (conflicts, news, oi/newsroom) |
| CNN World | GN `site:cnn.com world news when:1d` | 2 | unreviewed | — | new |
| Guardian World | https://www.theguardian.com/world/rss | 2 | low | — | already in (news, oi/newsroom) |
| CrisisWatch | https://www.crisisgroup.org/rss | 3 | unreviewed | — | new |
| Trump - Truth Social | https://trumpstruth.org/feed | — | unreviewed | — | new |

### North America (US & Canada) (34)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| Calgary Herald · CA | https://calgaryherald.com/feed/ | 3 | low | — | new |
| CBC News · CA | https://www.cbc.ca/webfeed/rss/rss-world | 1 | **state: Canada** · medium | — | new |
| CP24 · CA | GN `site:cp24.com when:1d` [en-CA/CA] | 2 | low | — | new |
| CTV News · CA | GN `site:ctvnews.ca when:1d` [en-CA/CA] | 2 | low | — | new |
| Edmonton Journal · CA | https://edmontonjournal.com/feed/ | 3 | low | — | new |
| Financial Post · CA | https://financialpost.com/feed/ | 2 | low | — | new |
| Global News · CA | https://globalnews.ca/feed/ | 2 | low | — | new |
| Globe and Mail · CA | https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/?outputType=xml | 2 | low | — | new |
| iPolitics · CA | https://www.ipolitics.ca/feed | 3 | low | — | new |
| La Presse · CA | https://www.lapresse.ca/actualites/rss | 2 | low | fr | new |
| Le Devoir · CA | https://www.ledevoir.com/rss/manchettes.xml | 2 | low | fr | new |
| Maclean's · CA | https://macleans.ca/feed/ | 3 | low | — | new |
| Montreal Gazette · CA | GN `site:montrealgazette.com when:1d` [en-CA/CA] | 2 | low | — | new |
| National Post · CA | https://nationalpost.com/feed/ | 2 | low | — | new |
| Ottawa Citizen · CA | https://ottawacitizen.com/feed/ | 3 | low | — | new |
| Radio-Canada · CA | https://ici.radio-canada.ca/info/rss/info/en-continu | 1 | **state: Canada** · medium | fr | new |
| The Narwhal · CA | https://thenarwhal.ca/feed/ | 3 | low | — | new |
| The Province · CA | https://theprovince.com/feed/ | 2 | low | — | new |
| The Tyee · CA | https://thetyee.ca/rss2.xml | 3 | low | — | new |
| Toronto Star · CA | https://www.thestar.com/search/?f=rss&t=article&c=news/canada | 2 | low | — | new |
| TVA Nouvelles · CA | https://www.tvanouvelles.ca/rss.xml | 2 | low | fr | new |
| Vancouver Sun · CA | https://vancouversun.com/feed/ | 3 | low | — | new |
| Winnipeg Free Press · CA | https://www.winnipegfreepress.com/feed | 3 | low | — | new |
| ABC News · US | https://feeds.abcnews.com/abcnews/topstories | 2 | unreviewed | — | new |
| Axios · US | https://api.axios.com/feed/ | 2 | unreviewed | — | new |
| CBS News · US | https://www.cbsnews.com/latest/rss/main | 2 | unreviewed | — | new |
| Fox News · US | https://moxie.foxnews.com/google-publisher/us.xml | 2 | unreviewed | — | new |
| NBC News · US | https://feeds.nbcnews.com/nbcnews/public/news | 2 | unreviewed | — | new |
| NPR News · US | https://feeds.npr.org/1001/rss.xml | 2 | unreviewed | — | already in (oi/newsroom) |
| PBS NewsHour · US | https://www.pbs.org/newshour/feeds/rss/headlines | 2 | unreviewed | — | new |
| Politico · US | https://rss.politico.com/politics-news.xml | 2 | unreviewed | — | already in (oi/newsroom) |
| Reuters US · US | GN `site:reuters.com US when:1d` | 1 | unreviewed | — | new |
| The Hill · US | https://thehill.com/news/feed | 3 | unreviewed | — | same host in TAKIP (other feed) |
| Wall Street Journal · US | https://feeds.content.dowjones.io/public/rss/RSSUSnews | 1 | unreviewed | — | same host in TAKIP (other feed) |

### US government & intergovernmental bodies (14)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| CISA | https://www.cisa.gov/cybersecurity-advisories/all.xml | 1 | unreviewed | — | same host in TAKIP (other feed) |
| Pentagon | https://www.war.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945 | 1 | unreviewed | — | new |
| State Dept | GN `(site:state.gov OR "State Department") when:1d`<br>GN `site:state.gov OR "State Department"` | 1 | unreviewed | — | new |
| U.S. Trade Representative | https://ustr.gov/rss.xml | 1 | **state: USA** · **high** | — | new |
| UN News | https://news.un.org/feed/subscribe/en/news/all/rss.xml | 1 | unreviewed | — | new |
| White House | https://www.whitehouse.gov/briefings-statements/feed/ | 1 | unreviewed | — | new |
| White House Actions | https://www.whitehouse.gov/presidential-actions/feed/ | 1 | unreviewed | — | new |
| CDC | GN `site:cdc.gov OR CDC health` | 2 | unreviewed | — | new |
| DHS | GN `site:dhs.gov OR "Homeland Security"` | 2 | unreviewed | — | new |
| DOJ | GN `site:justice.gov when:1d`<br>GN `site:justice.gov OR "Justice Department" DOJ` | 2 | unreviewed | — | new |
| FEMA | GN `site:fema.gov OR FEMA emergency` | 2 | unreviewed | — | new |
| Treasury | GN `site:treasury.gov when:1d`<br>GN `site:treasury.gov OR "Treasury Department"` | 2 | unreviewed | — | new |
| Federal Reserve | https://www.federalreserve.gov/feeds/press_all.xml | 3 | unreviewed | — | new |
| SEC | https://www.sec.gov/news/pressreleases.rss | 3 | unreviewed | — | new |

### Europe, Ukraine/Russia, Caucasus, Türkiye (99)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| Armenpress · AM | GN `site:armenpress.am when:3d` | 1 | **state: Armenia** · **high** | — | new |
| JAMnews · AM, AZ, GE | https://jam-news.net/feed/ | 3 | medium | — | new |
| OC Media · AM, AZ, GE | https://oc-media.org/feed/ | 2 | low | — | new |
| Azertag · AZ | GN `site:azertag.az when:3d` | 1 | **state: Azerbaijan** · **high** | — | new |
| Dnevnik · BG | https://www.dnevnik.bg/rss/ | 2 | low | bg | already in (bulgaria-sources) |
| Zerkalo · BY | GN `site:zerkalo.io when:2d` | 2 | low | — | new |
| Seznam Zprávy · CZ | https://www.seznamzpravy.cz/rss | 2 | low | cs | new |
| Bild · DE | https://www.bild.de/feed/alles.xml | — | unreviewed | de | new |
| Der Spiegel · DE | https://www.spiegel.de/schlagzeilen/tops/index.rss | 2 | unreviewed | de | new |
| Die Zeit · DE | https://newsfeed.zeit.de/index | 2 | unreviewed | de | new |
| DW News · DE | https://rss.dw.com/xml/rss-en-all<br>https://rss.dw.com/xml/rss-de-all (de)<br>GN `site:dw.com/es` [es-419/MX] (es) | 2 | **state: Germany** · medium | de, es | same host in TAKIP (other feed) |
| Tagesschau · DE | https://www.tagesschau.de/xml/rss2/ | 1 | unreviewed | de | new |
| Welt · ~DE | https://www.welt.de/feeds/latest.rss | 2 | low | de | new |
| DR Nyheder · DK | https://www.dr.dk/nyheder/service/feeds/allenyheder | 1 | **state: Denmark** · medium | — | new |
| ERR News · EE | https://news.err.ee/rss | 2 | low | — | new |
| El Mundo · ~ES | https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml | 2 | unreviewed | es | new |
| Yle News · FI | https://yle.fi/rss/news | 1 | **state: Finland** · medium | — | new |
| France 24 · FR | https://www.france24.com/en/rss<br>https://www.france24.com/fr/rss (fr)<br>https://www.france24.com/es/rss (es)<br>https://www.france24.com/ar/rss (ar) | 2 | **state: France** · medium | ar, es, fr | already in (oi/newsroom) |
| Le Monde · FR | https://www.lemonde.fr/en/rss/une.xml<br>https://www.lemonde.fr/rss/une.xml (fr) | 2 | low | fr | new |
| Telegraph · ~GB | https://www.telegraph.co.uk/rss.xml | 2 | low | — | new |
| Civil.ge · GE | https://civil.ge/feed/ | 2 | low | — | new |
| AMNA · ~GR | GN `site:amna.gr when:2d` [el/GR] | 1 | **state: Greece** · medium | el | new |
| CNN Greece · ~GR | GN `site:cnn.gr when:2d` [el/GR] | 2 | unreviewed | el | new |
| ERT · ~GR | GN `site:ert.gr when:2d` [el/GR] | 1 | **state: Greece** · medium | el | new |
| iefimerida · ~GR | https://www.iefimerida.gr/rss.xml | 3 | unreviewed | el | new |
| in.gr · ~GR | https://www.in.gr/feed/ | 3 | unreviewed | el | new |
| Kathimerini · ~GR | GN `site:kathimerini.gr when:2d` [el/GR] | 2 | unreviewed | el | new |
| Liberal GR · ~GR | GN `site:liberal.gr when:2d` [el/GR] | 2 | unreviewed | el | new |
| Naftemporiki · ~GR | https://www.naftemporiki.gr/feed/ | 2 | unreviewed | el | new |
| Proto Thema · ~GR | GN `site:protothema.gr when:2d` [el/GR] | 3 | unreviewed | el | new |
| Ta Nea · ~GR | https://www.tanea.gr/feed/ | 2 | unreviewed | el | new |
| Index.hr · ~HR | https://www.index.hr/rss | 2 | unreviewed | hr | new |
| Jutarnji list · ~HR | https://www.jutarnji.hr/feed | 2 | unreviewed | hr | new |
| N1 Croatia · ~HR | https://n1info.hr/feed/ | 2 | unreviewed | hr | new |
| 24.hu · ~HU | https://24.hu/feed/ | 2 | unreviewed | hu | new |
| 444.hu · ~HU | https://444.hu/feed | 2 | unreviewed | hu | new |
| ATV · ~HU | https://www.atv.hu/rss | 2 | unreviewed | hu | new |
| HVG · ~HU | https://hvg.hu/rss | 2 | unreviewed | hu | new |
| Híradó · ~HU | GN `site:hirado.hu when:2d` [hu/HU] | 2 | unreviewed | hu | new |
| Index.hu · ~HU | https://index.hu/24ora/rss | 2 | unreviewed | hu | new |
| Portfolio.hu · ~HU | https://portfolio.hu/rss/all.xml | 2 | unreviewed | hu | new |
| Telex · ~HU | https://telex.hu/rss | 2 | unreviewed | hu | new |
| ANSA · IT | https://www.ansa.it/sito/ansait_rss.xml (it)<br>https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml (it) | 1 | unreviewed | it | new |
| Corriere della Sera · IT | https://www.corriere.it/rss/homepage.xml | 2 | unreviewed | it | new |
| Repubblica · IT | https://www.repubblica.it/rss/homepage/rss2.0.xml | 2 | unreviewed | it | new |
| LRT English · LT | https://www.lrt.lt/en/news-in-english?rss | 2 | low | — | new |
| LSM English · LV | https://eng.lsm.lv/rss/ | 2 | low | — | new |
| NewsMaker · MD | https://newsmaker.md/feed | 2 | medium | ru | new |
| Ziarul de Gardă · MD | https://www.zdg.md/feed/ | 3 | medium | ro | new |
| De Telegraaf · ~NL | GN `site:telegraaf.nl when:1d` [nl/NL] | 2 | unreviewed | nl | new |
| NOS Nieuws · ~NL | https://feeds.nos.nl/nosnieuwsalgemeen | 1 | unreviewed | nl | new |
| NRC · ~NL | https://www.nrc.nl/rss/ | 2 | unreviewed | nl | new |
| Aftenposten · NO | https://www.aftenposten.no/rss | 2 | low | — | new |
| NRK · NO | https://www.nrk.no/nyheter/siste.rss | 1 | **state: Norway** · medium | — | new |
| Gazeta Wyborcza · PL | GN `site:wyborcza.pl when:2d` [pl/PL] | 1 | low | pl | new |
| OKO.press · PL | https://oko.press/feed | 2 | low | pl | new |
| Onet · PL | GN `site:wiadomosci.onet.pl when:2d` [pl/PL] | 2 | low | pl | new |
| PAP · PL | GN `site:pap.pl when:2d` [pl/PL] | 1 | **state: Poland** · medium | pl | new |
| Polityka · PL | GN `site:polityka.pl when:2d` [pl/PL] | 2 | low | pl | new |
| Polsat News · PL | https://www.polsatnews.pl/rss/wszystkie.xml | 2 | unreviewed | pl | new |
| Rzeczpospolita · PL | https://www.rp.pl/rss_main | 2 | unreviewed | — | new |
| TVN24 · PL | https://tvn24.pl/swiat.xml | 2 | unreviewed | — | new |
| TVP Info · PL | GN `site:tvp.info when:2d` [pl/PL] | 2 | **state: Poland** · medium | pl | new |
| Digi24 · RO | https://www.digi24.ro/rss | 2 | low | ro | new |
| G4Media · RO | https://www.g4media.ro/feed/ | 2 | low | ro | new |
| HotNews · RO | https://www.hotnews.ro/rss | 2 | low | ro | new |
| BBC Russian · RU | https://feeds.bbci.co.uk/russian/rss.xml | 2 | unreviewed | ru | same host in TAKIP (other feed) |
| Interfax RU · ~RU | https://www.interfax.ru/rss.asp | 1 | medium | ru | new |
| Meduza · RU | https://meduza.io/rss/en/all<br>https://meduza.io/rss/all (ru) | 2 | low · Anti-Kremlin | ru | new |
| Moscow Times · RU | https://www.themoscowtimes.com/rss/news | — | medium · Anti-Kremlin | — | new |
| Novaya Gazeta Europe · RU | https://novayagazeta.eu/feed/rss | 2 | unreviewed | ru | new |
| RT · RU | https://www.rt.com/rss/ | 3 | **state: Russia** · **high** | — | new |
| RT Russia · RU | https://www.rt.com/rss/russia/ | 3 | **state: Russia** · **high** | — | new |
| TASS · RU | GN `site:tass.com OR TASS Russia when:1d` | 3 | **state: Russia** · **high** | — | TAKIP reads this site's own feed |
| Dagens Nyheter · ~SE | https://www.dn.se/rss/ | 2 | unreviewed | sv | new |
| Svenska Dagbladet · ~SE | https://www.svd.se/feed/articles.rss | 2 | unreviewed | sv | new |
| SVT Nyheter · ~SE | https://www.svt.se/nyheter/rss.xml | 1 | unreviewed | sv | new |
| BBC Turkce · TR | https://feeds.bbci.co.uk/turkce/rss.xml | 2 | unreviewed | tr | same host in TAKIP (other feed) |
| Daily Sabah · TR | https://www.dailysabah.com/rss/home-page | 2 | **state: Turkey** · medium | — | new |
| DW Turkish · TR | https://rss.dw.com/xml/rss-tur-all | 2 | unreviewed | tr | same host in TAKIP (other feed) |
| Hurriyet · TR | https://www.hurriyet.com.tr/rss/anasayfa | 2 | unreviewed | tr | new |
| Bihus.Info · UA | GN `site:bihus.info when:7d` [uk/UA] | 2 | medium · Pro-Ukraine | uk | new |
| Hromadske · UA | GN `site:hromadske.ua when:3d` [uk/UA] | 2 | medium · Pro-Ukraine | uk | new |
| Hromadske EN · UA | GN `site:hromadske.ua when:3d` | 2 | medium · Pro-Ukraine | — | new |
| Kyiv Independent · UA | GN `site:kyivindependent.com when:3d` | — | medium · Pro-Ukraine | — | new |
| NV EN · UA | GN `site:english.nv.ua when:2d` | 2 | medium · Pro-Ukraine | — | new |
| Slidstvo.Info · UA | GN `site:slidstvo.info when:7d` [uk/UA] | 2 | medium · Pro-Ukraine | uk | new |
| Suspilne · UA | GN `site:suspilne.media when:2d`<br>GN `site:suspilne.media when:2d` [uk/UA] (uk) | 1 | **state: Ukraine** · medium | uk | new |
| Ukrainska Pravda · UA | GN `site:pravda.com.ua when:2d` [uk/UA] | 2 | medium · Pro-Ukraine | uk | new |
| Ukrainska Pravda EN · UA | GN `site:euromaidanpress.com when:2d` | 2 | medium · Pro-Ukraine | — | new |
| Ukrinform · UA | GN `site:ukrinform.net when:3d`<br>GN `site:ukrinform.ua when:3d` [uk/UA] (uk) | 1 | **state: Ukraine** · **high** | uk | new |
| ZN.UA · UA | GN `site:zn.ua when:3d` [uk/UA] | 2 | medium · Pro-Ukraine | uk | new |
| Arctic Today | GN `site:arctictoday.com when:14d` | 2 | low | — | new |
| Balkan Insight | https://balkaninsight.com/feed/ | 1 | unreviewed | — | new |
| BBC Mundo | https://www.bbc.com/mundo/index.xml | 2 | unreviewed | es | new |
| El País | https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada | 2 | unreviewed | es | new |
| EuroNews | https://www.euronews.com/rss?format=xml<br>https://fr.euronews.com/rss?format=xml (fr)<br>https://de.euronews.com/rss?format=xml (de)<br>https://it.euronews.com/rss?format=xml (it)<br>https://es.euronews.com/rss?format=xml (es)<br>https://pt.euronews.com/rss?format=xml (pt)<br>https://ru.euronews.com/rss?format=xml (ru)<br>https://gr.euronews.com/rss?format=xml (gr) | 2 | low · Pro-EU | de, es, fr, gr, it, pt, ru | new |
| Handelsblatt | https://www.handelsblatt.com/contentexport/feed/schlagzeilen | 2 | low | de | new |
| Interfax EN | GN `site:interfax.com when:7d` | 1 | medium | — | new |

### Middle East & North Africa (30)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| The National · AE | https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml<br>GN `site:thenationalnews.com (Abu Dhabi OR UAE OR Saudi) when:7d`<br>GN `site:thenationalnews.com when:2d` | 2 | unreviewed | — | new |
| Egypt Independent · EG | https://www.egyptindependent.com/feed/ | 2 | medium | — | new |
| Mada Masr · EG | GN `site:madamasr.com when:30d` | 2 | medium | — | new |
| BBC Middle East · ~GB | https://feeds.bbci.co.uk/news/world/middle_east/rss.xml | 2 | low | — | same host in TAKIP (other feed) |
| Haaretz · IL | GN `site:haaretz.com when:7d` | — | unreviewed | — | new |
| Jerusalem Post · IL | https://www.jpost.com/rss/rssfeedsheadlines.aspx | — | low | — | new |
| Ynetnews · IL | https://www.ynetnews.com/Integration/StoryRss3089.xml | — | low · Israeli mainstream | — | new |
| +972 Magazine · IL, PS | https://www.972mag.com/feed/ | 2 | medium · Israeli-Palestinian human-rights perspective | — | new |
| Rudaw · IQ | GN `site:rudaw.net when:7d` | — | unreviewed | — | new |
| BBC Persian · IR | https://feeds.bbci.co.uk/persian/rss.xml | 2 | unreviewed | fa | same host in TAKIP (other feed) |
| Fars News · IR | GN `site:farsnews.ir when:2d` | 3 | unreviewed | — | new |
| Iran International · IR | GN `site:iranintl.com when:2d` | 3 | unreviewed | — | new |
| IRNA · IR | https://en.irna.ir/rss | — | **state: Iran** · **high** | — | new |
| Mehr News · IR | https://en.mehrnews.com/rss | — | **state: Iran** · **high** | — | new |
| Annahar · LB | GN `site:annahar.com/lebanon when:7d` [ar/LB] | 2 | low | ar | new |
| L'Orient Today · LB | GN `site:lorientlejour.com Lebanon when:7d` | 2 | low | — | new |
| Naharnet Lebanon · LB | https://www.naharnet.com/tags/lebanon/en/feed.atom | 2 | low | — | new |
| Libya Herald · LY | https://libyaherald.com/rss.xml | 2 | medium | — | new |
| Oman Observer · OM | https://www.omanobserver.om/rssFeed/1 | — | unreviewed | — | new |
| WAFA English · PS | GN `site:english.wafa.ps when:7d` | 3 | **state: Palestine** · **high** | — | new |
| Arab News · SA | GN `site:arabnews.com when:7d`<br>GN `site:arabnews.com (Saudi Arabia OR investment OR infrastructure) when:7d` | — | unreviewed | — | new |
| Asharq Business · SA | https://asharqbusiness.com/rss.xml | — | unreviewed | — | new |
| Asharq News · SA | https://asharq.com/snapchat/rss.xml | — | unreviewed | ar | new |
| Enab Baladi English · SY | GN `site:english.enabbaladi.net when:14d` | 2 | medium · Syrian opposition perspective | — | new |
| Syria Direct · SY | https://syriadirect.org/feed/ | 2 | low | — | new |
| Sana'a Center · YE | https://sanaacenter.org/feed/ | 2 | low | — | new |
| Yemen Online · YE | GN `site:yemenonline.info when:14d` | 2 | medium | — | new |
| Al Arabiya | GN `site:english.alarabiya.net when:2d`<br>https://www.alarabiya.net/tools/mrss/?cat=main (ar) | — | **state: Saudi Arabia** · medium | ar | new |
| Al Jazeera | https://www.aljazeera.com/xml/rss/all.xml<br>https://www.aljazeera.net/aljazeerarss/a7c186be-1adb-4b11-a982-4783e765316e/4e17ecdc-8fb9-40de-a5d6-d00f72384a51 (ar) | 2 | **state: Qatar** · medium | ar | already in (conflicts, news, oi/newsroom) |
| Guardian ME | https://www.theguardian.com/world/middleeast/rss | 2 | unreviewed | — | same host in TAKIP (other feed) |

### Sub-Saharan Africa & Sahel (34)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| leFaso.net · BF | https://lefaso.net/spip.php?page=backend | 2 | low | fr | new |
| Actualite.cd · CD | https://actualite.cd/feed | 3 | unreviewed | fr | new |
| Radio Okapi · CD | https://www.radiookapi.net/rss.xml | 3 | unreviewed | fr | new |
| Radio Ndeke Luka · CF | https://www.radiondekeluka.org/feed/ | 2 | low | fr | new |
| The Guardian Post · CM | GN `site:theguardianpostcameroon.com when:30d` | 2 | medium | — | new |
| Ethiopia Insight · ET | https://www.ethiopia-insight.com/feed/ | 3 | unreviewed | — | new |
| The Reporter Ethiopia · ET | https://www.thereporterethiopia.com/feed/ | 3 | unreviewed | — | new |
| RFI Afrique · ~FR | https://www.rfi.fr/en/africa/rss | 2 | unreviewed | — | new |
| BBC Africa · ~GB | https://feeds.bbci.co.uk/news/world/africa/rss.xml | — | unreviewed | — | same host in TAKIP (other feed) |
| Citi Newsroom · GH | GN `site:citinewsroom.com when:7d` | 3 | unreviewed | — | new |
| MyJoyOnline · GH | https://www.myjoyonline.com/feed/ | 2 | unreviewed | — | new |
| Daily Nation · KE | https://nation.africa/kenya/rss.xml | 2 | low | — | new |
| Studio Tamani · ML | https://www.studiotamani.org/feed/ | 2 | low | fr | new |
| ActuNiger · NE | GN `site:actuniger.com Niger when:7d` [fr/FR] | 2 | medium | fr | new |
| Aïr Info · NE | https://airinfoagadez.com/feed/ | 2 | low | fr | new |
| Channels TV · NG | https://www.channelstv.com/feed/ | 2 | unreviewed | — | new |
| Daily Trust · NG | https://dailytrust.com/feed/ | 3 | unreviewed | — | new |
| Premium Times · NG | https://www.premiumtimesng.com/feed | 2 | unreviewed | — | new |
| ThisDay · NG | https://www.thisdaylive.com/feed | 2 | unreviewed | — | new |
| Vanguard Nigeria · NG | https://www.vanguardngr.com/feed/ | 2 | unreviewed | — | new |
| Dabanga Sudan · SD | https://www.dabangasudan.org/en/feed | 3 | unreviewed | — | new |
| Radio Tamazuj · SD, SS | https://www.radiotamazuj.org/en/feed | 3 | unreviewed | — | new |
| Le Quotidien · SN | https://lequotidien.sn/feed/ | 3 | unreviewed | fr | new |
| Hiiraan Online · SO | GN `site:hiiraan.com when:7d` | 3 | unreviewed | — | new |
| Alwihda Info · TD | https://www.alwihdainfo.com/rss/ | 2 | medium | fr | new |
| Tchadinfos · TD | https://tchadinfos.com/feed/ | 2 | medium | fr | new |
| News24 · ZA | https://feeds.news24.com/articles/news24/TopStories/rss | — | unreviewed | — | new |
| Africa News | GN `(Africa OR Nigeria OR Kenya OR "South Africa" OR Ethiopia) when:2d` | — | unreviewed | — | new |
| Africanews | https://www.africanews.com/feed/<br>https://www.africanews.com/feed/rss (en)<br>https://fr.africanews.com/feed/rss (fr) | — | unreviewed | en, fr | already in (news) |
| BBC Afrique | https://www.bbc.com/afrique/index.xml | — | unreviewed | fr | new |
| France 24 Africa | https://www.france24.com/en/africa/rss | 2 | **state: France** · medium | — | same host in TAKIP (other feed) |
| Guardian Africa | https://www.theguardian.com/world/africa/rss | 2 | low | — | same host in TAKIP (other feed) |
| Jeune Afrique | https://www.jeuneafrique.com/feed/ | — | unreviewed | fr | new |
| Sahel Crisis | GN `(Sahel OR Mali OR Niger OR "Burkina Faso" OR Wagner) when:3d` | — | unreviewed | — | new |

### Latin America & Caribbean (25)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| Clarín · AR | https://www.clarin.com/rss/lo-ultimo/ | — | unreviewed | es | new |
| Infobae Americas · AR | https://www.infobae.com/arc/outboundfeeds/rss/ | — | unreviewed | es | new |
| Brasil Paralelo · BR | https://www.brasilparalelo.com.br/noticias/rss.xml | 2 | low | pt | new |
| Folha de S.Paulo · BR | https://feeds.folha.uol.com.br/emcimadahora/rss091.xml | — | unreviewed | pt | new |
| O Globo · BR | GN `site:oglobo.globo.com when:1d` [pt-BR/BR] | — | unreviewed | pt | new |
| El Tiempo · CO | https://www.eltiempo.com/rss/mundo_latinoamerica.xml | — | unreviewed | es | new |
| La Silla Vacía · CO | https://www.lasillavacia.com/rss | 3 | unreviewed | — | new |
| 14ymedio · CU | https://www.14ymedio.com/rss/ | 2 | medium · Cuban opposition perspective | es | new |
| Havana Times · CU | https://havanatimes.org/feed/ | 2 | medium · Independent Cuban perspective | — | new |
| Primicias · ~EC | https://www.primicias.ec/feed/ | — | unreviewed | es | new |
| BBC Latin America · ~GB | https://feeds.bbci.co.uk/news/world/latin_america/rss.xml | — | unreviewed | — | same host in TAKIP (other feed) |
| AyiboPost · HT | GN `site:ayibopost.com Haiti when:14d` [fr/FR] | 2 | low | fr | new |
| HaitiLibre English · HT | https://www.haitilibre.com/rss-flash-en.php | 2 | medium | — | new |
| Mexico News Daily · MX | https://mexiconewsdaily.com/feed/ | 2 | low | — | new |
| Caracas Chronicles · VE | https://www.caracaschronicles.com/feed/ | 2 | medium · Opposition-leaning Venezuela analysis | — | new |
| Efecto Cocuyo · VE | https://efectococuyo.com/feed/ | 2 | low | es | new |
| AP Mexico | GN `site:apnews.com Mexico when:3d` | — | unreviewed | — | new |
| El Universo | https://www.eluniverso.com/arc/outboundfeeds/rss/category/noticias/?outputType=xml | — | unreviewed | es | new |
| France 24 LatAm | https://www.france24.com/en/americas/rss | 2 | **state: France** · medium | — | same host in TAKIP (other feed) |
| Guardian Americas | https://www.theguardian.com/world/americas/rss | — | unreviewed | — | same host in TAKIP (other feed) |
| Guardian Caribbean | https://www.theguardian.com/world/caribbean/rss | 2 | low | — | same host in TAKIP (other feed) |
| InSight Crime | https://insightcrime.org/feed/ | — | unreviewed | — | new |
| Latin America | GN `(Brazil OR Mexico OR Argentina OR Venezuela OR Colombia OR Haiti) when:2d` | — | unreviewed | — | new |
| Mexico Security | GN `(Mexico cartel OR Mexico violence OR Mexico troops OR narco Mexico) when:2d` | — | unreviewed | — | new |
| Reuters LatAm | GN `site:reuters.com (Brazil OR Mexico OR Argentina) when:3d` | — | unreviewed | — | new |

### Asia-Pacific, South & Central Asia (50)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| Amu TV · AF | https://amu.tv/feed/ | 2 | medium | — | new |
| Pajhwok Afghan News · AF | GN `site:pajhwok.com Afghanistan when:7d` | 2 | medium | — | new |
| ABC News Australia · AU | https://www.abc.net.au/news/feed/2942460/rss.xml | 2 | unreviewed | — | new |
| Guardian Australia · AU | https://www.theguardian.com/australia-news/rss | 2 | unreviewed | — | same host in TAKIP (other feed) |
| Dhaka Tribune · BD | GN `site:dhakatribune.com when:14d` | 2 | low | — | new |
| The Daily Star · BD | GN `site:thedailystar.net when:14d` | 2 | low | — | new |
| MIIT (China) · CN | (WM-internal `/api/miit-news` route, not a public feed) | 1 | **state: China** · **high** | zh | new |
| MOFCOM (China) · CN | GN `site:mofcom.gov.cn when:7d` [zh-CN/CN] | 1 | **state: China** · **high** | zh | new |
| South China Morning Post · CN | GN `site:scmp.com when:2d`<br>https://www.scmp.com/rss/91/feed/ | — | unreviewed | — | already in (news) |
| Xinhua · CN | GN `site:xinhuanet.com OR Xinhua when:1d` | 3 | **state: China** · **high** | — | new |
| BBC Asia · ~GB | https://feeds.bbci.co.uk/news/world/asia/rss.xml | — | unreviewed | — | same host in TAKIP (other feed) |
| Jakarta Post · ID | GN `site:thejakartapost.com when:3d` | 2 | unreviewed | — | new |
| Aaj Tak · IN | https://www.aajtak.in/rssfeeds/?id=home | 2 | unreviewed | hi | new |
| Amar Ujala · IN | https://www.amarujala.com/rss/national.xml | 2 | unreviewed | hi | new |
| BBC Hindi · IN | https://feeds.bbci.co.uk/hindi/rss.xml | 2 | unreviewed | hi | same host in TAKIP (other feed) |
| Indian Express · IN | https://indianexpress.com/section/india/feed/ | — | unreviewed | — | new |
| NDTV · IN | https://feeds.feedburner.com/ndtvnews-top-stories | — | unreviewed | — | new |
| NDTV India · IN | https://feeds.feedburner.com/ndtvkhabar-latest | 2 | unreviewed | hi | new |
| Reuters India · IN | GN `site:reuters.com India when:3d` | 1 | unreviewed | — | new |
| The Hindu · IN | https://www.thehindu.com/feeder/default.rss<br>https://www.thehindu.com/news/national/feeder/default.rss (en) | — | unreviewed | en | new |
| Times of India · IN | https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms | 2 | low | en | new |
| Asia News · ~IT | GN `site:asianews.it when:3d`<br>GN `(China OR Japan OR Korea OR India OR ASEAN) when:2d` | — | unreviewed | — | new |
| Asahi Shimbun · JP | https://www.asahi.com/rss/asahi/newsheadlines.rdf | — | unreviewed | ja | new |
| Japan Today · JP | https://japantoday.com/feed/atom | — | unreviewed | — | new |
| Nikkei Asia · JP | GN `site:asia.nikkei.com when:3d`<br>GN `site:asia.nikkei.com markets when:3d` | 2 | unreviewed | — | new |
| Chosun Ilbo · KR | https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml | 2 | unreviewed | ko | new |
| Yonhap News · KR | https://www.yonhapnewstv.co.kr/browse/feed/ | 2 | unreviewed | ko | new |
| The Astana Times · KZ | https://astanatimes.com/feed/ | 2 | **state: Kazakhstan** · medium | — | new |
| Irrawaddy · MM | https://www.irrawaddy.com/feed/ | 3 | unreviewed | — | new |
| The Star (Malaysia) · MY | GN `site:thestar.com.my when:3d` | 2 | unreviewed | — | new |
| Rappler · PH | https://www.rappler.com/feed/ | 2 | unreviewed | — | new |
| Dawn · PK | https://www.dawn.com/feeds/home/ | 2 | unreviewed | — | new |
| Geo News · PK | GN `site:geo.tv when:2d` | 2 | unreviewed | — | new |
| Island Times (Palau) · PW | https://islandtimes.org/feed/ | — | unreviewed | — | new |
| CNA · SG | https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml | — | unreviewed | — | already in (news) |
| Focus Taiwan · TW | GN `site:focustaiwan.tw when:3d` | 1 | unreviewed | — | new |
| Taipei Times · TW | GN `site:taipeitimes.com when:3d` | 2 | unreviewed | — | new |
| Taiwan News · TW | GN `site:taiwannews.com.tw when:3d` | 2 | unreviewed | — | new |
| Tuoi Tre News · ~VN | https://news.tuoitre.vn/rss | 2 | unreviewed | vi | new |
| Bangkok Post | GN `site:bangkokpost.com when:1d` | 2 | unreviewed | th | new |
| Eurasianet | https://eurasianet.org/rss | 2 | medium | — | new |
| France 24 Asia Pacific | https://www.france24.com/en/asia-pacific/rss | 2 | **state: France** · medium | — | same host in TAKIP (other feed) |
| Guardian Pacific | https://www.theguardian.com/world/pacific-islands/rss | 2 | low | — | same host in TAKIP (other feed) |
| India News Network | GN `India diplomacy foreign policy news` | — | unreviewed | — | new |
| Reuters Asia | GN `site:reuters.com (China OR Japan OR Taiwan OR Korea) when:3d` | — | unreviewed | — | new |
| RFE/RL Central Asia | GN `site:rferl.org Central+Asia when:3d`<br>GN `site:rferl.org Central Asia when:3d` | 2 | **state: USA** · medium | — | new |
| Thai PBS | GN `Thai PBS World news` | 2 | unreviewed | th | new |
| The Diplomat | https://thediplomat.com/feed/ | 3 | unreviewed | — | new |
| The Times of Central Asia | https://timesca.com/feed/ | 3 | medium | — | new |
| VnExpress | https://vnexpress.net/rss/tin-moi-nhat.rss | 2 | unreviewed | vi | new |

### Defense, intelligence, OSINT, investigations & think tanks (63)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| UK MOD · ~GB | https://www.gov.uk/government/organisations/ministry-of-defence.atom | 1 | unreviewed | — | new |
| Arms Control Assn | GN `site:armscontrol.org when:7d` | 2 | unreviewed | — | new |
| Bulletin of Atomic Scientists | GN `site:thebulletin.org when:7d` | 2 | unreviewed | — | new |
| CNAS | GN `site:cnas.org when:7d` | 2 | unreviewed | — | new |
| DFRLab | https://dfrlab.org/feed/ | 2 | unreviewed | — | new |
| DigiChina | GN `DigiChina Stanford China technology` | 2 | unreviewed | — | new |
| FAO GIEWS | GN `site:fao.org GIEWS food security when:30d` | 2 | unreviewed | — | new |
| ISW | GN `site:understandingwar.org when:2d` | 2 | low | — | new |
| Military Times | https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml | 2 | unreviewed | — | new |
| OCCRP | https://www.occrp.org/en/feed | 2 | unreviewed | — | new |
| OECD Digital | GN `site:oecd.org digital OR AI when:14d` | 2 | unreviewed | — | new |
| Oryx OSINT | https://www.oryxspioenkop.com/feeds/posts/default?alt=rss | 2 | unreviewed | — | new |
| RUSI | GN `site:rusi.org when:3d` | 2 | unreviewed | — | new |
| Stanford HAI | GN `site:hai.stanford.edu when:14d` | 2 | unreviewed | — | new |
| USNI News | GN `site:news.usni.org when:3d` | 2 | unreviewed | — | new |
| War on the Rocks | https://warontherocks.com/feed/ | 2 | unreviewed | — | new |
| AI Now Institute | GN `"AI Now Institute"` | 3 | unreviewed | — | new |
| Atlantic Council | https://www.atlanticcouncil.org/feed/ | 3 | unreviewed | — | new |
| Bellingcat | GN `site:bellingcat.com when:7d` | 3 | low | — | new |
| Breaking Defense | https://breakingdefense.com/feed/ | 3 | unreviewed | — | already in (oi/newsroom) |
| Brookings | GN `site:brookings.edu when:7d` | 3 | unreviewed | — | new |
| Brookings Tech | GN `site:brookings.edu technology OR AI when:14d` | 3 | unreviewed | — | new |
| Carnegie | GN `site:carnegieendowment.org when:7d` | 3 | unreviewed | — | new |
| Chatham House Tech | GN `site:chathamhouse.org technology OR AI when:14d` | 3 | unreviewed | — | new |
| China Tech Analysis | GN `("China tech strategy" OR "Chinese AI" OR "China semiconductor") analysis when:7d` | 3 | unreviewed | — | new |
| Correctiv | https://correctiv.org/feed/ | 3 | unreviewed | — | new |
| CSIS | https://www.csis.org/rss.xml<br>GN `site:csis.org when:7d` | 3 | unreviewed | — | new |
| CSIS Tech | GN `site:csis.org technology OR AI when:14d` | 3 | unreviewed | — | new |
| Defense News | https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml | 3 | unreviewed | — | already in (oi/newsroom) |
| Defense One | https://www.defenseone.com/rss/all/ | 3 | unreviewed | — | new |
| EU ISS | GN `site:iss.europa.eu when:7d` | 3 | unreviewed | — | new |
| Foreign Affairs | https://www.foreignaffairs.com/rss.xml | 3 | unreviewed | — | new |
| Foreign Policy | https://foreignpolicy.com/feed/ | 3 | unreviewed | — | new |
| FPRI | https://www.fpri.org/feed/ | 3 | unreviewed | — | new |
| gCaptain | https://gcaptain.com/feed/ | 3 | unreviewed | — | new |
| GITOC | https://globalinitiative.net/feed/ | 3 | unreviewed | — | new |
| GMF | GN `site:gmfus.org when:7d` | 3 | unreviewed | — | new |
| ISEAS (Singapore) · ~SG | GN `site:iseas.edu.sg technology when:14d` | 3 | unreviewed | — | new |
| Jamestown | https://jamestown.org/feed/ | 3 | unreviewed | — | new |
| Janes | GN `site:janes.com when:3d` | 3 | unreviewed | — | new |
| Krebs Security | https://krebsonsecurity.com/feed/ | 3 | unreviewed | — | new |
| Lighthouse Reports | https://www.lighthousereports.com/feed/ | 3 | unreviewed | — | new |
| Lowy Institute | GN `site:lowyinstitute.org when:7d` | 3 | unreviewed | — | new |
| MIT Tech Policy | GN `"Tech Policy Press"` | 3 | unreviewed | — | new |
| ORF Tech (India) | GN `(India tech policy OR ORF technology OR "Observer Research Foundation" tech) when:14d` | 3 | unreviewed | — | new |
| RAND | https://www.rand.org/pubs/articles.xml | 3 | unreviewed | — | new |
| Ransomware.live | https://www.ransomware.live/rss.xml | 3 | unreviewed | — | new |
| Responsible Statecraft | https://responsiblestatecraft.org/feed/ | 3 | unreviewed | — | new |
| RIETI (Japan) · ~JP | GN `site:rieti.go.jp technology when:30d` | 3 | unreviewed | — | new |
| Stimson Center | https://www.stimson.org/feed/ | 3 | unreviewed | — | new |
| Task & Purpose | https://taskandpurpose.com/feed/ | 3 | unreviewed | — | new |
| The Sentry | https://thesentry.org/feed/ | 3 | unreviewed | — | new |
| The War Zone | https://www.twz.com/feed | 3 | unreviewed | — | already in (oi/newsroom) |
| VSquare | https://vsquare.org/feed/ | 3 | unreviewed | — | new |
| Wilson Center | GN `site:wilsoncenter.org when:7d` | 3 | unreviewed | — | new |
| Asia Pacific Tech | GN `("Asia Pacific" tech policy OR "Lowy Institute" technology) when:14d` | — | unreviewed | — | new |
| Chatham House | GN `site:chathamhouse.org when:7d` | — | unreviewed | — | new |
| ECFR | GN `site:ecfr.eu when:7d` | — | unreviewed | — | new |
| EU Tech Policy | GN `("EU tech policy" OR "European digital" OR Bruegel tech) when:14d` | — | unreviewed | — | new |
| FAO News | https://www.fao.org/feeds/fao-newsroom-rss | — | unreviewed | — | new |
| FAS | GN `site:fas.org nuclear weapons security` | — | unreviewed | — | new |
| Middle East Institute | GN `site:mei.edu when:7d` | — | unreviewed | — | new |
| NTI | GN `site:nti.org when:30d` | — | unreviewed | — | new |

### Energy, commodities, mining & supply chain (77)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| Agriculture | GN `(wheat OR corn OR soybeans OR coffee OR sugar) price OR commodity when:3d` | — | unreviewed | — | new |
| Aluminum & Zinc | GN `(aluminum price OR aluminium OR zinc price OR "base metals") when:3d` | — | unreviewed | — | new |
| Australian Mining · ~AU | https://www.australianmining.com.au/feed/ | — | unreviewed | — | new |
| Benchmark Mineral | GN `("critical minerals" OR "battery metals" OR lithium OR cobalt OR "rare earths") when:2d` | — | unreviewed | — | new |
| BHP News | GN `BHP (mining OR production OR results OR copper OR "iron ore") when:7d` | — | unreviewed | — | new |
| Bloomberg Commodities | GN `site:bloomberg.com commodities OR metals OR mining when:1d` | — | unreviewed | — | new |
| Bloomberg Energy | GN `site:bloomberg.com (oil OR gas OR energy OR pipeline OR LNG) when:1d` | — | unreviewed | — | new |
| China Commodity Imports | GN `China imports copper OR "iron ore" OR lithium OR cobalt OR "rare earth" when:3d`<br>GN `(China imports copper OR iron ore OR lithium OR cobalt OR "rare earth") when:3d` | — | unreviewed | — | new |
| China Mineral Policy | GN `China "rare earth" OR "mineral export" OR "critical mineral" policy OR restriction when:7d`<br>GN `(China "rare earth" OR "mineral export" OR "critical mineral") policy OR restriction when:7d` | — | unreviewed | — | new |
| CNBC Commodities | GN `site:cnbc.com (commodities OR metals OR gold OR copper) when:1d` | — | unreviewed | — | new |
| Cobalt Market | GN `(cobalt price OR "cobalt market" OR "DRC cobalt" OR "battery cobalt") when:3d` | — | unreviewed | — | new |
| Commodity Trading | GN `("commodity trading" OR "futures market" OR CME OR NYMEX OR COMEX) when:2d` | — | unreviewed | — | new |
| Copper Market | GN `(copper price OR "copper market" OR "copper supply" OR COMEX copper) when:2d` | — | unreviewed | — | new |
| Critical Mineral Companies | GN `(Albemarle OR SQM OR "MP Materials" OR Lynas OR Cameco) when:7d` | — | unreviewed | — | new |
| EIA Press Room | https://www.eia.gov/rss/press_room.xml | — | unreviewed | — | new |
| EIA Reports | GN `site:eia.gov energy oil gas when:14d`<br>https://www.eia.gov/rss/press_room.xml | — | unreviewed | — | new |
| Energy Crisis & Shortages | GN `("fuel shortage" OR "gas shortage" OR "diesel shortage" OR "jet fuel shortage" OR "energy crisis" OR rationing OR "petrol shortage") when:2d` | — | unreviewed | — | new |
| Energy Intel | GN `(energy commodities OR "energy market" OR "energy prices") when:2d`<br>GN `(energy commodities OR "energy market" OR "energy prices" OR "energy security") when:2d` | — | unreviewed | — | new |
| Energy Sanctions | GN `("oil sanctions" OR "gas sanctions" OR "price cap" OR "energy embargo" OR "LNG sanctions") when:3d` | — | unreviewed | — | new |
| ESG in Mining | GN `("mining ESG" OR "responsible mining" OR "mine closure" OR tailings) when:7d`<br>GN `("mining ESG" OR "responsible mining" OR "mine closure" OR "tailings") when:7d` | — | unreviewed | — | new |
| EV Battery Supply | GN `("EV battery" OR "battery supply chain" OR "battery materials") when:3d` | — | unreviewed | — | new |
| Freeport & Copper Miners | GN `(Freeport McMoRan OR Southern Copper OR Teck OR Antofagasta) when:7d` | — | unreviewed | — | new |
| FT Energy | GN `site:ft.com (oil OR gas OR energy OR LNG OR OPEC) when:1d` | — | unreviewed | — | new |
| FX Empire Gold | GN `site:fxempire.com gold when:1d` | — | unreviewed | — | new |
| Glencore & Vale | GN `(Glencore OR Vale) (mining OR production OR cobalt OR "iron ore") when:7d` | — | unreviewed | — | new |
| Gold & Metals | GN `("gold price" OR "silver price" OR "precious metals" OR "copper price") when:2d`<br>GN `(gold price OR silver price OR copper OR platinum OR "precious metals") when:2d` | — | unreviewed | — | new |
| Gold Majors | GN `(Newmont OR Barrick OR AngloGold OR Agnico) (gold mine OR production OR results) when:7d` | — | unreviewed | — | new |
| Gold Price News | GN `(gold price OR "gold market" OR bullion OR LBMA) when:1d` | — | unreviewed | — | new |
| Gold Silver Worlds | https://goldsilverworlds.com/feed/ | — | unreviewed | — | new |
| GoldSeek | https://www.goldseek.com/rss.xml | — | unreviewed | — | new |
| IEA Critical Minerals | GN `site:iea.org (minerals OR critical OR battery) when:14d` | — | unreviewed | — | new |
| IEA News | GN `site:iea.org (oil OR gas OR energy) when:3d` | — | unreviewed | — | new |
| Indonesia Nickel Policy | GN `(Indonesia nickel OR "nickel export" OR "nickel ban" OR "nickel processing") when:7d` | — | unreviewed | — | new |
| Iron Ore Market | GN `("iron ore" price OR "iron ore market" OR "steel raw materials") when:2d` | — | unreviewed | — | new |
| Kitco Gold | GN `site:kitco.com gold price OR "gold market" OR "silver price" when:2d`<br>GN `site:kitco.com gold when:1d` | — | unreviewed | — | new |
| Kitco News | GN `site:kitco.com gold OR silver OR commodity OR metals when:1d`<br>GN `site:kitco.com (gold OR silver OR metals) when:1d` | — | unreviewed | — | new |
| Lithium Market | GN `(lithium price OR "lithium market" OR "lithium supply" OR spodumene OR LCE) when:2d` | — | unreviewed | — | new |
| LME Metals | GN `(LME OR "London Metal Exchange") copper OR aluminum OR zinc OR nickel when:2d` | — | unreviewed | — | new |
| Metals Bulletin | GN `("metals market" OR "base metals" OR SHFE OR "Shanghai Futures") when:2d` | — | unreviewed | — | new |
| Mine Web (SNL) | GN `("mining company" OR "mine production" OR "mining operations") when:2d` | — | unreviewed | — | new |
| Mining & Resources | GN `(lithium OR "rare earth" OR cobalt OR mining) when:3d` | — | unreviewed | — | new |
| Mining Journal | GN `site:mining-journal.com when:7d` | — | unreviewed | — | new |
| Mining Regulation | GN `("mining regulation" OR "mining policy" OR "mining permit" OR "mining ban") when:7d` | — | unreviewed | — | new |
| Mining Technology | https://www.mining-technology.com/feed/ | — | unreviewed | — | new |
| Mining Weekly | GN `site:miningweekly.com when:7d` | — | unreviewed | — | new |
| Mining.com | https://www.mining.com/feed/ | — | unreviewed | — | new |
| Natural Gas & LNG | GN `("natural gas" OR LNG OR "gas price" OR "Henry Hub" OR TTF OR JKM OR "LNG cargo") when:1d` | — | unreviewed | — | new |
| Natural Gas News | GN `("natural gas" OR LNG OR "gas price" OR "Henry Hub") when:1d` | — | unreviewed | — | new |
| Nickel News | GN `(nickel price OR "nickel market" OR "nickel supply" OR Indonesia nickel) when:3d` | — | unreviewed | — | new |
| Northern Miner | GN `site:northernminer.com when:7d`<br>https://www.northernminer.com/feed/ | — | unreviewed | — | new |
| Nuclear Energy | GN `("nuclear energy" OR "nuclear power" OR "nuclear reactor") when:3d`<br>GN `("nuclear energy" OR "nuclear power" OR uranium OR IAEA) when:3d` | — | unreviewed | — | new |
| Oil & Gas | GN `(oil price OR OPEC OR "natural gas" OR pipeline OR LNG) when:2d`<br>GN `(oil price OR OPEC OR "natural gas" OR "crude oil" OR WTI OR Brent) when:1d` | — | unreviewed | — | new |
| OilPrice.com | https://oilprice.com/rss/main | — | unreviewed | — | already in (oi/newsroom) |
| OPEC & Crude | GN `(OPEC OR "oil price" OR "crude oil" OR WTI OR Brent OR "oil production" OR "oil inventory") when:1d` | — | unreviewed | — | new |
| OPEC News | GN `(OPEC OR "oil price" OR "crude oil" OR WTI OR Brent OR "oil production") when:1d` | — | unreviewed | — | new |
| Pipelines & Chokepoints | GN `(pipeline OR Druzhba OR "Nord Stream" OR TurkStream OR "Strait of Hormuz" OR "Bab el-Mandeb" OR "Suez Canal" OR "Power of Siberia") when:2d` | — | unreviewed | — | new |
| Port & Logistics | GN `("iron ore port" OR "copper port" OR "commodity port" OR "mineral logistics") when:7d` | — | unreviewed | — | new |
| Port & Terminal | GN `("LNG terminal" OR "crude terminal" OR "oil port" OR "Ras Laffan" OR "Sabine Pass" OR "Rotterdam oil") when:3d` | — | unreviewed | — | new |
| Precious Metals | GN `("precious metals" OR platinum OR palladium OR "gold ETF" OR GLD OR SLV) when:2d` | — | unreviewed | — | new |
| Rare Earths News | GN `("rare earth" OR "rare earths" OR REE OR neodymium OR praseodymium) when:3d`<br>GN `("rare earth" OR "rare earths" OR "REE" OR neodymium OR praseodymium) when:3d` | — | unreviewed | — | new |
| Refinery & Disruptions | GN `(refinery OR "refinery outage" OR "force majeure" OR "pipeline sabotage" OR "pipeline attack") when:2d` | — | unreviewed | — | new |
| Resource World | GN `("mining project" OR "mineral exploration" OR "mine development") when:3d` | — | unreviewed | — | new |
| Reuters Commodities | GN `site:reuters.com commodities OR metals OR mining when:1d` | — | unreviewed | — | new |
| Reuters Energy | GN `site:reuters.com energy when:2d`<br>GN `site:reuters.com (oil OR gas OR energy) when:1d`<br>GN `site:reuters.com (oil OR gas OR energy OR OPEC) when:3d`<br>GN `site:reuters.com (oil OR gas OR energy OR OPEC OR pipeline OR LNG) when:1d` | — | unreviewed | — | new |
| Rigzone | https://www.rigzone.com/news/rss/rigzone_latest.aspx | — | unreviewed | — | new |
| Rio Tinto News | GN `"Rio Tinto" (mining OR production OR results OR Pilbara) when:7d` | — | unreviewed | — | new |
| S&P Global Commodity | GN `site:spglobal.com commodities metals when:3d` | — | unreviewed | — | new |
| S&P Global Platts | GN `site:spglobal.com (oil OR gas OR LNG OR pipeline) when:2d` | — | unreviewed | — | new |
| Shipping & Freight | GN `("bulk carrier" OR "dry bulk" OR "commodity shipping" OR "Port Hedland" OR "Strait of Hormuz") when:3d` | — | unreviewed | — | new |
| Silver Price News | GN `(silver price OR "silver market" OR "silver futures") when:2d` | — | unreviewed | — | new |
| SilverSeek | https://www.silverseek.com/rss.xml | — | unreviewed | — | new |
| Strategic Chokepoints | GN `("Strait of Hormuz" OR "Strait of Malacca" OR "Bab el-Mandeb" OR "Suez Canal" OR "Panama Canal" OR "Turkish Straits" OR "Danish Straits") when:2d` | — | unreviewed | — | new |
| Tanker & Shipping | GN `(tanker OR VLCC OR Suezmax OR Aframax OR "oil shipping" OR "LNG carrier" OR "shadow fleet") when:2d` | — | unreviewed | — | new |
| Trade & Tariffs | GN `("mineral tariff" OR "metals tariff" OR "critical mineral policy" OR "mining export ban") when:7d`<br>GN `(tariff OR "trade war" OR "trade deficit" OR sanctions) when:2d` | — | unreviewed | — | new |
| Trade Routes | GN `("trade route" OR "supply chain" OR "commodity export" OR "mineral export") when:3d` | — | unreviewed | — | new |
| Uranium Market | GN `(uranium price OR "uranium market" OR U3O8 OR nuclear fuel) when:3d` | — | unreviewed | — | new |
| World Gold Council | GN `"World Gold Council" OR "central bank gold" OR "gold reserves" when:7d` | — | unreviewed | — | new |

### Finance, markets, macro & crypto (83)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| Reuters Business | GN `site:reuters.com business markets when:1d` | 1 | unreviewed | — | new |
| Binance Announcements | GN `site:binance.com/en/support/announcement when:3d` | 2 | medium | — | new |
| Business Insider | https://www.businessinsider.com/rss | 2 | low | — | new |
| CNBC | https://www.cnbc.com/id/100003114/device/rss/rss.html | 2 | unreviewed | — | new |
| Coinbase Blog | GN `site:coinbase.com/blog when:7d` | 2 | medium | — | new |
| Financial Times | https://www.ft.com/rss/home | 2 | low | — | new |
| Fox Business | https://moxie.foxbusiness.com/google-publisher/latest.xml | 2 | low | — | new |
| Jin10 · ~CN | GN `site:jin10.com when:1d` [zh-CN/CN] | 2 | medium | zh | new |
| MarketWatch | GN `site:marketwatch.com markets when:1d` | 2 | unreviewed | — | new |
| Business Wire | https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeGVtRWA== | 3 | medium | — | new |
| Chainwire | https://chainwire.org/feed/ | 3 | medium | — | new |
| GlobeNewswire | https://www.globenewswire.com/RssFeed/subjectcode/22/feedTitle/GlobeNewswire | 3 | medium | — | new |
| PR Newswire | GN `site:prnewswire.com when:1d` | 3 | medium | — | new |
| Yahoo Finance | https://finance.yahoo.com/news/rssindex<br>https://finance.yahoo.com/rss/topstories | 4 | unreviewed | — | already in (oi/newsroom) |
| Arabian Business | GN `site:arabianbusiness.com (Saudi Arabia OR UAE OR GCC) when:7d` | — | unreviewed | — | new |
| Bank Research | GN `("Goldman Sachs" OR JPMorgan OR "Morgan Stanley") forecast OR outlook when:3d`<br>GN `("Goldman Sachs" OR "JPMorgan" OR "Morgan Stanley") forecast OR outlook when:3d` | — | unreviewed | — | new |
| Banking Rules | GN `(Basel OR "capital requirements" OR "banking regulation") when:7d` | — | unreviewed | — | new |
| Bitcoin Magazine | https://bitcoinmagazine.com/feed | — | unreviewed | — | new |
| Blockchain Finance | GN `("blockchain finance" OR tokenization OR "digital securities" OR CBDC) when:7d`<br>GN `("blockchain finance" OR "tokenization" OR "digital securities" OR CBDC) when:7d` | — | unreviewed | — | new |
| Bloomberg Crypto | GN `bloomberg crypto when:1d` | — | unreviewed | — | new |
| Bloomberg Markets | GN `site:bloomberg.com markets when:1d` | — | unreviewed | — | new |
| BoE Watch | GN `("Bank of England" OR BoE) monetary policy when:3d` | — | unreviewed | — | new |
| BoJ Watch | GN `("Bank of Japan" OR BoJ) monetary policy when:3d` | — | unreviewed | — | new |
| Bond Market | GN `("bond market" OR "treasury yield" OR "bond yield" OR "fixed income") when:2d`<br>GN `("bond market" OR "treasury yields" OR "bond yields" OR "fixed income") when:2d` | — | unreviewed | — | new |
| Central Bank Rates | GN `("central bank" OR "interest rate" OR "rate decision" OR "monetary policy") when:2d` | — | unreviewed | — | new |
| CNBC Markets | https://www.cnbc.com/id/100003114/device/rss/rss.html | — | unreviewed | — | new |
| CNBC Tech | https://www.cnbc.com/id/19854910/device/rss/rss.html | — | unreviewed | — | new |
| CoinDesk | https://www.coindesk.com/arc/outboundfeeds/rss/ | — | unreviewed | — | already in (oi/newsroom) |
| Cointelegraph | https://cointelegraph.com/rss | — | unreviewed | — | already in (oi/newsroom) |
| Commodity Futures | GN `(COMEX OR NYMEX OR "commodity futures" OR CME commodities) when:2d` | — | unreviewed | — | new |
| Corporate Bonds | GN `("corporate bond" OR "high yield" OR "investment grade" OR "credit spread") when:3d` | — | unreviewed | — | new |
| Crypto News | GN `(bitcoin OR ethereum OR crypto OR "digital assets") when:1d` | — | unreviewed | — | new |
| Crypto Regulation | GN `(crypto regulation OR "digital asset" regulation OR stablecoin regulation) when:7d`<br>GN `(crypto regulation OR "digital asset" regulation OR "stablecoin" regulation) when:7d` | — | unreviewed | — | new |
| CryptoSlate | https://cryptoslate.com/feed/ | — | unreviewed | — | new |
| Decrypt | https://decrypt.co/feed | — | unreviewed | — | already in (oi/newsroom) |
| DeFi News | GN `(DeFi OR "decentralized finance") when:3d`<br>GN `(DeFi OR "decentralized finance" OR DEX OR "yield farming") when:3d` | — | unreviewed | — | new |
| DL News | GN `site:dlnews.com when:3d` | — | unreviewed | — | new |
| Dollar Watch | GN `("dollar index" OR DXY OR "US dollar" OR "euro dollar") when:2d` | — | unreviewed | — | new |
| Earnings Reports | GN `("earnings report" OR "quarterly earnings" OR "revenue beat" OR "earnings miss") when:2d` | — | unreviewed | — | new |
| ECB Watch | GN `("European Central Bank" OR ECB OR Lagarde) monetary policy when:3d` | — | unreviewed | — | new |
| Economic Data | GN `(CPI OR inflation OR GDP OR "economic data" OR "jobs report") when:2d`<br>GN `(CPI OR inflation OR GDP OR "jobs report" OR "nonfarm payrolls" OR PMI) when:2d` | — | unreviewed | — | new |
| Financial Regulation | GN `(SEC OR CFTC OR FINRA OR FCA) regulation OR enforcement when:3d` | — | unreviewed | — | new |
| Fintech News | GN `(fintech OR "payment technology" OR neobank OR "digital banking") when:3d`<br>GN `(fintech OR "payment technology" OR "neobank" OR "digital banking") when:3d` | — | unreviewed | — | new |
| Forex News | GN `(forex OR currency OR "exchange rate" OR FX OR "US dollar") when:2d`<br>GN `("forex" OR "currency" OR "FX market") trading when:1d` | — | unreviewed | — | new |
| Futures Trading | GN `("futures trading" OR "S&P 500 futures" OR "Nasdaq futures") when:1d` | — | unreviewed | — | new |
| Global Central Banks | GN `("rate hike" OR "rate cut" OR "interest rate decision") central bank when:3d` | — | unreviewed | — | new |
| Gulf FDI | GN `(PIF OR "DP World" OR Mubadala OR ADNOC OR Masdar OR "ACWA Power") infrastructure when:7d` | — | unreviewed | — | new |
| Gulf Investments | GN `("Saudi Arabia" OR UAE OR "Abu Dhabi") investment infrastructure when:7d`<br>GN `("Saudi Arabia" OR "UAE" OR "Abu Dhabi") investment infrastructure when:7d` | — | unreviewed | — | new |
| Hedge Fund News | GN `("hedge fund" OR Bridgewater OR Citadel OR Renaissance) when:7d`<br>GN `("hedge fund" OR "Bridgewater" OR "Citadel" OR "Renaissance") when:7d` | — | unreviewed | — | new |
| Housing Market | GN `("housing market" OR "home prices" OR "mortgage rates" OR REIT) when:3d` | — | unreviewed | — | new |
| Investing.com | GN `site:investing.com markets when:1d` | — | unreviewed | — | new |
| Investing.com News | GN `site:investing.com markets when:1d` | — | unreviewed | — | new |
| IPO News | GN `(IPO OR "initial public offering" OR SPAC) tech when:7d`<br>GN `(IPO OR "initial public offering" OR "stock market debut") when:2d`<br>GN `(IPO OR "initial public offering" OR SPAC OR "direct listing") when:3d` | — | unreviewed | — | new |
| M&A News | GN `("merger" OR "acquisition" OR "takeover bid" OR "buyout") billion when:3d` | — | unreviewed | — | new |
| Market Outlook | GN `("market outlook" OR "stock market forecast" OR "bull market" OR "bear market") when:3d` | — | unreviewed | — | new |
| MarketWatch Tech | GN `site:marketwatch.com technology markets when:2d` | — | unreviewed | — | new |
| Messari | GN `site:messari.io when:3d` | — | unreviewed | — | new |
| Nasdaq-100 & QQQ | GN `("Nasdaq-100" OR QQQ OR "Nasdaq 100") when:1d` | — | unreviewed | — | new |
| NFT News | GN `(NFT OR "non-fungible") when:3d` | — | unreviewed | — | new |
| NQ Influence Basket | GN `(AAPL OR Apple OR MSFT OR Microsoft OR NVDA OR NVIDIA OR AMZN OR Amazon OR GOOGL OR Alphabet OR META OR AVGO OR Broadcom OR TSLA OR Tesla) when:1d` | — | unreviewed | — | new |
| Options Market | GN `("options market" OR "options trading" OR "put call ratio" OR VIX) when:2d` | — | unreviewed | — | new |
| PBoC Watch | GN `("People\'s Bank of China" OR PBoC OR PBOC) when:7d`<br>GN `("People's Bank of China" OR PBoC OR PBOC) when:7d` | — | unreviewed | — | new |
| Private Equity | GN `("private equity" OR Blackstone OR KKR OR Apollo OR Carlyle) when:3d` | — | unreviewed | — | new |
| Renaissance IPO | GN `site:renaissancecapital.com IPO when:14d` | — | unreviewed | — | new |
| Reuters Crypto | GN `reuters crypto when:1d` | — | unreviewed | — | new |
| Reuters Markets | GN `site:reuters.com markets stocks when:1d` | — | unreviewed | — | new |
| Reuters Nasdaq Futures | GN `site:reuters.com (Nasdaq futures OR NQ OR "E-mini") when:1d` | — | unreviewed | — | new |
| Risk & Volatility | GN `(VIX OR "market volatility" OR "risk off" OR "market correction") when:3d` | — | unreviewed | — | new |
| Seeking Alpha | https://seekingalpha.com/market_currents.xml | — | unreviewed | — | new |
| Seeking Alpha Metals | GN `site:seekingalpha.com (gold OR silver OR copper OR mining) when:2d` | — | unreviewed | — | new |
| Seeking Alpha Tech | https://seekingalpha.com/market_currents.xml | — | unreviewed | — | new |
| Semiconductors | GN `(semiconductor OR chip OR "AI chip" OR TSMC OR ASML) when:1d` | — | unreviewed | — | new |
| Sovereign Wealth | GN `("sovereign wealth fund" OR "pension fund" OR "institutional investor") when:7d` | — | unreviewed | — | new |
| Stablecoin Policy | GN `(stablecoin regulation OR "stablecoin bill") when:7d` | — | unreviewed | — | new |
| Tech IPO News | GN `tech IPO OR "tech company" IPO when:7d` | — | unreviewed | — | new |
| The Block | GN `site:theblock.co when:1d` | — | unreviewed | — | TAKIP reads this site's own feed |
| The Defiant | https://thedefiant.io/feed | — | unreviewed | — | new |
| Trading Tech | GN `("algorithmic trading" OR "trading platform" OR "quantitative finance") when:7d` | — | unreviewed | — | new |
| Treasury Watch | GN `("US Treasury" OR "Treasury auction" OR "10-year yield" OR "2-year yield") when:2d` | — | unreviewed | — | new |
| Unchained | https://unchainedcrypto.com/feed/ | — | unreviewed | — | new |
| Vision 2030 | GN `"Vision 2030" (project OR investment OR announced) when:14d` | — | unreviewed | — | new |
| Wu Blockchain | GN `site:wublockchain.com when:7d` | — | unreviewed | — | new |
| Yahoo Finance Commodities | https://finance.yahoo.com/rss/topstories | — | unreviewed | — | same host in TAKIP (other feed) |

### Tech, AI, cyber & startups (141)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| a16z Blog | https://www.a16z.news/feed<br>GN `site:a16z.com OR "Andreessen Horowitz" blog when:14d` | 2 | unreviewed | — | new |
| All-In Podcast | GN `"All-In podcast" (Chamath OR Sacks OR Friedberg) when:7d` | 2 | unreviewed | — | new |
| CB Insights | https://www.cbinsights.com/research/feed/ | 2 | unreviewed | — | new |
| Crunchbase News | https://news.crunchbase.com/feed/ | 2 | unreviewed | — | new |
| EU Commission Digital | GN `site:ec.europa.eu digital OR technology when:14d` | 2 | unreviewed | — | new |
| Hard Fork (NYT) | GN `"Hard Fork" podcast NYT when:14d` | 2 | unreviewed | — | new |
| How I Built This | GN `"How I Built This" Guy Raz when:14d` | 2 | unreviewed | — | new |
| Masters of Scale | https://rss.art19.com/masters-of-scale | 2 | unreviewed | — | new |
| Nikkei Tech | GN `site:asia.nikkei.com technology when:3d` | 2 | unreviewed | — | new |
| Paul Graham Essays | GN `"Paul Graham" essay OR blog when:30d`<br>https://www.aaronsw.com/2002/feeds/pgessays.rss | 2 | unreviewed | — | new |
| PitchBook News | GN `site:pitchbook.com when:7d`<br>https://pitchbook.com/feed | 2 | unreviewed | — | new |
| Politico Tech | https://rss.politico.com/technology.xml | 2 | unreviewed | — | same host in TAKIP (other feed) |
| Sequoia Blog | GN `site:sequoiacap.com when:7d`<br>https://www.sequoiacap.com/feed/ | 2 | unreviewed | — | new |
| Stratechery | https://stratechery.com/feed/ | 2 | unreviewed | — | new |
| The Information | GN `site:theinformation.com startup OR funding when:3d` | 2 | unreviewed | — | new |
| Wired | https://www.wired.com/feed/rss | 2 | low | — | new |
| Y Combinator Blog | https://www.ycombinator.com/blog/rss/ | 2 | unreviewed | — | new |
| 36Kr English | GN `site:36kr.com OR "36Kr" startup china when:7d` | 3 | unreviewed | — | new |
| AI Regulation | GN `AI regulation OR "artificial intelligence" law OR policy when:7d` | 3 | unreviewed | — | new |
| Ars Technica | https://feeds.arstechnica.com/arstechnica/technology-lab | 3 | unreviewed | — | same host in TAKIP (other feed) |
| China Tech Policy | GN `(China tech regulation OR China AI policy OR MIIT technology) when:7d` | 3 | unreviewed | — | new |
| Contxto (LATAM) | https://contxto.com/feed/ | 3 | unreviewed | — | new |
| EFF News | GN `site:eff.org OR "Electronic Frontier Foundation" when:14d` | 3 | unreviewed | — | new |
| EU Digital Policy | GN `("Digital Services Act" OR "Digital Markets Act" OR "EU AI Act" OR "GDPR") when:7d` | 3 | unreviewed | — | new |
| EU Startups | https://www.eu-startups.com/feed/<br>GN `site:eu-startups.com when:7d` | 3 | unreviewed | — | new |
| Euractiv Digital | GN `site:euractiv.com digital OR tech when:7d` | 3 | unreviewed | — | new |
| Inc42 (India) | https://inc42.com/feed/ | 3 | unreviewed | — | new |
| India Tech News | GN `(Flipkart OR Razorpay OR Zerodha OR Zomato OR Paytm OR PhonePe) when:7d` | 3 | unreviewed | — | new |
| India Tech Policy | GN `(India tech regulation OR India data protection OR India AI policy) when:7d` | 3 | unreviewed | — | new |
| Japan Tech News | GN `(Japan startup OR Japan tech OR SoftBank OR Rakuten OR Sony) funding when:7d` | 3 | unreviewed | — | new |
| Korea Tech News | GN `(Korea startup OR Korean tech OR Samsung OR Kakao OR Naver OR Coupang) when:7d` | 3 | unreviewed | — | new |
| Layoffs.fyi | GN `tech+company+layoffs+announced when:3d`<br>GN `tech+layoffs+when:7d`<br>GN `tech company layoffs announced`<br>GN `tech layoffs when:7d` | 3 | unreviewed | — | new |
| Lex Fridman Tech | GN `("Lex Fridman" interview) (AI OR tech OR startup OR CEO) when:7d` | 3 | unreviewed | — | new |
| MIT Tech Review | https://www.technologyreview.com/feed/<br>https://www.technologyreview.com/topic/artificial-intelligence/feed | 3 | unreviewed | — | new |
| OpenAI News | GN `OpenAI ChatGPT GPT-4 when:7d` | 3 | unreviewed | — | new |
| Sifted (Europe) | https://sifted.eu/feed | 3 | unreviewed | — | new |
| Tech Antitrust | GN `tech antitrust OR FTC Google OR FTC Apple OR FTC Amazon when:7d` | 3 | unreviewed | — | new |
| Tech in Asia | https://www.techinasia.com/feed<br>GN `site:techinasia.com when:7d` | 3 | unreviewed | — | new |
| Tech.eu | https://tech.eu/feed/ | 3 | unreviewed | — | new |
| TechCabal (Africa) | https://techcabal.com/feed/ | 3 | unreviewed | — | new |
| The Next Web | GN `site:thenextweb.com when:7d` | 3 | unreviewed | — | new |
| UK Tech Policy | GN `(UK AI safety OR "Online Safety Bill" OR UK tech regulation) when:7d` | 3 | unreviewed | — | new |
| YourStory | https://yourstory.com/feed | 3 | unreviewed | — | new |
| AI News | GN `(OpenAI OR Anthropic OR Google AI OR "large language model" OR ChatGPT) when:2d`<br>GN `(OpenAI OR Anthropic OR Google AI OR "large language model" OR ChatGPT OR Claude OR "AI model") when:2d` | 4 | unreviewed | — | new |
| ArXiv AI | https://export.arxiv.org/rss/cs.AI | 4 | unreviewed | — | new |
| Hacker News | https://hnrss.org/frontpage | 4 | unreviewed | — | new |
| Layoffs News | GN `(layoffs OR "job cuts" OR "workforce reduction") when:3d` | 4 | unreviewed | — | new |
| TechCrunch Layoffs | https://techcrunch.com/tag/layoffs/feed/ | 4 | unreviewed | — | same host in TAKIP (other feed) |
| The Verge | https://www.theverge.com/rss/index.xml | 4 | unreviewed | — | already in (oi/newsroom) |
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml | 4 | unreviewed | — | same host in TAKIP (other feed) |
| VentureBeat AI | https://venturebeat.com/category/ai/feed/ | 4 | unreviewed | — | new |
| 20VC Episodes | https://rss.libsyn.com/shows/61840/destinations/240976.xml | — | unreviewed | — | new |
| 500 Global News | GN `"500 Global" OR "500 Startups" accelerator when:14d` | — | unreviewed | — | new |
| a16z Insights | GN `("a16z" OR "Andreessen Horowitz") podcast OR interview when:14d` | — | unreviewed | — | new |
| Acquired Episodes | GN `"Acquired podcast" episode when:14d` | — | unreviewed | — | new |
| Africa Startups | GN `Africa startup funding OR "African startup" when:7d` | — | unreviewed | — | new |
| Africa Tech News | GN `(Flutterwave OR Paystack OR Jumia OR Andela OR "Africa startup") when:7d` | — | unreviewed | — | new |
| AI Interviews | GN `(NVIDIA OR OpenAI OR Anthropic OR DeepMind) interview OR podcast when:14d` | — | unreviewed | — | new |
| AI Podcasts | GN `("AI podcast" OR "artificial intelligence podcast") episode when:14d` | — | unreviewed | — | new |
| AI Weekly | GN `"artificial intelligence" OR "machine learning" when:3d` | — | unreviewed | — | new |
| AngelList News | GN `site:angellist.com OR "AngelList" funding when:7d` | — | unreviewed | — | new |
| Anthropic News | GN `Anthropic Claude AI when:7d` | — | unreviewed | — | new |
| ArXiv ML | https://export.arxiv.org/rss/cs.LG | — | unreviewed | — | new |
| Asia VC News | GN `("Southeast Asia" OR ASEAN) venture capital OR funding when:7d` | — | unreviewed | — | new |
| AWS Status | GN `AWS outage OR "Amazon Web Services" down when:1d` | — | unreviewed | — | new |
| Both Sides of Table | https://bothsidesofthetable.com/feed | — | unreviewed | — | new |
| Brazil Tech | GN `(Nubank OR iFood OR Mercado Libre OR Rappi OR VTEX) when:7d` | — | unreviewed | — | new |
| CB Insights Unicorn | GN `site:cbinsights.com unicorn when:14d` | — | unreviewed | — | new |
| Changelog | https://changelog.com/feed | — | unreviewed | — | new |
| China Startups | GN `China startup funding OR "Chinese startup" when:7d` | — | unreviewed | — | new |
| China Tech Giants | GN `(Alibaba OR Tencent OR ByteDance OR Baidu OR JD.com OR Xiaomi OR Huawei) when:3d` | — | unreviewed | — | new |
| CISA Advisories | https://www.cisa.gov/cybersecurity-advisories/all.xml | — | unreviewed | — | same host in TAKIP (other feed) |
| Cloud Outages | GN `(Azure outage OR "Google Cloud" outage OR Cloudflare outage OR Slack down OR GitHub down) when:1d`<br>GN `(Azure OR GCP OR Cloudflare OR Slack OR GitHub) outage OR down when:1d` | — | unreviewed | — | new |
| Cyber Incidents | GN `cyber attack OR data breach OR ransomware OR hacking when:3d` | — | unreviewed | — | new |
| Dark Reading | https://www.darkreading.com/rss.xml | — | unreviewed | — | new |
| Decacorn News | GN `("decacorn" OR "$10 billion valuation") startup when:14d`<br>GN `("decacorn" OR "$10 billion valuation" OR "$10B valuation") startup when:14d` | — | unreviewed | — | new |
| Demo Day News | GN `("demo day" OR "YC batch" OR "accelerator batch") startup when:7d` | — | unreviewed | — | new |
| Dev Events | GN `("developer conference" OR "tech summit" OR "devcon" OR "developer event") when:7d`<br>https://dev.events/rss.xml | — | unreviewed | — | new |
| Dev.to | https://dev.to/feed | — | unreviewed | — | new |
| DevOps.com | https://devops.com/feed/ | — | unreviewed | — | new |
| Disrupt Africa | https://disrupt-africa.com/feed/ | — | unreviewed | — | new |
| Engadget | https://www.engadget.com/rss.xml | — | unreviewed | — | new |
| Fast Company | https://feeds.feedburner.com/fastcompany/headlines | — | unreviewed | — | new |
| FinTech LATAM | GN `fintech (Brazil OR Mexico OR Argentina OR "Latin America") when:7d` | — | unreviewed | — | new |
| First Round Review | https://review.firstround.com/articles/rss | — | unreviewed | — | new |
| Fortune Term Sheet | GN `"Term Sheet" venture capital OR startup when:7d` | — | unreviewed | — | new |
| FwdStart Newsletter | (WM-internal `/api/fwdstart` route, not a public feed) | — | unreviewed | — | new |
| GitHub Blog | https://github.blog/feed/ | — | unreviewed | — | new |
| GitHub Trending | https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml | — | unreviewed | — | new |
| India Startups | GN `India startup funding OR "Indian startup" when:7d` | — | unreviewed | — | new |
| Indonesia Tech | GN `Indonesia startup OR Indonesia tech when:7d` | — | unreviewed | — | new |
| InfoQ | https://feed.infoq.com/ | — | unreviewed | — | new |
| Japan Startups | GN `Japan startup funding OR "Japanese startup" when:7d` | — | unreviewed | — | new |
| Korea Startups | GN `Korea startup funding OR "Korean unicorn" when:7d` | — | unreviewed | — | new |
| KrASIA | GN `site:kr-asia.com OR KrASIA when:7d`<br>https://kr-asia.com/feed | — | unreviewed | — | new |
| LATAM Startups | GN `("Latin America" startup OR LATAM funding) when:7d` | — | unreviewed | — | new |
| LAVCA (LATAM) | GN `site:lavca.org when:7d`<br>https://lavca.org/feed/ | — | unreviewed | — | new |
| Lenny's Newsletter | https://www.lennysnewsletter.com/feed | — | unreviewed | — | new |
| Lobsters · ~RS | https://lobste.rs/rss | — | unreviewed | — | new |
| MENA Startups | GN `(MENA startup OR "Middle East" funding OR Gulf startup) when:7d` | — | unreviewed | — | new |
| MENA Tech News | GN `(UAE startup OR Saudi tech OR Dubai startup OR NEOM tech) when:7d` | — | unreviewed | — | new |
| MIT Research | https://news.mit.edu/rss/research | — | unreviewed | — | new |
| MIT Tech Review AI | https://www.technologyreview.com/topic/artificial-intelligence/feed | — | unreviewed | — | new |
| New Unicorns | GN `("becomes unicorn" OR "joins unicorn" OR "reaches unicorn" OR "achieved unicorn") when:14d` | — | unreviewed | — | new |
| NFX Essays | https://www.nfx.com/feed | — | unreviewed | — | new |
| Open Source News | GN `"open source" project release OR launch when:3d` | — | unreviewed | — | new |
| Pivot Podcast | https://feeds.megaphone.fm/pivot | — | unreviewed | — | new |
| Product Hunt | https://www.producthunt.com/feed | — | unreviewed | — | new |
| SaaStr | https://www.saastr.com/feed/ | — | unreviewed | — | new |
| Schneier | https://www.schneier.com/feed/ | — | unreviewed | — | new |
| SEA Startups | GN `(Singapore OR Indonesia OR Vietnam OR Thailand OR Malaysia) startup funding when:7d` | — | unreviewed | — | new |
| SEA Tech News | GN `(Grab OR GoTo OR Sea Limited OR Shopee OR Tokopedia) when:7d` | — | unreviewed | — | new |
| SEC Filings | GN `(S-1 OR "IPO filing" OR "SEC filing") startup when:7d` | — | unreviewed | — | new |
| Seed & Pre-Seed | GN `("seed round" OR "pre-seed" OR "angel round" OR "seed funding") when:7d` | — | unreviewed | — | new |
| SemiAnalysis | https://www.semianalysis.com/feed<br>GN `site:semianalysis.com when:7d` | — | unreviewed | — | new |
| Semiconductor News | GN `semiconductor OR chip OR TSMC OR NVIDIA OR Intel when:3d` | — | unreviewed | — | new |
| Show HN | https://hnrss.org/show | — | unreviewed | — | new |
| Startup Funding | GN `("startup funding" OR "raised funding" OR "raised $" OR "funding announced") when:7d` | — | unreviewed | — | new |
| Startup School | GN `"Startup School" OR "YC Startup School" when:14d` | — | unreviewed | — | new |
| Startups LATAM | GN `(startup Brazil OR startup Mexico OR startup Argentina OR startup Colombia OR startup Chile) when:7d` | — | unreviewed | — | new |
| Taiwan Tech | GN `(Taiwan startup OR TSMC OR MediaTek OR Foxconn) when:7d` | — | unreviewed | — | new |
| Tech Newsletters | GN `("Benedict Evans" OR "Pragmatic Engineer" OR Stratechery) tech when:14d` | — | unreviewed | — | new |
| TechCrunch | https://techcrunch.com/feed/ | — | unreviewed | — | already in (oi/newsroom) |
| TechCrunch Startups | https://techcrunch.com/category/startups/feed/ | — | unreviewed | — | same host in TAKIP (other feed) |
| TechCrunch Venture | https://techcrunch.com/category/venture/feed/ | — | unreviewed | — | same host in TAKIP (other feed) |
| TechMeme | https://www.techmeme.com/feed.xml | — | unreviewed | — | new |
| Techstars Blog | https://www.techstars.com/blog/feed/ | — | unreviewed | — | new |
| Techstars News | GN `Techstars accelerator when:14d` | — | unreviewed | — | new |
| The Hacker News | https://feeds.feedburner.com/TheHackersNews | — | unreviewed | — | new |
| The New Stack | https://thenewstack.io/feed/ | — | unreviewed | — | new |
| Tom's Hardware | https://www.tomshardware.com/feeds.xml<br>https://www.tomshardware.com/feeds/all | — | unreviewed | — | new |
| TWIST Episodes | GN `"This Week in Startups" Jason Calacanis when:14d` | — | unreviewed | — | new |
| Unicorn News | GN `("unicorn startup" OR "unicorn valuation" OR "$1 billion valuation") when:7d` | — | unreviewed | — | new |
| VC Insights | GN `("venture capital" insights OR "VC trends" OR "startup advice") when:7d` | — | unreviewed | — | new |
| VC News | GN `("Series A" OR "Series B" OR "Series C" OR "venture capital" OR "funding round") when:2d`<br>GN `("Series A" OR "Series B" OR "Series C" OR "funding round" OR "venture capital") when:7d` | — | unreviewed | — | new |
| VentureBeat | https://venturebeat.com/feed/ | — | unreviewed | — | new |
| Verge Shows | GN `("Vergecast" OR "Decoder podcast" Verge) when:14d` | — | unreviewed | — | new |
| Vietnam Tech | GN `Vietnam startup OR Vietnam tech when:7d` | — | unreviewed | — | new |
| YC Launches | GN `("Y Combinator" OR "YC launch" OR "YC W25" OR "YC S25") when:7d`<br>https://hnrss.org/launches | — | unreviewed | — | new |
| YC News | https://news.ycombinator.com/rss | — | unreviewed | — | new |
| ZDNet | https://www.zdnet.com/news/rss.xml | — | unreviewed | — | new |

### Positive news & science (Happy variant) (27)

| Outlet | Feed URL | Tier | State-affiliated / propaganda flag | Language | TAKIP overlap |
|---|---|---|---|---|---|
| Good News Network | https://www.goodnewsnetwork.org/feed/ | 2 | unreviewed | — | new |
| Optimist Daily | https://www.optimistdaily.com/feed/ | 2 | unreviewed | — | new |
| Positive.News | https://www.positive.news/feed/ | 2 | unreviewed | — | new |
| Reasons to be Cheerful | https://reasonstobecheerful.world/feed/ | 2 | unreviewed | — | new |
| Yes! Magazine | https://www.yesmagazine.org/feed | 2 | unreviewed | — | new |
| Conservation Optimism | https://conservationoptimism.org/feed/ | 3 | unreviewed | — | new |
| DailyGood | https://www.dailygood.org/feed | 3 | unreviewed | — | new |
| GNN Animals | https://www.goodnewsnetwork.org/category/news/animals/feed/ | 3 | unreviewed | — | new |
| GNN Earth | https://www.goodnewsnetwork.org/category/news/earth/feed/ | 3 | unreviewed | — | new |
| GNN Health | https://www.goodnewsnetwork.org/category/news/health/feed/ | 3 | unreviewed | — | new |
| GNN Heroes | https://www.goodnewsnetwork.org/category/news/inspiring/feed/ | 3 | unreviewed | — | new |
| GNN Heroes Spotlight | https://www.goodnewsnetwork.org/category/news/heroes/feed/ | 3 | unreviewed | — | new |
| GNN Science | https://www.goodnewsnetwork.org/category/news/science/feed/ | 3 | unreviewed | — | new |
| Good Good Good | https://www.goodgoodgood.co/articles/rss.xml | 3 | unreviewed | — | new |
| GOOD Magazine | https://www.good.is/feed/ | 3 | unreviewed | — | new |
| Mongabay | https://news.mongabay.com/feed/ | 3 | unreviewed | — | new |
| Shareable | https://www.shareable.net/feed/ | 3 | unreviewed | — | new |
| Sunny Skyz | https://www.sunnyskyz.com/rss_tebow.php | 3 | unreviewed | — | new |
| The Better India | https://thebetterindia.com/feed/ | 3 | unreviewed | — | new |
| Upworthy | https://www.upworthy.com/feed/ | 3 | unreviewed | — | new |
| Greater Good (Berkeley) | https://greatergood.berkeley.edu/site/rss/articles | — | unreviewed | — | new |
| Human Progress | https://humanprogress.org/feed/ | — | unreviewed | — | new |
| Live Science | https://www.livescience.com/feeds.xml | — | unreviewed | — | new |
| Nature News | https://www.nature.com/nature.rss | — | unreviewed | — | new |
| New Scientist | https://www.newscientist.com/feed/home/ | — | unreviewed | — | new |
| ScienceDaily | https://www.sciencedaily.com/rss/all.xml | — | unreviewed | — | already in (oi/newsroom) |
| Singularity Hub | https://singularityhub.com/feed/ | — | unreviewed | — | new |

## 3. Telegram channel catalogue

**Count.** 71 channels, all enabled: 63 in the `full` set and 8 in the `tech` set. The `finance` set is empty.
**By World Monitor topic:** geopolitics 19, breaking 14, conflict 12, middleeast 11, cyber 9 (1 full + 8 tech), osint 6.
**By editorial tier** (from the trust overlay, not the poll tier): T1 13 (government or wire), T2 7, T3 40, T4 11.
**Risk:** low 8, medium 54, high 9. 19 channels carry a state-affiliation flag. 4 are already in TAKIP.

**How World Monitor reads Telegram.**
- It runs a GramJS MTProto *user* client on its relay. That needs a free API id and hash from my.telegram.org plus a pre-generated logged-in session string (a phone-number account).
- It polls all channels in sequence every 60 s, with a 15 s timeout per channel and a 3 min hard cap per cycle. A stuck-poll guard clears the lock after 3.5 min. A FLOOD_WAIT error ends the cycle early.
- It waits 60 s after start-up to avoid AUTH_KEY_DUPLICATED when a container restarts. Each channel has a `maxMessages` value of 10–30, usually 15–25.
- Messages are de-duplicated by id. Media-only posts are dropped. Text is truncated to 800 characters and kept in a rolling 200-item buffer. Topics are filtered at query time.
- World Monitor treats post text as restricted (R4): its panel needs a session and is not publicly cacheable.

**TAKIP method versus World Monitor's.**
- TAKIP (`src/lib/telegram.ts` and `api/news`) parses the public `t.me/s/<handle>` HTML preview. It is keyless and stateless, but per the brief's rules it is a `scrape`. It sees only the latest page of posts (about 20) and has no history. A channel that disables its web preview cannot be read this way, and none of World Monitor's 71 handles were tested against the preview.
- MTProto gives full history, reliable ids and media flags, but needs a user account and session management.
- For TAKIP the takeaway is the **handle list and its trust overlay**, which drop straight into the existing `t.me/s/` reader, rather than the transport.

**Caveats from World Monitor's own audit (15 Sep 2026).**
- *Tier 1* on Telegram means a wire service or a direct government or intergovernmental publisher. Speed, subscriber count or a state connection alone does not qualify.
- `RocketAlert` is labelled government but is run by RocketAlert.live; its ownership is unverified.
- `SaberinFa` is a news outlet's channel, not a government department; ownership is unverified.
- `TasnimNewsEN` describes itself as a translated rebroadcast, not the official newsroom.
- `BNONews` was upgraded to Tier 1 as a subscription wire.
- **Poll tier (ops)** is World Monitor's polling priority. **Editorial tier** is the public 1–4 scale from `shared/telegram-channel-trust.ts`. The two are deliberately different.

| Handle | Label | WM topic | Region | Poll tier (ops) | Editorial tier | Type | Risk / state flag | TAKIP |
|---|---|---|---|---|---|---|---|---|
| [BNONews](https://t.me/s/BNONews) | BNO News | breaking | global | 2 | 1 | wire | low | new |
| [LiveUAMap](https://t.me/s/LiveUAMap) | LiveUAMap | breaking | global | 2 | 3 | intel | medium | new |
| [OsintUpdates](https://t.me/s/OsintUpdates) | Osint Updates | breaking | global | 2 | 3 | intel | medium | new |
| [spectatorindex](https://t.me/s/spectatorindex) | The Spectator Index | breaking | global | 3 | 3 | intel | medium | new |
| [wfwitness](https://t.me/s/wfwitness) | Witness | breaking | global | 3 | 3 | intel | medium | new |
| [InaTEWS_BMKG](https://t.me/s/InaTEWS_BMKG) | BMKG InaTEWS | breaking | indonesia | 1 | 1 | gov | state: Indonesia · low | new |
| [IDFofficial](https://t.me/s/IDFofficial) | IDF Official | breaking | middleeast | 1 | 1 | gov | state: Israel · **high** | new |
| [LebUpdate](https://t.me/s/LebUpdate) | Lebanon Update | breaking | middleeast | 3 | 3 | mainstream | medium | new |
| [RocketAlert](https://t.me/s/RocketAlert) | Rocket Alert | breaking | middleeast | 1 | 1 | gov | state: Israel · **high** | new |
| [TimesofIsrael](https://t.me/s/TimesofIsrael) | Times of Israel | breaking | middleeast | 3 | 2 | mainstream | low | new |
| [yediotnews25](https://t.me/s/yediotnews25) | Yedioth News | breaking | middleeast | 3 | 2 | mainstream | low | new |
| [dsns_telegram](https://t.me/s/dsns_telegram) | Ukraine State Emergency Service | breaking | ukraine | 1 | 1 | gov | state: Ukraine · medium | new |
| [kpszsu](https://t.me/s/kpszsu) | Air Force of the Armed Forces of Ukraine | breaking | ukraine | 2 | 1 | gov | state: Ukraine · **high** | new |
| [war_monitor](https://t.me/s/war_monitor) | monitor | breaking | ukraine | 3 | 3 | intel | medium | new |
| [AuroraIntel](https://t.me/s/AuroraIntel) | Aurora Intel | conflict | global | 2 | 3 | intel | medium | new |
| [ClashReport](https://t.me/s/ClashReport) | Clash Report | conflict | global | 2 | 3 | intel | medium | new |
| [DefenderDome](https://t.me/s/DefenderDome) | The Defender Dome | conflict | global | 2 | 3 | intel | medium | new |
| [OSINTdefender](https://t.me/s/OSINTdefender) | OSINTdefender | conflict | global | 2 | 3 | intel | medium | already in (news) |
| [warfareanalysis](https://t.me/s/warfareanalysis) | Warfare Analysis | conflict | global | 2 | 3 | intel | medium | new |
| [defapress_ir](https://t.me/s/defapress_ir) | DefaPress (Iran MOD) | conflict | iran | 2 | 1 | gov | state: Iran · **high** | new |
| [FotrosResistancee](https://t.me/s/FotrosResistancee) | Fotros Resistance | conflict | iran | 3 | 4 | intel | medium | new |
| [SaberinFa](https://t.me/s/SaberinFa) | Saberin (IRGC Intel) | conflict | iran | 2 | 1 | gov | state: Iran · **high** | new |
| [sepah](https://t.me/s/sepah) | IRGC Official | conflict | iran | 2 | 1 | gov | state: Iran · **high** | new |
| [HAMASW](https://t.me/s/HAMASW) | Hamas-Israel War | conflict | middleeast | 3 | 4 | intel | medium | new |
| [RezistanceTrench1](https://t.me/s/RezistanceTrench1) | Resistance Trench | conflict | middleeast | 3 | 4 | intel | medium | new |
| [DeepStateUA](https://t.me/s/DeepStateUA) | DeepState | conflict | ukraine | 2 | 3 | intel | medium | new |
| [CyberDetective](https://t.me/s/CyberDetective) | CyberDetective | cyber | global | 3 | 3 | intel | medium | new |
| [dragonwatch](https://t.me/s/dragonwatch) | Dragon Watch | geopolitics | asia | 2 | 3 | intel | medium | new |
| [nexta_tv](https://t.me/s/nexta_tv) | NEXTA | geopolitics | europe | 3 | 3 | mainstream | medium | new |
| [DDGeopolitics](https://t.me/s/DDGeopolitics) | DD Geopolitics | geopolitics | global | 3 | 4 | intel | medium | already in (news) |
| [france24_en](https://t.me/s/france24_en) | France 24 EN | geopolitics | global | 3 | 2 | mainstream | state: France · medium | new |
| [GeopoliticalCenter](https://t.me/s/GeopoliticalCenter) | GeopoliticalCenter | geopolitics | global | 3 | 3 | intel | medium | new |
| [geopolitics_prime](https://t.me/s/geopolitics_prime) | Geopolitics Prime | geopolitics | global | 3 | 4 | intel | medium | new |
| [GeoPWatch](https://t.me/s/GeoPWatch) | GeoPol Watch | geopolitics | global | 3 | 4 | intel | medium | new |
| [OsintTv](https://t.me/s/OsintTv) | OsintTV | geopolitics | global | 3 | 4 | intel | medium | new |
| [FarsNews_EN](https://t.me/s/FarsNews_EN) | Fars News EN | geopolitics | iran | 2 | 3 | mainstream | state: Iran · **high** | new |
| [IranIntl_En](https://t.me/s/IranIntl_En) | Iran International EN | geopolitics | iran | 2 | 2 | mainstream | state: Saudi Arabia · medium | new |
| [kianmeli1](https://t.me/s/kianmeli1) | Kian Meli (Iran) | geopolitics | iran | 3 | 4 | intel | medium | new |
| [PressTV](https://t.me/s/PressTV) | PressTV (Iran State) | geopolitics | iran | 2 | 3 | mainstream | state: Iran · **high** | already in (news) |
| [TasnimNewsEN](https://t.me/s/TasnimNewsEN) | Tasnim News EN | geopolitics | iran | 2 | 3 | mainstream | state: Iran · **high** | new |
| [VahidOnline](https://t.me/s/VahidOnline) | Vahid Online | geopolitics | iran | 1 | 2 | intel | medium | new |
| [MiddleEastEye_TG](https://t.me/s/MiddleEastEye_TG) | Middle East Eye | geopolitics | middleeast | 2 | 2 | mainstream | state: Qatar · medium | new |
| [middleeastobserver](https://t.me/s/middleeastobserver) | Middle East Observer | geopolitics | middleeast | 2 | 3 | intel | medium | new |
| [nayaforiraq](https://t.me/s/nayaforiraq) | Naya for Iraq | geopolitics | middleeast | 3 | 3 | mainstream | medium | new |
| [govsg](https://t.me/s/govsg) | Singapore Government | geopolitics | singapore | 1 | 1 | gov | state: Singapore · low | new |
| [cnalatest](https://t.me/s/cnalatest) | CNA | geopolitics | southeast-asia | 2 | 2 | mainstream | state: Singapore · low | new |
| [PikudHaOref_all](https://t.me/s/PikudHaOref_all) | Israel Home Front Command | middleeast | israel | 1 | 1 | gov | state: Israel · medium | new |
| [abualiexpress](https://t.me/s/abualiexpress) | Abu Ali Express | middleeast | middleeast | 2 | 3 | intel | medium | new |
| [Alsaa_plus_EN](https://t.me/s/Alsaa_plus_EN) | Al-Saa EN | middleeast | middleeast | 3 | 3 | mainstream | medium | new |
| [bintjbeilnews](https://t.me/s/bintjbeilnews) | Bint Jbeil News | middleeast | middleeast | 3 | 3 | mainstream | medium | new |
| [englishabuali](https://t.me/s/englishabuali) | Abu Ali Express EN | middleeast | middleeast | 2 | 3 | intel | medium | new |
| [Middle_East_Spectator](https://t.me/s/Middle_East_Spectator) | Middle East Spectator | middleeast | middleeast | 3 | 3 | intel | medium | new |
| [MiddleEastNow_Breaking](https://t.me/s/MiddleEastNow_Breaking) | Middle East Now Breaking | middleeast | middleeast | 3 | 3 | intel | medium | new |
| [QudsNen](https://t.me/s/QudsNen) | Quds News | middleeast | middleeast | 3 | 4 | intel | medium | already in (news) |
| [thecradlemedia](https://t.me/s/thecradlemedia) | The Cradle | middleeast | middleeast | 3 | 3 | mainstream | medium | new |
| [SaudiDCD](https://t.me/s/SaudiDCD) | Saudi Civil Defense | middleeast | saudi-arabia | 1 | 1 | gov | state: Saudi Arabia · low | new |
| [wamnews_en](https://t.me/s/wamnews_en) | Emirates News Agency (WAM) | middleeast | united-arab-emirates | 2 | 1 | wire | state: UAE · medium | new |
| [bellingcat](https://t.me/s/bellingcat) | Bellingcat | osint | global | 3 | 3 | intel | low | new |
| [dropsitenews](https://t.me/s/dropsitenews) | Drop Site News | osint | global | 3 | 3 | intel | medium | new |
| [OSINTIndustries](https://t.me/s/OSINTIndustries) | OSINT Industries | osint | global | 3 | 3 | intel | medium | new |
| [Osintlatestnews](https://t.me/s/Osintlatestnews) | OSIntOps News | osint | global | 3 | 4 | intel | medium | new |
| [osintlive](https://t.me/s/osintlive) | OSINT Live | osint | global | 3 | 4 | intel | medium | new |
| [rnintel](https://t.me/s/rnintel) | RN Intel | osint | global | 2 | 3 | intel | medium | new |
| [cybersecboardrm](https://t.me/s/cybersecboardrm) | Cybersecurity Boardroom | cyber (tech set) | global | 3 | 3 | tech | medium | new |
| [CYBERWARCOM](https://t.me/s/CYBERWARCOM) | CYBERWAR.COM | cyber (tech set) | global | 2 | 3 | intel | medium | new |
| [DarkWebInformer](https://t.me/s/DarkWebInformer) | Dark Web Informer | cyber (tech set) | global | 3 | 3 | intel | medium | new |
| [falconfeeds](https://t.me/s/falconfeeds) | FalconFeeds.io | cyber (tech set) | global | 3 | 3 | intel | medium | new |
| [securelist](https://t.me/s/securelist) | Securelist by Kaspersky | cyber (tech set) | global | 3 | 3 | intel | medium | new |
| [thecyberwire](https://t.me/s/thecyberwire) | The CyberWire | cyber (tech set) | global | 2 | 3 | intel | medium | new |
| [thehackernews](https://t.me/s/thehackernews) | The Hacker News | cyber (tech set) | global | 2 | 3 | tech | medium | new |
| [vxunderground](https://t.me/s/vxunderground) | vx-underground | cyber (tech set) | global | 2 | 3 | intel | medium | new |

## 4. Live video (display only)

**Counts.**
- `LIVE_NEWS_SOURCES` has **91 broadcaster slots**; 84 have at least one entry and 7 are empty and hidden (ctv-news, reuters-tv, the-guardian, tv-rain, jovem-pan, band-jornalismo, enca).
- Entries: **47 HLS `.m3u8` manifests** in 45 slots, **31 pinned YouTube video ids**, and **28 YouTube channel embeds** (`UC…`).
- `WEBCAM_SOURCES` has **24 city/space slots** with 26 YouTube video ids; 2 are empty (tel-aviv, beirut-mtv). There is no HLS among the webcams.
- The webcams are hotspot city views (Jerusalem, Kyiv rotation, Mecca, Istanbul, Taipei, Washington…) and ISS/NASA/SpaceX feeds.

**Usage notes.**
- **Display only.** These are players, not data. Nothing here produces records TAKIP could geoparse.
- Entries are tried in order until one is live. A broadcaster's own HLS comes first, then a pinned video, then the channel embed.
- Pinned YouTube video ids rot whenever a broadcaster restarts a stream. World Monitor runs a daily audit and a cron that resolves each listed channel's current live video id. The cron reads the public `youtube.com/channel/<id>/live` page and its canonical link, checks the player data for live and embeddable, and goes through a residential proxy. That is a scrape. The `UC…` channel ids are the stable part worth keeping.
- **HLS ownership.** Most manifests sit on the broadcaster's own CDN or its contracted CDN: `bbci.co.uk` (Fastly), DW (`akamaized`), Al Jazeera (`getaj.net`), NHK (`nhkworld.jp`), RT (`rttv.com`), CGTN, Press TV, TRT, tagesschau, NRK, RTVE, RTP, ERT, BFM, TV5Monde, Rudaw, Al Arabiya, Sky News Arabia and ABC AU.
- A few look like third-party relays or platform feeds, with a doubtful licence for reuse: euronews via `dash4.antik.sk` (a Slovak IPTV operator), Iran International via `live.livetvstream.co.uk`, France 24 via an Amagi Samsung-UK FAST playlist, and Fox News via a `247preview` stream.
- Some streams are likely geo-restricted, for example the BBC News channel host `vs-hls-push-uk`. Only DW's manifest was probed.
- State-owned or state-funded broadcasters among the slots: RT (EN/ES/AR), CGTN (EN/ES/AR), Press TV, TRT Haber, TRT World, Al Jazeera (EN/AR/Mubasher), DW (EN/ES/AR), France 24, NHK World, KAN 11, ERT, SABC, Arirang, tagesschau24, NRK and RTVE. Where the same outlet has an RSS row, section 2 gives World Monitor's risk and state flag.
- **TAKIP overlap.** `api/live-news` already embeds 14 channels by YouTube channel id (NBC, CBS, ABC, Bloomberg, C-SPAN, CBC, Sky, France 24, DW, Al Jazeera, NHK, CNA, WION, CGTN) plus RT on Rumble. Five channel ids match World Monitor's exactly; nine more outlets are the same with a different URL.

#### LIVE_NEWS_SOURCES (91 slots)

| Slot | Entries (type: host / id) | TAKIP |
|---|---|---|
| bloomberg | HLS: `https://bloomberg.com/media-manifest/streams/us.m3u8`<br>YT video: `QB5BNdBFujE`<br>YT channel: `UCIALMKvObZNtJ6AmdCLP7Lg` | outlet in TAKIP (other URL) |
| sky | HLS: `https://linear901-oo-hls0-prd-gtm.delivery.skycdp.com/17501/sde-fast-skynews/master.m3u8`<br>YT video: `xDWQ3LkccY8` | outlet in TAKIP (other URL) |
| euronews | YT video: `pykpO5kQJ98`<br>HLS: `https://dash4.antik.sk/live/test_euronews/playlist.m3u8` | new |
| dw | HLS: `https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8`<br>YT video: `LuKwFajn37U`<br>YT channel: `UCknLrEdhRCp1aegoMqRaCZg` | same YT channel in TAKIP |
| cnn | YT video: `GotlA1KKWoo` | new |
| france24 | HLS: `https://amg00106-france24-france24-samsunguk-qvpp8.amagi.tv/playlist/amg00106-france24-france24-samsunguk/playlist.m3u8`<br>YT video: `HvZt-nh9sGg` | new |
| alarabiya | HLS: `https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8`<br>YT video: `n7eQejkXbnM` | new |
| aljazeera | HLS: `https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8`<br>YT video: `gCNeDWCI0vo`<br>YT channel: `UCNye-wNBqNL5ZzHSJj3l8Bg` | same YT channel in TAKIP |
| yahoo | YT video: `KQp-e_XQnDE` | new |
| nasa | YT video: `fO9e9jnhYK8` | new |
| fox-news | HLS: `https://247preview.foxnews.com/hls/live/2020027/fncv3preview/primary.m3u8` | new |
| newsmax | HLS: `https://n1ctsota.akamaized.net/hls/live/2113880/Live_1/index.m3u8`<br>HLS: `https://nmxlive.akamaized.net/hls/live/529965/Live_1/index.m3u8`<br>YT video: `RNNFrG4KbH0` | new |
| abc-news | YT channel: `UCBi2mrWuNuyYy4gbM6fU18Q` | same YT channel in TAKIP |
| cbs-news | HLS: `https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8` | outlet in TAKIP (other URL) |
| nbc-news | YT channel: `UCeY0bbntWzzVIaj2z3QigXg` | same YT channel in TAKIP |
| cbc-news | YT channel: `UCuFFtHWoLl5fauMMD5Ww2jA` | outlet in TAKIP (other URL) |
| ctv-news | (empty — hidden) | new |
| reuters-tv | (empty — hidden) | new |
| bbc-news | HLS: `https://vs-hls-push-uk.live.fastly.md.bbci.co.uk/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/iptv_hd_abr_v1.m3u8` | new |
| gb-news | HLS: `https://live-gbnews.simplestreamcdn.com/live5/gbnews/bitrate1.isml/manifest.m3u8` | new |
| the-guardian | (empty — hidden) | new |
| france24-en | YT video: `HvZt-nh9sGg` | outlet in TAKIP (other URL) |
| rtve | HLS: `https://rtvelivestream.rtve.es/rtvesec/24h/24h_main_dvr.m3u8` | new |
| phoenix | HLS: `https://zdf-hls-19.akamaized.net/hls/live/2016502/de/veryhigh/master.m3u8` | new |
| rtp3 | HLS: `https://streaming-live.rtp.pt/livetvhlsDVR/rtpnHDdvr.smil/playlist.m3u8?DVR=` | new |
| trt-haber | HLS: `https://tv-trthaber.medya.trt.com.tr/master.m3u8`<br>YT channel: `UCBgTP2LOFVPmq15W-RH-WXA` | new |
| ntv-turkey | YT video: `pqq5c6k70kk` | new |
| cnn-turk | YT channel: `UCV6zcRug6Hqp1UX_FdyUeBg` | new |
| tv-rain | (empty — hidden) | new |
| rt | HLS: `https://rt-glb.rttv.com/dvr/rtnews/playlist.m3u8` | outlet in TAKIP (other URL) |
| tvp-info | YT video: `3jKb-uThfrg` | new |
| telewizja-republika | YT video: `dzntyCTgJMQ` | new |
| cnn-brasil | YT channel: `UCvdwhh_fDyWccR42-rReZLw` | new |
| jovem-pan | (empty — hidden) | new |
| record-news | YT channel: `UCuiLR4p6wQ3xLEm15pEn1Xw` | new |
| band-jornalismo | (empty — hidden) | new |
| tn-argentina | YT video: `cb12KmMMDJA` | new |
| c5n | YT channel: `UCFgk2Q2mVO1BklRQhSv6p0w` | new |
| milenio | YT video: `oPy8a-TCjzA` | new |
| noticias-caracol | YT channel: `UC2Xq2PK-got3Rtz9ZJ32hLQ` | new |
| ntn24 | YT channel: `UCEJs1fTF3KszRJGxJY14VrA` | new |
| t13 | YT channel: `UCsRnhjcUCR78Q3Ud6OXCTNg` | new |
| dw-espanol | HLS: `https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/stream04/streamPlaylist.m3u8` | new |
| rt-espanol | HLS: `https://rt-esp.rttv.com/dvr/rtesp/playlist.m3u8` | new |
| cgtn-espanol | YT channel: `UCd94YCD7yp6d-YZSRYWyeFA` | new |
| tbs-news | YT video: `Anr15FA9OCI` | new |
| ann-news | YT video: `coYw-eVU0Ks` | new |
| ntv-news | YT video: `t9kwjZBLI-A` | new |
| cti-news | YT video: `-YExqG4Llcw` | new |
| wion | YT video: `X-7LAkvfA5s` | outlet in TAKIP (other URL) |
| ndtv | HLS: `https://ndtvindiaelemarchana.akamaized.net/hls/live/2003679/ndtvindia/master.m3u8` | new |
| cgtn | HLS: `https://english-livebkali.cgtn.com/live/encgtn.m3u8`<br>YT video: `0i7n3r01L2U` | outlet in TAKIP (other URL) |
| cna-asia | YT video: `XWq5kBlakcQ` | outlet in TAKIP (other URL) |
| nhk-world | HLS: `https://masterpl.hls.nhkworld.jp/hls/w/live/master.m3u8`<br>YT channel: `UCSPEjw8F2nQDtmUKPFNF7_A` | same YT channel in TAKIP |
| arirang-news | HLS: `https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8` | new |
| india-today | HLS: `https://indiatodaylive.akamaized.net/hls/live/2014320/indiatoday/indiatodaylive/playlist.m3u8`<br>YT video: `sYZtOFzM78M` | new |
| abp-news | YT channel: `UCRWFSbif-RFENbBrSiez1DA` | new |
| al-hadath | HLS: `https://av.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8` | new |
| sky-news-arabia | HLS: `https://live-stream.skynewsarabia.com/c-horizontal-channel/horizontal-stream/index.m3u8` | new |
| trt-world | HLS: `https://tv-trtworld.medya.trt.com.tr/master.m3u8` | new |
| iran-intl | HLS: `https://live.livetvstream.co.uk/LS-63503-4/index.m3u8`<br>YT video: `5JDxjsAVaGk` | new |
| cgtn-arabic | YT channel: `UCQmJk0ErE_FiorcLBsDKORA` | new |
| kan-11 | HLS: `https://kancdn.medonecdn.net/livehls/oil/kancdn-live/live/kan11/live.livx/playlist.m3u8` | new |
| i24-news | HLS: `https://i24newshebrew-cdn.encoders.immergo.tv/master.m3u8` | new |
| asharq-news | YT video: `f6VpkfV7m4Y` | new |
| aljazeera-arabic | HLS: `https://live-hls-web-aja.getaj.net/AJA/index.m3u8`<br>YT video: `bNyUyrR0PHo` | new |
| aljazeera-mubasher | HLS: `https://live-hls-web-ajm.getaj.net/AJM/index.m3u8` | new |
| alarabiya-business | HLS: `https://live.alarabiya.net/alarabiapublish/aswaaq.smil/playlist.m3u8` | new |
| al-qahera-news | YT channel: `UCktyejXTxWaKfrgp1Oq7CMQ` | new |
| press-tv | HLS: `https://live.presstv.co.uk/hls/presstv.m3u8` | new |
| dw-arabic | HLS: `https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8` | new |
| rt-arabic | HLS: `https://rt-arb.rttv.com/dvr/rtarab/playlist.m3u8` | new |
| rudaw | HLS: `https://live.rudaw.net/hls/rudaw-tv/master.m3u8`<br>YT channel: `UCAUHoE2Ykw0sguyi5AjhrjQ` | new |
| africanews | YT channel: `UC1_E8NeF5QHY2dtdLRBCCLA` | new |
| channels-tv | YT channel: `UCEXGDNclvmg6RW0vipJYsTQ` | new |
| ktn-news | YT channel: `UCKVsdeoHExltrWMuK0hOWmg` | new |
| enca | (empty — hidden) | new |
| sabc-news | HLS: `https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/chunklist_b250000_t64MjQwcA==.m3u8`<br>HLS: `https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/playlist.m3u8` | new |
| arise-news | YT channel: `UCyEJX-kSj0kOOCS7Qlq2G7g` | new |
| welt | YT channel: `UCZMsvbAhhRblVGXmEXW8TSA` | new |
| tagesschau24 | HLS: `https://tagesschau.akamaized.net/hls/live/2020115/tagesschau/tagesschau_1/master.m3u8` | new |
| euronews-fr | YT video: `NiRIbKwAejk` | new |
| euronews-gr | YT channel: `UC8HJZNfDPoySgW9DN3YGNaA` | new |
| skai-tv | HLS: `https://skai-live.siliconweb.com/media/cambria4/index.m3u8` | new |
| ert-news | HLS: `https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERTNews/default/index.m3u8` | new |
| france24-fr | YT video: `a47ckXKZjxI` | new |
| france-info | YT channel: `UCO6K_kkdP-lnSCiO3tPx7WA` | new |
| bfmtv | HLS: `https://live-cdn-stream-euw1.bfmtv.bct.nextradiotv.com/master.m3u8`<br>YT channel: `UCXwDLMDV86ldKoFVc_g8P0g` | new |
| tv5monde-info | HLS: `https://ott.tv5monde.com/Content/HLS/Live/channel(info)/index.m3u8` | new |
| nrk1 | HLS: `https://nrk-nrk1.akamaized.net/21/0/hls/nrk_1/playlist.m3u8` | new |
| abc-news-au | HLS: `https://abc-iview-mediapackagestreams-2.akamaized.net/out/v1/6e1cc6d25ec0480ea099a5399d73bc4b/index.m3u8`<br>YT video: `vOTiJkg1voo` | new |

#### WEBCAM_SOURCES (24 slots)

| Slot | Entries (type: host / id) | TAKIP |
|---|---|---|
| jerusalem | YT video: `zp6LNSoq000` | new |
| middle-east | YT video: `AkqGOcpDvZU` | new |
| tel-aviv | (empty — hidden) | new |
| mecca | YT video: `eC4LfEVxvKg` | new |
| istanbul | YT video: `bbVe5h7X3uw` | new |
| medina | YT video: `naaOMgZbIHQ` | new |
| beirut-mtv | (empty — hidden) | new |
| kyiv | YT video: `e2gC37ILQmk` | new |
| paris | YT video: `-xzg3wujOVM` | new |
| st-petersburg | YT video: `CjtIYbmVfck` | new |
| london | YT video: `zMCea32gpmg` | new |
| washington | YT video: `oDCAAfOSqvA` | new |
| new-york | YT video: `JQ_jwk_7OVE`<br>YT video: `VGnFLdQW39A` | new |
| los-angeles | YT video: `EO_1LWqsCNE` | new |
| miami | YT video: `WT69M210Z18`<br>YT video: `bi7B4EmyHHs`<br>YT video: `4fzzp0XVPoA` | new |
| taipei | YT video: `z_fY1pj1VBw` | new |
| shanghai | YT video: `Z-g8M1QGKbg` | new |
| tokyo | YT video: `_k-5U7IeK8g` | new |
| seoul | YT video: `vk5BHoDxXf0` | new |
| sydney | YT video: `5uZa3-RMFos` | new |
| iss-earth | YT video: `M3HKLzjvKPc` | new |
| nasa-live | YT video: `awQzjn72bI0` | new |
| space-x | YT video: `mhJRzQsLZGg`<br>YT video: `Jm8wRjD3xVA` | new |
| space-walk | YT video: `fO9e9jnhYK8` | new |

## 5. Credibility-tiering scheme (for TAKIP to adopt)

World Monitor rates every source on **two independent axes** and combines them, with corroboration, into a per-headline credibility number. That number is kept separate from newsworthiness ("importance"). A state outlet breaking a real story about its own military is meant to score high on importance and low on credibility at the same time.

**Axis 1: source tier (1–4).** The tier is attached to the *publisher name*, not to the transport.
- **Tier 1, wires and official bodies:** news agencies that sell a wire to other newsrooms (Reuters, AP, AFP, Bloomberg, ANSA, PAP, BNO) and direct government or intergovernmental publishers (White House, State Dept, Pentagon, UK MOD, CISA, IAEA, WHO, UN News, civil-defence and emergency agencies). On Telegram and X, Tier 1 is limited strictly to these two kinds. Speed, follower count or a state connection never qualify on their own.
- **Tier 2, major established outlets:** national and international newsrooms with a standing editorial operation, such as BBC, Guardian, CNN, Al Jazeera, Le Monde, NHK World, and NYT on X. It also covers well-established specialist desks such as ISW, USNI and Oryx.
- **Tier 3, specialist, regional and think-tank sources:** defense trade press, think tanks (CSIS, Carnegie, Brookings), regional and local newsrooms, cyber vendors' research, and named OSINT accounts with original work.
- **Tier 4, aggregators and blogs:** link aggregators (Hacker News), blogs, anonymous repost channels and faction-aligned "news" channels.
- **Undeclared:** about 300 catalogue names have no tier. World Monitor shows "tier not declared" and explicitly does *not* count them as tier 4 in corroboration logic, although the numeric score falls back to the tier-4 value.
- A Google News `site:` query keeps its publisher's tier. A keyword query names no publisher and gets none.
- When a story is clustered, it shows the best tier among the feeds that carried it.
- Telegram and X keep two numbers: a private **poll priority** used for scheduling, and the public **editorial tier**. One is never copied into the other.

**Axis 2: propaganda risk and state affiliation.**
- **Risk** takes the values `low` (reviewed independent journalism), `medium` (state-funded but with an editorial-independence charter, a known tilt, a press-release wire, or a newsroom working under domestic restrictions), `high` (state-controlled media, or an official government publisher whose output is a primary government claim, for example TASS, Xinhua, IRNA, Ukrinform, WAFA, USTR, IDF and IRGC channels) and `unknown`.
- **`stateAffiliated`** is a separate country string. A source can be state-affiliated and still low risk, for example Indonesia's BMKG or the Singapore government.
- **`knownBiases`** is an optional list of perspective tags such as "Pro-Ukraine", "Anti-Kremlin" or "Cuban opposition perspective". The tags describe alignment relative to a conflict actor. A domestic left/right lean rating is explicitly out of scope.
- Every unreviewed source fails closed to `unknown`. It is never presented as independent.
- Tier and risk are independent. An official ministry can be Tier 1 *and* high risk, which means "authoritative about what the government claims".

**Credibility score (0–100).**
- The score is half propaganda risk, 30% tier and 20% independent corroboration. Severity and recency are excluded on purpose.
- Tier maps to 100 / 75 / 50 / 25 for tiers 1–4, with 25 also used for undeclared.
- Risk maps to 100 for low, 50 for medium, 35 for unknown and 12 for high.
- Corroboration counts up to five other sources reporting the same story, from story clustering or entity matching, at 20 points each.
- After rounding, any **high**-risk source is **capped at 40**, so repetition inside a controlled media space cannot make state media look like a wire. In World Monitor's own examples, Reuters scores about 80 uncorroborated and RT scores in the low 20s.
- No third-party bias ratings (AllSides, MBFC) are used, and no human sits in the loop.
- Tiers rank sources; they do not judge whether a particular claim is true. Threat-classification confidence elsewhere is also weighted by tier.

**Curation rules worth copying.**
- State media of adversarial governments stays catalogued but opt-in only, never default-on, and is excluded from one-click presets.
- A frontline balance is kept: the default set must include at least one primary outlet from each side's independent press, such as a Ukrainian primary and an independent Russian exile outlet.
- Newly added national institutions (Ukrinform, Suspilne) keep their risk tags wherever they appear.
- Tier and risk are keyed by exact display name. If TAKIP adopts this, it should key by publisher identity (domain or handle), so that the same newsroom gets the same rating across RSS, GN, Telegram and X.

**Mapping onto TAKIP today.** `api/news` already labels each Telegram/RSS item with `lean` and `bloc` (western / russian / regional / independent). World Monitor's scheme would add a declared tier, a risk level, a state-affiliation country and a computed credibility. TAKIP's 9 Telegram handles that World Monitor also rates are: OSINTdefender T3 medium, DDGeopolitics T4 medium, QudsNen T4 medium, and PressTV T3 high, state: Iran.

## Keyed / paid (shorter)

| Provider | Data | Why keyed | Free key available? |
|---|---|---|---|
| Telegram MTProto (World Monitor's Telegram transport) | channel posts with history and ids | MTProto needs an app id and hash plus a logged-in user session (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`) | Yes. The app id is free from my.telegram.org, but it needs a phone-number account. TAKIP's keyless `t.me/s/` scrape covers the same channels. |
| X API v2 user timelines | posts from 64 curated accounts (56 `full`, 8 `tech`), each pinned to a numeric account id | official API only; World Monitor's registry forbids scraping and treats post text as restricted | No. Reading timelines needs a paid X API tier. |
| World Monitor's own licence agreement (16 hosts) | headlines from Business Insider, Business Wire, GlobeNewswire, PR Newswire, Chainwire, Coinbase, Binance, Fox Business, Handelsblatt, Welt, Telegraph, Interfax ×2, Jin10, Times of India, Wired | the feeds are keyless, but World Monitor's redistribution rests on its own contract | The feeds are open, but TAKIP would need to clear the terms itself. Treat them as `terms-review`. |

**X accounts (facts only; poll tier):**

@Reuters (breaking/global, T1), @AP (breaking/global, T1), @AFP (breaking/global, T1), @BBCBreaking (breaking/global, T1), @BBCWorld (geopolitics/global, T2), @nytimes (geopolitics/global, T2), @WSJ (geopolitics/global, T2), @washingtonpost (geopolitics/us, T2), @CNN (breaking/global, T2), @cnnbrk (breaking/global, T2), @guardian (geopolitics/global, T2), @FT (geopolitics/global, T2), @TheEconomist (geopolitics/global, T2), @business (breaking/global, T1), @DeutscheWelle (geopolitics/global, T2), @France24_en (geopolitics/global, T2), @AJEnglish (middleeast/middleeast, T2), @AlArabiya_Eng (middleeast/middleeast, T2), @nhk_news (geopolitics/asia, T2), @NikkeiAsia (geopolitics/asia, T2), @KyivIndependent (conflict/ukraine, T2), @Ukrinform_News (conflict/ukraine, T2), @Liveuamap (breaking/global, T2), @BNONews (breaking/global, T2), @TimesofIsrael (middleeast/middleeast, T2), @haaretzcom (middleeast/middleeast, T2), @Jerusalem_Post (middleeast/middleeast, T2), @IDF (conflict/middleeast, T3), @StateDept (geopolitics/us, T1), @DeptofWar (conflict/us, T1), @CENTCOM (conflict/middleeast, T2), @DefenceHQ (conflict/europe, T2), @NATO (geopolitics/europe, T2), @UN (geopolitics/global, T1), @iaeaorg (geopolitics/global, T1), @TheStudyofWar (conflict/global, T2), @thewarzonewire (conflict/global, T2), @DefenseOne (conflict/global, T2), @BreakingDefense (conflict/global, T2), @JanesINTEL (conflict/global, T2), @sentdefender (conflict/global, T2), @IntelCrab (osint/global, T3), @Osinttechnical (osint/global, T2), @AuroraIntel (conflict/global, T2), @clashreport (conflict/global, T2), @Deepstate_UA (conflict/ukraine, T2), @IranIntl_En (geopolitics/iran, T2), @IranIntl (geopolitics/iran, T2), @meduza_en (geopolitics/russia, T2), @MoscowTimes (geopolitics/russia, T2), @tass_agency (geopolitics/russia, T3), @RT_com (geopolitics/russia, T3), @CGTNOfficial (geopolitics/china, T3), @XinhuaChinese (geopolitics/china, T3), @PressTV (middleeast/iran, T3), @IrnaEnglish (middleeast/iran, T3), @TheHackersNews (cyber/global, T2), @vxunderground (cyber/global, T2), @CISACyber (cyber/us, T1), @briankrebs (cyber/global, T2), @kaspersky (cyber/global, T3), @CrowdStrike (cyber/global, T3), @DarkWebInformer (cyber/global, T3), @thecyberwire (cyber/global, T2)
