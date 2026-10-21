# Wikipedia year pages

> **Status:** built 2026-10-20 (`tools/import/fetch-years.ts`, `tools/import/years/`, `datasets/wikipedia-years.ts`).
> All ten wikis fetched, measured and imported in a dry run; not yet imported into `data/db` (§5).

Wikipedia's year articles ("1683", "1990 in Turkey", "1683 год", "1683年") and the English Current events days list
dated events as bullets, each linking the articles it is about. A survey had set them aside as unstructured text. Read
through their links and the geolocation index (`geolocation.md`), most of them place as well as the resolver's
accepted methods; this page says how, and how well.

## 1. Fetch

```bash
nice npx tsx tools/import/fetch-years.ts en            # or several: en tr de fr ru es ar fa zh ja; none = all ten
nice npx tsx tools/import/fetch-years.ts en --reparse  # rebuild the json from the cache, no network
YEARS_LANGS=en,tr npx tsx tools/import/fetch.ts years   # the same through fetch.ts
```

- **Titles** come from each wiki's dump title index (`.cache/geo-index/wikipedia/<lang>wiki-pages-articles-multistream-index.txt.bz2`,
  downloaded by the geo index build): year, BCE year, decade and century titles in each wiki's naming, English
  "<year> in X" where X is a country (the geo index's country names in any language, plus historical states such as
  the Ottoman Empire or the Soviet Union, `COUNTRY_ALIASES`), French "<année> en X", and every English Current events
  day since 2002. Years after this one are plans, not history, and are left out.
- **Wikitext** through the Action API, 50 titles a request, one request a second, following redirects (a BCE year
  lands on its decade page) and every `continue` until the batch is complete (big year pages come back a few at a
  time). Waits out the network's drops with backoff up to ten minutes; cached per page in
  `.cache/wikipedia-years/<lang>/pages.jsonl`, so a rerun fetches only what is missing.
- **Parse** (`years/parse.ts`, rules per wiki in `years/langs.ts`): the events section (or, on pages laid out by
  region, everything before the births), its sub-headings as the section, each bullet's leading date in that wiki's
  forms ("January 5 –", "5 January –", "3. Mai:", "{{1er janvier}} :", "12 сентября —", "12 de febrero:", "1月5日 –"),
  ranges, a year or decade heading inside decade and century pages, sub-bullets taking their parent's date, "c." and
  "(approximate date)" one step coarser. A bullet that opens with a span begun before the page's year ("1618–1683 —")
  is skipped: it is listed under every year it lasted. Links are rendered as their labels; the date, year and file
  links are dropped. On a Current events day the date is the page's and the story lines above an item are its context.
- **Links → Wikidata items** offline from the dump's title index and `page_props` (75 % of English links); redirects
  and pages newer than the dump through the API (`prop=pageprops`, 50 a request).
- **Kinds**: the subclass closures of the event classes that map to TAKIP kinds, from QLever (`classes.json`), and for
  the kinds whose subclass trees stray (riots, protests, accidents, crimes) `fetch-events.ts`' explicit class lists.

Output: `docs/data/raw-2026-10-12-more/wikipedia-years/<lang>.json` (pages, links with their items, bullets).

## 2. Placement (`years/place.ts`)

A bullet's **main link** is the first event it links that it is *about*: an article TAKIP already has, an item the geo
index calls an event, one whose class maps to a kind, or one named like an event ("Siege of X") — and whose date can be
checked and agrees with the bullet's (TAKIP's date for its own events, else Wikidata's P585/P580–P582, fetched for every
linked item that isn't a place: `event-dates.json`). An event of another day is a mention ("a trial over the 2004
murder of …", "Live Aid concerts in Philadelphia for the famine in Ethiopia"), one running over a year (a war, a
pandemic) is the setting, and an undated one can't be told from either ("Rules of engagement" is named like a battle
and was put at a London restaurant called Rules): none of them is main. A link the geo index knows as a place is never
an event however its title reads.

