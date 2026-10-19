# Place pages

Public pages about a place and a topic: `/city/cincinnati/transit`, `/city/nevsehir/cameras`, `/country/turkey/…`, each in every language (`/tr/city/nevsehir/cameras`). They bring search traffic for what people actually type ("Cincinnati bus tracker", "nevşehir kameraları izle"), so each one has to be about that place, from real data. Built 2026-10-19 on top of the layer pages (`public-pages.md`), whose frame, map window and language handling they reuse.

## Pieces

| What | Where |
|---|---|
| Places: every town of 15,000 people or more and every country, keyed by GeoNames id, with names in our languages from Wikidata | `data/site/gazetteer.json`, built by `tools/site/build-gazetteer.ts`; read by `lib/platform/site/places/gazetteer.ts` |
| A topic's data, keyed by GeoNames id | `data/site/topics/<topic>.json`, built by `tools/site/topics/<topic>.ts`; read with `topicTable()` (`places/tables.ts`) |
| A topic: which pages a place has, their copy, where "Open the live map" lands, what is live | `lib/platform/site/places/topics/<topic>.ts`, listed in `topics/registry.ts` |
| How a topic's page renders | `components/site/places/topics/<topic>-body.tsx`, listed in `components/site/places/topics/registry.ts` |
| One page for every place and topic | `components/site/places/place-page.tsx`, behind `app/city/[slug]/[[...topic]]` and `app/country/[slug]/[[...topic]]` |
| Indexes | `/city` (the biggest places, and countries) and `/country`; a country's overview lists its places |

## Adding a topic

1. A builder in `tools/site/topics/<topic>.ts` that writes `data/site/topics/<topic>.json` (`TopicTable`: `generated`, optional `meta`, `rows` by GeoNames id). Only real data: no row where there is nothing to say. Cameras are the exception: they are counted from the app's own camera catalogue when the page renders (`topics/camera-catalogue.ts`).
2. `lib/platform/site/places/topics/<topic>.ts` exporting a `PlaceTopic` (`places/topic.ts`). `topics/transit.ts` is the reference.
   - `pages(place)` returns the topic's pages for a place: usually one (`slug: 'transit'`), several for ranges (`earthquakes-last-10-years`, `-last-100-years`). It must be cheap and offline, a table lookup: the sitemap and the "nearby" cards call it for thousands of places.
   - `index` on each page says whether it is worth a search result. Below the bar the page still renders, with `noindex, follow`, and stays out of the sitemap and the cards. Agreed bars: transit, one operator with live positions; cameras, three on air; flights, an airport within 50 km and 100,000 people; weather, a METAR station plus radar or lightning, and 50,000 people.
   - `header()` gives the title (60 characters at most), description (110 to 160), heading and lede, through `t()` so they can be translated; name the parameter `t`, because the catalog extractor only sees `t(…)` and `msg(…)`. Use `fit()` to fall back to shorter wordings. `topics/topics.test.ts` checks every indexed page.
   - `live()` is where network calls go: over loopback to the app's own routes with `ownApi`, never to an upstream.
3. `components/site/places/topics/<topic>-body.tsx` exporting a `TopicView` (icon, `Body`, optional `Live`), and a line in that folder's registry.
4. No other file changes: the route, sitemap, nav and cards pick the topic up from the registries.

## Rules for the copy

- Every sentence true of the data, and specific to the place: operators by name, counts, sources, distances. The layer pages already say how each layer works; a place page links to them (`parts/notes.tsx`) rather than repeating their paragraphs, which would make thousands of near-identical pages.
- Measured, modelled, estimated and timetabled are said as such. Counts carry the day or time they were true for.
- A shared place name is told apart by its region or country ("London, Ontario"); the most populous place keeps the plain name and slug.

## Data

- `gazetteer.json` (about 6 MB): GeoNames cities15000 (CC BY 4.0) without city sections, historical and abandoned places; admin regions and countries from GeoNames; labels from Wikidata (CC0) by GeoNames id (P1566), stored only where they differ from the English. Rebuilding asks Wikidata one batch at a time and caches the answers in `.cache/site`; `--refresh-names` asks again.
- `topics/transit.json`: from `public/data/transit/cities.json`, whose cities are GeoNames places, with each operator's feeds read for how their vehicles reach the map.
- `topics/flights.json` and `topics/weather.json`: NOAA's station list (airports are its ranks 0 to 3 with a TAF) and RainViewer's radar coverage tiles, sampled at each place.
