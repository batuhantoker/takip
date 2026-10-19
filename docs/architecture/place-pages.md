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
   - `index` on each page says whether it is worth a search result. Below the bar the page still renders, with `noindex, follow`, and stays out of the sitemap and the cards. Agreed bars: transit, one operator with live positions; cameras, two on air; flights, an airport within 50 km and 100,000 people; weather, a METAR station plus radar or lightning, and 50,000 people; ports, a medium or large harbour credited to the place within 10 km, one of the map's major ports, or a small harbour where AIS heard 50 ships, and in each case at least 10 ships heard there in the AIS sample; ISS, 100,000 people where the station can climb 10° or more (within about 64.5° of the equator); aurora, 55° of magnetic latitude in the north and 51.5° in the south, where Tasmania and southern New Zealand watch the southern lights. ISS and aurora also drop a place within 25 km (ISS) or 50 km (aurora) of a more populous indexed one, since its numbers would be the same (`topics/sky-rules.ts`). Earthquakes, five distinct events in the range: USGS quakes at its floor, NOAA's significant quakes USGS doesn't list at that floor, eruptions, and tsunamis no counted event caused (`hazardIndexed` in `topics/hazards-facts.ts`). A city gets earthquake pages only with 100,000 people, five NOAA-listed events within 100 km, and no bigger such city within 25 km, and keeps only its indexed ranges.
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
- `topics/ports.json`: NGA's World Port Index (Pub. 150, public domain; cached in `.cache/site`) within 10 km of each place, each harbour credited to one place (one bearing its name, else the strongest pull of population over distance squared), with the map's major ports and chokepoints (`lib/feeds/maritime/ports.ts`) and the different ships heard near each in the 24 fullest hours of the last week of the AIS archive. Rebuilt without an archive it has no counts, and the 10-ship part of the bar drops out.
- `topics/hazards.json`, from `tools/site/topics/hazards.ts` (`--as-of` sets the day counted to): three pages a place, the last ten calendar years, the last hundred and the whole record. USGS ComCat (M4.5+ for ten years, M6+ since 1900, asked a year at a time and cached in `.cache/site/hazards`) and NOAA NCEI's significant quakes, tsunamis and eruptions from `data/db/history.db`, never summed: a NOAA quake within 120 s and 150 km of a USGS one is the same quake. A country counts an event inside it, at sea within 100 km (every country that near), or up to 300 km where it is the nearest; a city, within 100 km, or 200 km for M7+. A tsunami also counts where NCEI's runups record deaths or a metre of water, with the dead there (a country's "ALL OF" summary or the sum of its points, whichever is larger) rather than the event's whole toll. Each range keeps its counts, its yearly or ten-yearly USGS series and its strongest, deadliest, latest and oldest events; the copy is chosen from them in `topics/hazards-facts.ts`. About 1.5 MB.
- `topics/iss.json` and `topics/aurora.json`, both from `tools/site/topics/sky.ts`: every city's time zone from GeoNames, and for the aurora the corrected geomagnetic latitude of places from 50°, traced along IGRF-14's field (NOAA NCEI, cached in `.cache/site`; it matched aacgmv2 to 0.1°). The passes and the aurora chance are worked out when the page renders, from the satellites and aurora routes.