Links are classified from the geo index alone: only items with Wikidata coordinates are places (an article about a
person can carry a stray coordinate in another language: the Arabic George Washington has his grave's). Precision is
the place kind's, coarsened by the article's GeoData size and type, and by GeoNames' admin level (Wikidata's "admin" is
every level; a US state is `approximate`, not `area`). Continents, oceans and country-sized places are not places.

The accepted cascade, in order (`placeAccepted`):

| Method | Places at | Precision |
|---|---|---|
| `event-article` | the main event's own coordinates (Wikidata P625, or its articles' agreed point) | exact, coarser for big things by GeoData size |
| `place-in` | the place its text puts it in or at: a link after "in/at/near" (`im`, `bei`; `à`, `près de`; `в`, `под`; `en`; `في`; `در`; `在`), or before Turkish `'da`/`yakınlarında` or Japanese `で`; a finer linked place inside that one wins ("Mount Bromo in [[Indonesia]]") | by kind |
| `event-title` | the place the main event's title names, by the resolver's `title-name` rules | by kind |
| `place-links-middle` | the middle of several linked places within 150 km of it | approximate |
| `description-name` | "… in X" in English text, by the resolver's rules | one level coarser: approximate, or country |
| `place-link` | the one place it links, others only containing it | one level coarser: approximate, or country |
| `country-link` | the one country it links, if under 150,000 km² (not Persian) | country |

Per wiki (`LANG_RULES`), a method whose points were right only to one level coarser is placed at that level, its
`placed_at` reading "area around the …": `place-in` in French, Russian, Spanish, Arabic and Chinese, `event-title` in
Chinese, everything in Persian (too few bullets to measure).

Refused: places that compete (another linked place beyond the first's reach: 54 % within reach), a story line's event or
places on Current events days (`context-event`, `context-place`: 57–64 %), a linked organisation's or ship's
coordinates (`coords-link`: 49 %), a large linked country, a "<year> in X" page's country (`country-page`: 76 % within
1,000 km in the cascade, 33 % for countries over 600,000 km²). What none of the accepted methods places is left out and
counted (`no place among its links or text`).

## 3. Duplicates

