# GDELT stories

Parked 2026-10-13. The live layer works; history and the ingest connector are not started.

## What runs now

`/api/gdelt-events` reads the last two hours of GDELT 2.0 files and shows one marker per story. It reads both the English and the translated feed, and both the Events export and the Mentions file for each 15-minute window. The GDELT Events layer is off by default (`gdelt_events`).

- Fetching: `src/lib/alerts/gdelt-events.ts`. Published windows are cached in memory, since they never change.
- Parsing and reduction: `packages/connectors/src/gdelt/` (`parse.ts`, `reduce.ts`, `slug.ts`, `cameo.ts`), tested against real rows in `fixtures/export.tsv`.
- Map: the paint is in `src/lib/basemap/base-layers.ts`, the popup in `src/lib/map/popups/layer-popups.ts`, colours in `src/lib/alerts/gdelt-display.ts`.
- Query: `hours` (1–6, default 2), `min_reports` (default 2; 1 brings back single reports), `family` (violence, protest, tension, cooperation or all; cooperation is off by default), `limit`.

`/api/gdelt` is not GDELT: it serves GDACS disaster alerts, and `src/components/site/docs/api-catalog.ts` describes it wrongly. `/api/conflicts` says GDELT in its header but reads BBC, Al Jazeera and NYT RSS. Neither is renamed yet.

## How a story is built

Measured on the 2026-10-13 00:45 UTC window: 1,879 rows came from 324 articles. 61% were statements and consultations, and 18% sat on a country's centre.

1. Rows on a country centre, or with no place, are dropped. Rows on a state or province centre are kept and drawn as faint rings.
2. Articles at one place join when their slugs share two topic words. They also join when GDELT matched both to the same event (Mentions, confidence ≥ 50) and their slugs share one word. GDELT matches events by actors, verb and place, so "US consults US" alone would tie hundreds of unrelated articles together.
3. Words found at more than 20 places ("trump", "police", "man") don't count. Neither do stop words, which cover English, Spanish, Portuguese, French, Italian and German.
4. A story needs two distinct headlines from two outlets. A syndicated copy counts once.
5. An article geocoded to several places stays with its biggest story.
6. A story's family is the most severe one with a quarter of its events, else the most common. It is decided before the `family` filter, so a story stays one story.
7. If no URL names the story's place, it moves to a place two of its URLs do name. That can be another of its own places, or a place seen elsewhere in the input whose city and region or country the URLs both name. This fixed a Jalisco water protest that the translated feed had put in London.

Result on the live data: about 40 stories in two hours, from about 14,800 rows, 28,700 mentions and 5,000 articles.

## Known limits

- The family follows GDELT's coding. A Houthi missile strike on Riyadh comes out as tension ("Threatened"), because few of its events are coded as violence.
- Links come from slugs, not page titles. Translated-feed links read in the original language, sometimes transliterated (Greek, Russian).
- Some weak pairs still join, such as two unrelated Ohio shootings or two different hurricanes in Florida.
- The live layer forgets everything outside its window. Corroboration that arrives later is lost.

## Next steps

1. **Ingest connector** (`apps/ingest/src/connectors/gdelt.ts`, in the `usgs.ts` shape). It records the export and mentions files and writes reduced stories into history.db as `gdelt.event`. That kind is already seeded, and `dataset-import-map.md` plans it with GLOBALEVENTID keys; a story would key on its headline event's id. Message the backend lead before touching shared schema. This is the prerequisite for both points below.
2. **History** (the History tab, not Replay). Open decision: which of these to build?
   - Story markers per day, replayed on the timeline. This is the same parser over past days. GDELT 2.0 files go back to February 2015: about 96 windows a day, a few hundred KB each. Run it per requested day or keep the top stories per day; a full backfill would be tens of GB.
   - Country-level intensity over years. This uses GDELT 1.0 daily files (no mentions, so counts only) or GDELT's public BigQuery tables.
3. **Headlines.** Take `<PAGE_TITLE>` from the GKG file's `V2EXTRASXML` for the kept articles only. The file is about 5 MB per window; read it as it streams and don't store it.
4. Rename `/api/gdelt` (GDACS) and fix the wrong labels in `/api/conflicts` and `api-catalog.ts`.
