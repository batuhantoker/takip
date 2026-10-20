# Geolocation

> **Status:** built 2026-10-20 in `tools/import/geo/`; not yet wired into the importers (§6). An offline index of
> place coordinates and names from bulk downloads, a resolver that places an event from whatever it carries, and a
> benchmark that measured each method against events whose coordinates are known.

Every importer used to geolocate on its own (Wikidata P625 → location item → country centroid in `wdPlace`) and
dropped what it couldn't place. The resolver gives them one place to ask, and always says how it placed an event,
so the popup can say it too (`attrs.placed_at`, read by `placement()` in `src/lib/history/popup.ts`).

## 1. The index: `data/db/geo-index.db`

Gitignored, rebuilt from bulk downloads with no per-item API calls:

```bash
nice -n 10 npx tsx tools/import/geo/build-index.ts              # download what's missing, then load
nice -n 10 npx tsx tools/import/geo/build-index.ts --fetch-only # downloads only
nice -n 10 npx tsx tools/import/geo/build-index.ts --load-only --redo geonames
```

Downloads go to `.cache/geo-index/` (gitignored) and are skipped when present; a partial file resumes with a Range
request, and the network's 20–60 s drops are retried. Each load step is recorded in the index's `meta` table and
skipped on the next run; a step whose inputs are still downloading stays open.

| Source | Files | Size | Rows in the index |
|---|---|--:|--:|
| Wikipedia article coordinates, 28 languages (en de fr es it ru pl uk tr ar fa zh ja pt nl sv el hy az sr hu ro cs he ko id vi hi; CC BY-SA) | per wiki `geo_tags.sql.gz` + `page_props.sql.gz` (page → Wikidata item) + `pages-articles-multistream-index.txt.bz2` (page → title), from dumps.wikimedia.org | 236 + 1 455 + 989 MB | 8.32 M articles (en 1.34 M, de 659 k, fr 593 k, ru 562 k, sv 548 k, pl 543 k, es 460 k, uk 404 k, zh 400 k, sr 375 k, it 363 k …); 99.7 % carry their item |
| Wikidata items with P625, their P17 and P31 (CC0) | four TSV exports from QLever (`qlever.dev/api/wikidata`; query.wikidata.org rate-limits this IP), plus P279* of 30 root classes | 3.1 GB | 12.19 M items (12.09 M with a country, 10.18 M with a kind), 261 ISO codes |
| GeoNames (CC BY 4.0) | `allCountries.zip`, `alternateNamesV2.zip`, `countryInfo.txt`, `admin1CodesASCII.txt` | 625 MB | 7.08 M places (5.24 M settlements, 454 k districts, 572 k mountains, 192 k islands, 157 k sites, 86 k capes, 66 k bays, 62 k rivers, 49 k passes …), 1.11 M with a Wikidata link |
| Pleiades (CC BY 3.0) | `pleiades-places-latest.csv.gz`, `pleiades-names-latest.csv.gz` | 11 MB | 34.9 k located ancient places, 72.7 k dated names |