- A bullet whose main link is an event TAKIP has, dated so the two can be one occurrence (a day's bullet within a day
  of it, two weeks before 1924 for Julian dates; a year's within that year), is a `same_as` twin of it: the row is
  kept as one more source, the existing event stays canonical (these sources are unranked in `CANONICAL_ORDER`).
- A later bullet on another page or in another language linking the same event at a matching date is a twin of the
  first. Languages import in `YEARS_LANGS` order, English first, and link only to the ones before them, so English
  leads. Bullets with no event link can't be matched across languages.

## 4. Benchmark

`nice npx tsx tools/import/years/bench.ts [en tr …]` → `.cache/wikipedia-years/benchmark/benchmark.md`.

Truth: bullets whose main link is an event with exact coordinates (TAKIP's own at `geo_prec` 1, or Wikidata P625 in the
geo index) and that are surely about it (dated as TAKIP or Wikidata date it, or, with no date, opening with its name).
That article and its coordinates are hidden; its title stays for `event-title`, as a coordinate-less event's would.
Each method is run alone and in the cascade; within reach means exact 10 km, city 25, area 100, approximate 300,
country 1,000, the measure geolocation.md accepted the resolver's methods by (85–91 %).

English, 17,545 bullets surely about an event with exact coordinates, each method alone:

| Method | Placed | Median km | p90 km | ≤ 25 km | Within reach |
|---|--:|--:|--:|--:|--:|
| `place-in` | 30 % | 3.0 | 88 | 80 % | 90 % |
| `event-title` | 23 % | 1.3 | 75 | 86 % | 89 % |
| `description-name` | 24 % | 3.9 | 114 | 79 % | 87 % |
| `place-link` (no competing place) | 43 % | 3.8 | 161 | 75 % | 86 % |
| `place-links-middle` | 2 % | 38 | 122 | 33 % | 97 % (approximate) |
| `context-event` (Current events story) | 2 % | 0.1 | 365 | 60 % | 60 % |
| `coords-link` | 3 % | 31 | 5,048 | 49 % | 49 % |
| `country-link`, under 150,000 km² / over 600,000 | 19 % | 379 | 2,215 | 5 % | 88 % / 69 % |
| `country-page`, under 150,000 km² / over 600,000 | 52 % | 637 | 4,470 | 2 % | 85 % / 33 % |
| `event-article` (flattered: Wikidata's P625 is mostly its articles') | 100 % | 0.0 | 0.0 | 99 % | 99 % |

Placed after the methods before them failed, `place-link` and `description-name` drop to 75 % and 82 % within 25 km
but are 87 % and 90 % within 300 km, so the cascade gives them one level coarser. The accepted cascade, by the method
that placed each bullet, within reach of the precision it was given:

| Wiki | Cases | Placed | `event-title` | `place-in` | `place-link` | `place-links-middle` | `description-name` | `country-link` |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| en | 17,545 | 64 % | 89 % (2,955) | 90 % (5,334) | 91 % (1,933) | 95 % (169) | 93 % (672) | 86 % (208) |
| tr | 810 | 49 % | 91 % (143) | 89 % (161) | 91 % (68) | 100 % (7) | – | 100 % (18) |
| de | 3,575 | 52 % | 91 % (505) | 87 % (601) | 91 % (671) | 98 % (46) | – | 92 % (51) |
| fr | 5,591 | 52 % | 92 % (1,245) | 93 % (848)* | 89 % (687) | 94 % (65) | – | 92 % (61) |
| ru | 3,807 | 43 % | 86 % (461) | 93 % (502)* | 93 % (569) | 96 % (24) | – | 93 % (70) |
| es | 2,544 | 59 % | 90 % (184) | 92 % (777)* | 89 % (448) | 88 % (26) | – | 94 % (71) |
| ar | 775 | 38 % | 92 % (36) | 89 % (141)* | 92 % (97) | 80 % (5) | – | 100 % (12) |
| fa | 197 | 32 % | 90 % (10)* | 89 % (28)* | 88 % (24) | 100 % (1) | – | – |
| zh | 1,269 | 47 % | 92 % (64)* | 90 % (172)* | 94 % (296) | 100 % (31) | – | 83 % (29) |
| ja | 1,578 | 34 % | 89 % (131) | 87 % (153) | 88 % (215) | 78 % (9) | – | 86 % (22) |

\* one level coarser in that wiki (at native precision: `place-in` 77–83 %, Chinese `event-title` 83 %).

The same placements on everything, not only events with known coordinates: on "<year> in X" pages, `place-in` puts
88 % (en) and 87 % (fr) of bullets inside X, `place-link` 86 % and 86 %; the rest are mostly real events abroad.

**Dates** against Wikidata's for the first event a bullet links (events under a year): bullets dated to the day give
Wikidata's day ±1 in 82 % (en), 72–84 % elsewhere (de and tr 72 %, fa 64 % of 97); 10–21 % more are within two weeks,
mostly Julian against Gregorian before 1924; 3–4 % are another year (a mention, or an error). Bullets dated to the year
give Wikidata's year in 93 % (ru) to 99.7 % (es).

**Hand check** of 30 placed events across the ten wikis and five eras: 26 right, 2 arguable (Tibet's losses "in
Turkestan" put in West Turkestan; a Hamas official's interview put in Israel, the one country it links), 2 wrong (a
German bullet crowning Lambert Simnel "in Dublin", Dublin not linked, put at the Tower of London it links later; "Gothic
architecture becomes popular in Europe" at a point for Europe, since refused with the other continents). An earlier
round led to the date rule above: "Rules of engagement" at the London restaurant Rules.

## 5. Import

```bash
nice npx tsx tools/import/cli.ts seed wikipedia-years-en wikipedia-years-tr wikipedia-years-de wikipedia-years-fr wikipedia-years-ru \
  wikipedia-years-es wikipedia-years-ar wikipedia-years-fa wikipedia-years-zh wikipedia-years-ja [--dry-run]
```

One source per wiki (`wikipedia-years-<lang>`, Wikipedia contributors, CC BY-SA 4.0), last in `DATASETS`. Each bullet
is an event: the kind of its main event's Wikidata class when that maps to a TAKIP kind (`years/kinds.ts`), else
`event.general` in the `events` family; the title is its first sentence, the full text `attrs.description`,
`attrs.wiki` its main event (or first non-country link) in that wiki ("fr:Titre"), `attrs.url` the year page,
`attrs.source` the page and section, `attrs.placed_at` and `attrs.geo` how it was placed, `ids.wikidata` its main event.
Needs the geo index (skipped without it).

Dry run on 2026-10-20 against `data/db` (`--dry-run`):

| Wiki | Bullets | New events | Linked to a TAKIP event or an earlier wiki's bullet | … to an earlier bullet of its wiki | Unplaced | Names, not events |
|---|--:|--:|--:|--:|--:|--:|
| en | 361,622 | 147,979 | 18,517 | 2,114 | 186,664 | 6,348 |
| tr | 10,751 | 3,247 | 1,070 | 0 | 6,350 | 84 |
| de | 58,409 | 21,294 | 4,484 | 9 | 31,629 | 993 |
| fr | 100,041 | 35,726 | 7,510 | 57 | 52,899 | 3,849 |
| ru | 56,995 | 17,005 | 5,309 | 1 | 33,079 | 1,601 |
| es | 36,255 | 15,060 | 3,119 | 9 | 17,959 | 108 |
| ar | 9,006 | 3,045 | 970 | 1 | 4,899 | 91 |
| fa | 8,880 | 1,918 | 263 | 0 | 6,673 | 26 |
| zh | 21,336 | 5,784 | 1,742 | 3 | 13,287 | 520 |
| ja | 26,373 | 6,596 | 2,072 | 1 | 17,044 | 660 |
| **all** | **689,668** | **257,654** | **45,056** | **2,195** | **370,483** | **14,280** |

On a copy of `data/db` from earlier the same day, about 7,200 of the links went to another wiki's bullet (mostly
English), the rest to other sources' events.

New events by precision (that earlier copy): 7,857 exact, 58,564 city, 14,155 area, 138,257 approximate, 43,559 country. By family:
258,243 `events`, the rest disaster, crime, terror, conflict, hazard, politics and nuclear (their main event's kind).

Worth knowing:

- An unranked source keeps the lowest event id as canonical. These rows are newer than the events they link to today,
  but if another unranked source later adds an event and a re-import links a bullet to it, the older bullet row would
  become canonical; listing these sources in `CANONICAL_ORDER` would make it worse (listed ranks above unlisted).
- How it was placed is in `attrs.geo` (`method`, `detail`), not top-level `geo_method` as geolocation.md §6 suggests, so
  the popup's `facts()` doesn't list it; the method's measured share is the `confidence` column.
- `attrs.wiki` of a bullet with no main event is its subject's article ("Isaac Newton", "Pegasus Airlines");
  `ids.wikidata` is set only for a dated main event, so match on that, not on the title.
- A decade's or century's line ("Throughout the decade, North Korea expanded its nuclear capabilities…") sums up its
  events, so it takes no main event and no article (`summarises` in `years/prepare.ts`). Until 2026-10-21 it took the
  first event it named whose date fell inside the decade, became that event's canonical row and lent it a decade date:
  24 indexed pages (Oklahoma City, Madrid 2004, Beslan, North Korea's 2013 test …) were led by such a line.
- `event-dates.json` and `classes.json` are inputs of every wiki's dataset, so refetching one wiki re-imports all ten.
  `titles.json` in each wiki's cache is kept between runs: delete it after changing `COUNTRY_ALIASES`. `years/kinds.ts`
  takes its riot, protest, accident and crime class lists from `fetch-events.ts`.
- `fetch.ts all` now includes `years` (hours on a first run).