Names: 16.4 M `place_name` rows (106 k flagged historic). Left out: kawiki and bgwiki (their `geo_tags` are empty,
1.7–2 kB: they don't use GeoData), the World Historical Gazetteer (403 to bots).
The full build took 6 minutes on the Mac (the downloads took about 45 minutes here, once) and makes a 3.1 GB file,
with a peak of 3.8 GB memory.

### Tables

Wikidata ids are stored as their number (Q42 → 42). Years are astronomical (1 BCE = 0).

| Table | Holds |
|---|---|
| `article (wiki, page_id, qid, title, name_norm, qualified, lon, lat, dim, type, sole)` | Every Wikipedia article with an Earth coordinate. `name_norm` is `normName` of the title without its qualifier ("Hastings, East Sussex", "Hastings (Michigan)" → `hastings`); `qualified = 0` marks the wiki's primary topic for that name. `dim` and `type` are GeoData's (`city`, `landmark`, `event`, `adm1st`…). `sole = 1`: the page has no primary coordinate and this was its only one (arwiki marks almost all as secondary). Indexed by `qid` and `name_norm`. |
| `item (qid, lon, lat, country, class, kind)` | Wikidata items with P625, their first P17 and P31, and a coarse `kind` from P31/P279* (`KIND_ROOTS` in `build/sources.ts`: fort, site, settlement, pass, cape, bay, mountain, island, lake, river, terrain, sea, country, admin, event, building, region, structure). Coordinates on other globes are dropped. |
| `country (qid, iso2)` | Wikidata countries' ISO 3166-1 alpha-2 codes (P297). |
| `country_info (iso2, iso3, name, capital, geonameid, …)` | GeoNames `countryInfo.txt`. |
| `place (id, source, source_id, name, kind, fcode, country, admin1, population, lon, lat, valid_from, valid_to, qid)` | Gazetteer places. GeoNames ids as they are; Pleiades ids + 1 000 000 000. `kind` is shared by both sources (settlement, admin1/2/3, country, mountain, river, pass, bay, sea, island, cape, terrain, region, fort, site). `qid` is GeoNames' Wikidata link. |
| `place_name (name_norm, place_id, lang, name, historic, valid_from, valid_to)` | Every name of every place, in every language the source gives, GeoNames' historic names flagged and Pleiades' names with the years they were in use. The primary key leads with `name_norm`. |

Approximations worth knowing:

- Titles come from each wiki's `pages-articles-multistream-index` (much smaller than `page.sql.gz`); pages in other
  namespaces are dropped by the namespace names and aliases from each wiki's siteinfo. Redirect titles are not
  indexed, so a historic name only matches through GeoNames or Pleiades.
- GeoNames keeps every populated place and administrative area, and physical features (rivers, mountains, capes,
  bays, plains, forts, ruins…) only when they link a Wikidata item or have names in two or more languages, or are
  of a rare, battle-relevant code (passes, straits, capes, battlefields, castles, forts, ruins, ancient sites).
- The World Historical Gazetteer refuses bots (403), so its time-bounded names aren't in; Pleiades and GeoNames'
  historic names cover Constantinople, Smyrna, Königsberg and the like.

## 2. The resolver: `tools/import/geo/resolve.ts`

`resolveEvent(index, evidence, options?)` returns `{ lon, lat, geoPrec, method, placedAt, confidence, kind,
evidence, detail }` or `null`. The cascade, best evidence first:

| Method | From | Precision |
|---|---|---|
| `own` | the source's coordinates | exact |
| `place-item` | linked Wikidata places (P276, then P706, P131; P17 last), skipping one that is itself an event | by the item's kind |
| `article` | the event's own Wikipedia articles in any of 28 languages, where most of them agree within 25 km | exact, or coarser for GeoData types/sizes of regions and countries |
| `named-place` | a place a source field names (GTD's city), with its division and country | by the place's kind |
| `title-name` | a place its titles name, in any language ("Battle of X", "Schlacht bei X", "X Muharebesi", "Битва под X", "X之战"…; `names.ts`) | by the place's kind |
| `description-name` | a place its English description names ("battle near X, Country") | by the place's kind |
| `related` | the middle of related events (a war's battles) when they lie within ~150 km of it | approximate |
| `country` | the country's point | country |

**Names never decide on their own.** Every place a name could be (GeoNames, Pleiades and geotagged Wikipedia
articles) is grouped into places (same Wikidata item, or within a radius set by the kind), then scored
(`candidates.ts`, weights in `W`): population, a primary-topic Wikipedia article, how many sources and languages name
it, and context: the event's country or division, how close its war's other battles are, a Pleiades name in use in
the event's year, the feature its title names (river, mountain, cape, pass), naval battles near water. A place is
taken only when it is the only place of that name and a second source or a primary-topic article vouches for it, or
context points to it; or, among several, context points to it (its country or division, its war's other battles
within 400 km, a Pleiades name in use in its year, two different names landing on it) and it outscores the next by 2
(§3 has the numbers behind this rule). Otherwise the result is `null`: two Lexingtons with nothing to choose between
them are left unplaced rather than guessed.

Inflected languages (Russian, Ukrainian, Polish, Czech, Serbian, Greek, Romanian) get likely nominatives
("под Полтавой" → полтава), and a guessed form only counts against a name in that language.

`placedAt` is a noun phrase for the popup's "Placed at the {place}.": "town its title names, Leuthen", "coordinates
of its Wikipedia articles (3 of 4 languages agree)", "region Wikidata gives as its location", "middle of related
events".

## 3. Benchmark

`nice npx tsx tools/import/geo/bench/benchmark.ts [--gtd 3000]` takes the events history.db places exactly
(geo_prec 1: Wikidata battles, attacks, massacres, revolutions, wars and treaties with P625, and a sample of GTD
attacks), hides their coordinates and every other coordinate a rejected row lacks (location, country), resolves them
from what is left (labels, sitelink titles, description, year, the other events of their wars; GTD: city, province,
country, summary), and measures the error. Each method runs on its own over every event, then the cascade.

Wikidata: 13 413 events (11 112 battles, 1 376 massacres, 384 attacks, 244 wars, 205 treaties and coups, 92
revolutions). GTD: 2 999 attacks GTD places exactly (`specificity = 1`). Error is great-circle distance to the hidden
point.

| Method (run on its own) | Tried | Placed | Median km | p90 km | ≤ 25 km | ≤ 100 km |
|---|--:|--:|--:|--:|--:|--:|
| `article`: its own articles' coordinates | 13 413 | 88 % | 0.0 | 0.1 | 99 % | 100 % |
| `title-name` | 13 413 | 59 % | 0.9 | 38 | 88 % | 93 % |
| `title-name` with Wikidata's country point added | 13 413 | 60 % | 0.9 | 40 | 88 % | 93 % |
| `description-name` | 13 413 | 5 % | 5.2 | 210 | 67 % | 83 % |
| `related`: middle of its war's other battles | 13 413 | 25 % | 83 | 314 | 16 % | 58 % |
| *Baseline: the P276 location point importers already use, at `area`* | 13 413 | 85 % | 0.8 | 34 | 88 % | 95 % |
| GTD `named-place` (city, province, country) | 2 999 | 89 % | 1.4 | 10 | 97 % | 99 % |
| GTD `description-name` (the summary) | 2 999 | 38 % | 1.6 | 22 | 91 % | 95 % |
| **Cascade** (article → title → description → related) | 13 413 | 96 % | 0.0 | 0.8 | 98 % | 99 % |
| **Cascade without the event's own articles** | 13 413 | 67 % | 1.2 | 114 | 81 % | 89 % |

**The `article` figure is flattered.** Most P625 coordinates were copied from those same articles: only 6 % of its
hits differ from P625 by more than 1 km, 1.5 % by more than 10 km. Its useful number is how many rejects it reaches
(§4), not its error here. The name methods have no such leak: the event's own item and articles are never candidates.

Precision by the kind of place matched (title names; the resolver's `KIND_PREC`):

| GeoPrec given | Kinds | Placed | Median km | p90 km | ≤ 25 km | ≤ 100 km |
|---|---|--:|--:|--:|--:|--:|
| city | settlement, fort, site, pass | 7 152 | 0.8 | 19 | 91 % | 94 % |
| area | district, island, mountain, cape, bay, lake, terrain, region | 547 | 5.2 | 138 | 73 % | 87 % |
| approximate | river, first-level division, sea | 170 | 40 | 360 | 44 % | 72 % |
| country | country | 11 | 64 | 806 | 27 % | 73 % |

A description's "in X" is reliable only for towns: towns 88 % within 25 km (p90 38 km), anything larger is
`approximate` (median 86 km). Related events' middle is always `approximate`, never `area`: even battles grouped within
25 km put the middle a median 19 km off, and spread ones 93 km (wdPlace's `battleMiddles` currently says `area`).

**How the acceptance rule was set.** Every title match was run permissively (take the top place whatever the
evidence) and grouped by what the decision rested on:

| Title matches by evidence | Events | Median km | p90 km | ≤ 25 km |
|---|--:|--:|--:|--:|
| every top candidate, no rule | 10 993 | 1.3 | 620 | 76 % |
| only place of its name, vouched for (two sources, primary topic or context): **taken** | 3 447 | 0.8 | 19 | 91 % |
| only place of its name, one source, no context: refused | 245 | 41 | 8 107 | 47 % |
| several places, context picks one by ≥ 2: **taken** | 4 433 | 1.0 | 66 | 87 % |
| several places, context but margin < 2: refused | 921 | 89 | 779 | 39 % |
| several places, primary topic only: refused | 1 342 | 4.1 | 6 358 | 60 % |
| … of which margin ≥ 6 | 368 | 1.0 | 111 | 86 % |
| several places, nothing to choose by: refused | 605 | 755 | 8 359 | 22 % |

The rule keeps 72 % of the top candidates and moves p90 from 620 km to 38 km. The one refused class worth
reconsidering is the last-but-one: a primary-topic place that wins by 6 or more without context is right 86 % of the
time (p90 111 km); it is left out for now.

`confidence` in each result is the share of benchmark events that method and precision put within its reach: exact
10 km, city 25 km, area 100 km, approximate 300 km, country 1 000 km (`CONFIDENCE` in `resolve.ts`): title name 0.91
(city), 0.85 (area), 0.89 (approximate); GTD named place 0.98 (city); description 0.88 (city), 0.85 (approximate);
related 0.9; article 0.99 (flattered, as above).

## 4. Rows the importers reject today

`nice npx tsx tools/import/geo/bench/recover.ts` runs the resolver read-only over the Wikidata rows rejected for
"no place" / "no coordinates" (raw rows in `docs/data/raw-2026-10-12-more/wikidata/*.json` that are not in
`ev_event` and have a label and a date but none of the coordinates their importer uses). Wars run last, with the
battles placed in the same run added to their siblings.

The selection matches the importers' own reject reports: battles 2 166, wars 616, treaties and coups 1 011, attacks
103, revolutions 22, massacres 19 (the report says 12: the other seven are also in another source's file, so the massacres importer
defers to that source, which rejected them for another reason).

| Placed by | Battles | Wars | Massacres | Revolutions | Attacks | Treaties, coups | Total |
|---|--:|--:|--:|--:|--:|--:|--:|
| article, exact | 126 | 4 | 3 | 0 | 7 | 4 | 144 |
| article, area or approximate | 5 | 0 | 0 | 0 | 0 | 1 | 6 |
| title name, city | 565 | 21 | 3 | 0 | 28 | 115 | 732 |
| title name, area | 67 | 7 | 0 | 0 | 2 | 9 | 85 |
| title name, approximate | 19 | 1 | 0 | 0 | 1 | 3 | 24 |
| title name, country | 0 | 2 | 0 | 0 | 2 | 2 | 6 |
| description name, city | 5 | 2 | 0 | 0 | 4 | 3 | 14 |
| description name, approximate or country | 8 | 9 | 0 | 1 | 1 | 1 | 20 |
| related events' middle, approximate | 184 | 34 | 2 | 1 | 3 | 33 | 257 |
| **placed** | **979** | **80** | **8** | **2** | **48** | **171** | **1 288** |
| left unplaced | 1 187 | 536 | 11 | 20 | 55 | 840 | 2 649 |

1 288 of 3 937 (33 %); 890 of them at city precision or better. Most of what stays unplaced has nothing to place it
by: treaties named after their parties or subject ("Sino-British Joint Declaration", "Protocol on Heavy Metals"),
"Action of 14 October 1918", operations, or a village no gazetteer has ("Battle of Samugarh").

Hand check of 20 (stratified by method and precision, plus two refusals):

| Event | Placed | Check |
|---|---|---|
| Battle of Pofalići (Q123481592) | title, city: Pofalići, Sarajevo | right: Sarajevo neighbourhood, 1992 |
| Treaty of Gorinchem (Q3134144) | title, city: Gorinchem | right |
| Battle of Kam Dakka (Q24949185) | title, city: Kam Dakka, Nangarhar | right |
| Battle of Tamassi (Q9173624) | title, city: Tamassi, near the Chad–Sudan border (by its war's battles) | plausible, not confirmed |
| Battle of Wijnhuize (Q124477713) | title, city: Wijnhuize, East Flanders (nlwiki primary topic) | plausible, not confirmed |
| Battle of Paya (Q2889586) | title, city: Paya, Boyacá | right: 1819 Liberation Campaign |
| Convention of London (Q2996266) | title, city: London | right |
| Battle of Bamarni (Q135186402) | title, city: Bamarni, Duhok | right |
| First Battle of Kałuszyn (Q3401908) | title, city: Kałuszyn | right |
| Battle of Magdalena River (Q5491367) | title, approximate: the Magdalena River | right river, approximate as it should be |
| Battle of Bagrevand (Q2137777) | title, area: Bagrevand canton (Eleşkirt) | right |
| Battle of Salgir (Q121316038) | title, approximate: Salgir river, Crimea | right |
| Battle of Gwaneumpo (Q85973571) | article, exact: its Korean article | right: Gwaneumpo, Namhae |
| Battle of Oivi–Gorari (Q24884194) | article, exact: its English article | right: Kokoda Track, 1942 |
| Battle of Nanyang (Q4871864) | description, city: Nanyang, Henan | right |
| December 2018 Mogadishu bombing (Q106506048) | description, city: Mogadishu | right |
| Japan–Korea Agreement of 1557 (Q11353314) | related, approximate: Seoul (7 related events) | plausible; weak evidence, honestly approximate |
| Battle of Gia Cuc (Q4871096) | related, approximate: near Hanoi | plausible, not confirmed |
| Battle of Struth (Q113047), 1945 | refused: Strüth (Rhineland) and Struth (Moselle) both primary topics | right to refuse: two primary topics conflict and nothing in the row picks one |
| Battle of Campichuelo (Q4870625), 1810 | refused: Campichuelo in Argentina (primary topic) vs Paraguay (near its war's battles) | right to refuse: the two kinds of evidence point at different places |

14 of 18 placements confirmed, 4 plausible and unconfirmed, none found wrong; both refusals were cases where the
evidence conflicted. Every placement is in `.cache/geo-index/benchmark/recover.json` for review.

## 5. Rebuilding and testing

- Index: the build command above. Downloads: 6.4 GB in `.cache/geo-index/` (Wikipedia 2.7 GB, QLever 3.1 GB of
  uncompressed TSV, GeoNames 625 MB). Rerun a single step with `--load-only --redo <wikipedia|wikidata|geonames|pleiades>`;
  delete a download to refetch it.
- Tests: `npx vitest run tools/import/geo` (the resolver runs against an in-memory fixture index).
- Benchmark and reject run: the two `bench/` commands; reports land in `.cache/geo-index/benchmark/`.

## 6. Wiring it in (for the importers' owner)

Nothing in `tools/import/datasets` calls the resolver yet. To wire it in:

1. Build the index once (§1). `openGeoIndex()` (`geo-index.ts`) returns `null` when it hasn't been built, so an
   importer can run without it and behave as today.
2. Wikidata importers (`wikidata-conflict.ts` `addRows`, and the battles, politics and attacks loops in
   `wikidata.ts`): open the index, `readSitelinks()` and `warPoints(Object.keys(FILES))` once per run
   (`wikidata-evidence.ts`), and where `wdPlace` / `politicsPlace` / `own ?? locCoord` comes back empty, before
   `rep.reject('no place')`:

   ```ts
   const r = geo && resolveEvent(geo, rowEvidence(row, sitelinks, wars, true), { methods: ['article', 'title-name', 'description-name', 'related'] });
   if (r) place = { lon: r.lon, lat: r.lat, geoPrec: r.geoPrec, placedAt: r.placedAt };
   // and in attrs: placed_at: r.placedAt, geo_method: r.method, geo_confidence: r.confidence
   ```

   Run wars after battles so newly placed battles count as their siblings (as `recover.ts` does). Bump each
   `importerVersion`.
3. Any importer that drops rows without coordinates but has a place name (GTD-style city/province/country):
   `resolveEvent(geo, { named: [{ name: city, admin1: province, country }], description, countries: [iso2] })`.
4. Decisions for the lead: whether `related` (257 rejects, `approximate`) and description matches at `approximate`
   should show on the map or stay out until a zoom where their precision is honest; whether the live recovery in
   `wikidata-recover.ts` runs before or after this (the offline resolver is free and instant, so after it the live
   calls only see what is left); whether wdPlace's `battleMiddles` should say `approximate` rather than `area`
   (§3); and whether to take a primary-topic place that wins by 6 or more without context (§3: 86 % within 25 km).
5. Paths (`DB_PATH`, `.cache/geo-index`, the raw Wikidata folder) are relative to the working directory, which is
   the repo root under `npm run import`. `wikidata-evidence.ts` repeats a few helpers from `datasets/wikidata.ts`
   (`wdPoint`, the raw folder, sitelinks) because that file was being edited; fold them together when wiring in.
